import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  askAi,
  deleteConversation,
  getConversation,
  listConversations,
  type AiMessage,
  type AskScope,
} from '@/api/ai';
import { ApiError } from '@/api/client';
import { useCountdown } from '@/lib/useCountdown';

/** Shared by every AI surface, so a question asked anywhere lands in one list. */
export const CONVERSATIONS_KEY = ['ai', 'conversations'] as const;

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: async () => (await listConversations()).data,
    enabled,
    staleTime: 30_000,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

/**
 * One turn as rendered. A saved thread arrives as alternating user/assistant
 * rows and a live exchange is built the same way, so both render through one
 * shape rather than the panel special-casing "loaded" versus "just asked".
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string | null;
  rowCount?: number | null;
  rows?: Record<string, unknown>[];
  error?: string | null;
  pending?: boolean;
}

function fromApi(m: AiMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    sql: m.sql,
    rowCount: m.rowCount,
    rows: m.rows,
    error: m.error,
  };
}

export function useAiChat({ scope, conversationId }: { scope?: AskScope; conversationId?: string | null } = {}) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(conversationId ?? null);
  const [pending, setPending] = useState(false);

  // A 503 means the deployment has no GEMINI_API_KEY — a config state, not a
  // failed question, so it disables the composer rather than rendering as a
  // reply that didn't work.
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | undefined>();
  const cooldown = useCountdown(rateLimitSeconds);

  const localId = useRef(0);
  const nextLocalId = () => `local-${localId.current++}`;

  // Which conversation the messages on screen belong to, and which one we have
  // already copied in from the server. Both are refs, not state: they exist to
  // decide whether an effect should touch `messages` at all, and making them
  // state would re-run the very effects they guard.
  const shownId = useRef<string | null>(conversationId ?? null);
  const hydratedId = useRef<string | null>(null);

  const thread = useQuery({
    queryKey: ['ai', 'conversation', conversationId],
    queryFn: async () => (await getConversation(conversationId as string)).data,
    enabled: Boolean(conversationId),
  });

  // Switching to a DIFFERENT conversation clears the thread immediately, so the
  // previous conversation's messages never sit under the newly selected title
  // while the fetch is in flight — that stale overlap is what read as the
  // assistant answering with someone else's chat.
  //
  // The id catching up with a thread we are already in (the URL gaining ?c=
  // after the first question of a brand-new chat) is not a switch, and must
  // not clear anything.
  useEffect(() => {
    const next = conversationId ?? null;
    if (next === shownId.current) return;

    shownId.current = next;
    setActiveId(next);
    setMessages([]);
  }, [conversationId]);

  // Copy the saved transcript in once per conversation. Re-running it on every
  // refetch would overwrite a live exchange with whatever the server had before
  // it: the sidebar refresh after each answer refetches this thread, so an
  // unguarded copy could drop the reply the user is currently reading.
  useEffect(() => {
    if (!thread.data || thread.data.id !== conversationId) return;
    if (hydratedId.current === thread.data.id) return;

    hydratedId.current = thread.data.id;
    setMessages(thread.data.messages.map(fromApi));
  }, [thread.data, conversationId]);

  const reset = useCallback(() => {
    shownId.current = null;
    hydratedId.current = null;
    setMessages([]);
    setActiveId(null);
  }, []);

  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pending || unavailable || cooldown > 0) return;

      const placeholderId = nextLocalId();
      setMessages((prev) => [
        ...prev,
        { id: nextLocalId(), role: 'user', content: text },
        { id: placeholderId, role: 'assistant', content: '', pending: true },
      ]);
      setPending(true);

      try {
        const res = await askAi(text, { conversationId: activeId, scope });
        const data = res.data;
        if (data.conversationId) {
          setActiveId(data.conversationId);
          // This exchange IS the current state of that conversation, so claim
          // it on both refs: the URL is about to catch up (which must not clear
          // the thread) and the thread query is about to resolve (which must
          // not overwrite it).
          shownId.current = data.conversationId;
          hydratedId.current = data.conversationId;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  id: placeholderId,
                  role: 'assistant',
                  content: data.answer,
                  sql: data.sql,
                  rowCount: data.rowCount,
                  rows: data.rows,
                }
              : m
          )
        );
        // Refreshes the sidebar: a new conversation has to appear, and an
        // existing one moves to the top on updated_at.
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : null;
        if (apiErr?.status === 503) setUnavailable(apiErr.message);
        if (apiErr?.status === 429) setRateLimitSeconds(apiErr.retryAfterSeconds ?? 60);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { id: placeholderId, role: 'assistant', content: '', error: apiErr?.message ?? 'Something went wrong. Try again.' }
              : m
          )
        );
        // The backend records failed turns too, so the list still moves.
        queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      } finally {
        setPending(false);
      }
    },
    [activeId, cooldown, pending, queryClient, scope, unavailable]
  );

  return {
    messages,
    submit,
    reset,
    pending,
    activeId,
    unavailable,
    cooldown,
    blocked: Boolean(unavailable) || cooldown > 0,
    isLoadingThread: thread.isLoading,
  };
}
