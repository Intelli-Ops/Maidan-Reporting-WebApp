require('dotenv').config();

const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}. Refusing to start with an insecure default.`);
  }
}

// 32 bytes is the minimum recommended entropy for an HS256 signing key —
// short enough to be typo'd during setup, so this catches something like
// JWT_SECRET=changeme before it ever signs a real token.
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is too short (must be at least 32 characters). Generate a long random secret.');
}

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '6h',
  // Accepts a comma-separated list, e.g.
  //   CORS_ORIGIN=https://maidan-web.vercel.app,http://localhost:5173
  // A bare '*' keeps the old wildcard behaviour for local work.
  //
  // A list is needed because Vercel gives every branch and pull request its
  // own preview deployment on a generated hostname
  // (maidan-web-git-<branch>-<account>.vercel.app). Pinning CORS_ORIGIN to the
  // production URL alone would leave every preview failing CORS, which looks
  // like a broken build rather than a config choice; leaving it as '*' to
  // avoid that gives up the protection entirely.
  corsOrigin: (() => {
    const raw = (process.env.CORS_ORIGIN || '*').trim();
    if (raw === '*') return '*';

    const allowed = raw
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    // Opt-in: only trust preview hostnames when a project is named, so this
    // can never widen to "any *.vercel.app".
    const previewProject = (process.env.VERCEL_PREVIEW_PROJECT || '').trim();
    const previewPattern = previewProject
      ? new RegExp(`^https://${previewProject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[a-z0-9-]+\\.vercel\\.app$`)
      : null;

    return (origin, callback) => {
      // No Origin header at all: curl, Postman, server-to-server, or the
      // platform's health check. Not a browser, so the same-origin policy is
      // not in play and there is nothing to protect.
      if (!origin) return callback(null, true);

      const normalised = origin.replace(/\/+$/, '');
      if (allowed.includes(normalised)) return callback(null, true);
      if (previewPattern && previewPattern.test(normalised)) return callback(null, true);

      // Returning false (not an Error) makes the cors package omit the
      // Access-Control-Allow-Origin header, so the browser blocks the response
      // — rather than the request 500ing, which would look like a server fault.
      return callback(null, false);
    };
  })(),
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  // Optional — the AI chatbot endpoint (/api/ai/ask) is disabled with a 503
  // rather than crashing server startup when this is unset, since it's an
  // add-on feature, not core to the app.
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  // "-latest" alias lets Google roll the underlying model forward without
  // this needing an update every time a specific version is retired (which
  // is what happened testing this: gemini-2.5-flash and gemini-3.5-flash both
  // 404'd/rate-limited for a brand-new API key within the same session).
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
  // Optional — forgot-password is disabled with a 503 (not a crash) when
  // unset. Whoever owns the Brevo account (client, in production) supplies
  // their own key; nothing here depends on a specific account.
  brevoApiKey: process.env.BREVO_API_KEY || null,
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || null,
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'Maidan Sports Complex',
  // Registration is restricted to @maidan.pk addresses by default (see
  // middleware/validators/auth.validators.js) — set to 'false' only for
  // pre-launch testing before real company mailboxes exist. Flip it back
  // (or just unset it) once @maidan.pk email is actually available.
  requireCompanyEmail: process.env.REQUIRE_COMPANY_EMAIL !== 'false',
};
