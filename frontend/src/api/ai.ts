import { apiRequest } from '@/api/client';

/**
 * Which dashboard a conversation was started from. Declared here rather than
 * alongside the panel copy so the dependency runs one way: components import
 * the API contract, never the reverse.
 */
export type AskScope = 'bookings' | 'expenses' | 'investors';

/**
 * The shape controllers/aiQuery.controller.js returns from /ai/ask. `sql` is
 * the generated read-only query it actually ran and `rows` is capped at 50
 * server-side, so `rowCount` can exceed `rows.length` on a broad question.
 *
 * `conversationId` is null when the answer succeeded but persisting it didn't
 * — the controller returns the answer regardless rather than discarding work
 * the user already waited for.
 */
export interface AiAnswer {
  question: string;
  answer: string;
  sql: string;
  rowCount: number;
  rows: Record<string, unknown>[];
  conversationId: string | null;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string | null;
  rowCount?: number | null;
  rows?: Record<string, unknown>[];
  /** Set instead of content when that turn failed. */
  error?: string | null;
  createdAt: string;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  scope: AskScope | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface AiConversation extends AiConversationSummary {
  messages: AiMessage[];
}

export function askAi(question: string, opts: { conversationId?: string | null; scope?: AskScope } = {}) {
  return apiRequest<{ success: true; data: AiAnswer }>('/ai/ask', {
    method: 'POST',
    body: {
      question,
      ...(opts.conversationId ? { conversationId: Number(opts.conversationId) } : {}),
      ...(opts.scope ? { scope: opts.scope } : {}),
    },
  });
}

export function listConversations() {
  return apiRequest<{ success: true; data: AiConversationSummary[] }>('/ai/conversations');
}

export function getConversation(id: string) {
  return apiRequest<{ success: true; data: AiConversation }>(`/ai/conversations/${id}`);
}

export function deleteConversation(id: string) {
  return apiRequest<{ success: true; message: string }>(`/ai/conversations/${id}`, { method: 'DELETE' });
}

/** middleware/validators/aiQuery.validators.js rejects anything longer. */
export const MAX_QUESTION_LENGTH = 500;
