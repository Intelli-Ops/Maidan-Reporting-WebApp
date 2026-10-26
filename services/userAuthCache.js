'use strict';

// Short-TTL in-memory cache for the per-request user lookup in
// authenticateToken (middleware/auth.js). Safety-net expiry only — anything
// that actually changes a user's role/status/can_upload/can_use_ai_chat
// through this app's own admin endpoints (see updateUser in
// auth.controller.js) calls invalidate() immediately, so revocation through
// the app stays instant. The TTL just bounds the damage from anything that
// bypasses that (e.g. a direct DB edit) to a few seconds instead of up to
// JWT_EXPIRES_IN.
//
// Single Map, no eviction sweep — entries are checked lazily on read and
// dead ones are dropped then. Fine at this app's user count; would need
// Redis instead of a process-local Map if this ever ran as multiple
// instances behind a load balancer, since each instance would otherwise
// cache independently and invalidate() would only clear its own copy.
const TTL_MS = 30 * 1000;

const cache = new Map();

function get(userId) {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(userId);
    return null;
  }
  return entry.data;
}

function set(userId, data) {
  cache.set(userId, { data, expiresAt: Date.now() + TTL_MS });
}

function invalidate(userId) {
  cache.delete(userId);
}

module.exports = { get, set, invalidate };
