const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts from this network. Please try again later.' },
});

// Without an email/SMS channel, forgot-password is verified by email+phone
// alone — rate limiting is the main defense against someone brute-forcing
// phone numbers for a known email address.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many password reset attempts. Please try again in 15 minutes.' },
});

// The Gemini free tier is a shared, low quota (tens of requests/minute across
// the whole app) — this limiter protects it from one user's chatbot usage
// starving everyone else, independent of the DB-safety validation in
// aiQuery.service.js.
const aiQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI chatbot questions. Please try again in 15 minutes.' },
});

// Uploads can carry up to 20 files x 50MB each into memory per request
// (multer.memoryStorage()) — this bounds how often an authenticated
// upload-rights account can fire that off, independent of the per-file size
// cap already enforced in routes/upload.routes.js.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many upload requests. Please try again in 15 minutes.' },
});

module.exports = { loginLimiter, registerLimiter, forgotPasswordLimiter, aiQueryLimiter, uploadLimiter };
