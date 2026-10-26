const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth.routes');
const facilityRoutes = require('./routes/facility.routes');
const categoryRoutes = require('./routes/category.routes');
const paymentMethodRoutes = require('./routes/paymentMethod.routes');
const sportTypeRoutes = require('./routes/sportType.routes');
const investorRoutes = require('./routes/investor.routes');
const bookingRoutes = require('./routes/booking.routes');
const expenseRoutes = require('./routes/expense.routes');
const uploadRoutes = require('./routes/upload.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const aiQueryRoutes = require('./routes/aiQuery.routes');

const app = express();

// Trust the first hop's X-Forwarded-For (reverse proxy / load balancer in
// front of the app in production) so express-rate-limit keys off the real
// client IP instead of the proxy's — without this, every request looks like
// it comes from the same IP and one abusive client can rate-limit everyone.
app.set('trust proxy', 1);

// Middlewares
app.use(helmet());
// Not a helmet default — this is a JSON API, so it never needs the camera,
// microphone, or geolocation regardless of what serves the frontend.
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
// credentials: true is deliberately omitted — the frontend authenticates
// with a Bearer token, not cookies, so there's nothing that needs it, and
// pairing it with the wildcard CORS_ORIGIN default browsers reject anyway
// (Access-Control-Allow-Origin: * is invalid alongside
// Access-Control-Allow-Credentials: true).
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
// Which commit is actually running, read from whatever the host injects at
// build time (Render sets RENDER_GIT_COMMIT; the others are there so moving
// host does not silently blind the check below).
//
// This exists because a frozen deployment is indistinguishable from a healthy
// one: the Vercel frontend served a two-month-old build while answering every
// request with a cheerful 200, and nothing noticed until someone asked why a
// feature was missing. Reporting the commit lets scripts/check_deployment.js
// compare what is LIVE against what is on main, and fail loudly when they
// drift. 'unknown' is reported rather than throwing, so the endpoint still
// works in local development and on a host that injects nothing.
const DEPLOYED_COMMIT =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.SOURCE_VERSION ||
  'unknown';

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    // Safe to expose: a bare SHA against a private repo identifies nothing on
    // its own, and the check has to run without a credential to be reliable.
    commit: DEPLOYED_COMMIT,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/sport-types', sportTypeRoutes);
app.use('/api/investors', investorRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/admin', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiQueryRoutes);

// Serve the built frontend from the same origin as the API.
//
// The frontend calls the API at a RELATIVE path ('/api/...', see
// frontend/src/api/client.ts). In development the Vite dev server proxies
// that to :5000 (frontend/vite.config.ts), but that proxy does not exist in
// a build — so in production something has to answer both '/' and '/api'
// on one origin, or every API call 404s against the static host.
//
// Serving dist from Express is that something. It also means the app has no
// idea what domain it is on: no API base URL to configure, no CORS between
// the two halves, and moving to a real domain later is a DNS change rather
// than a rebuild.
//
// Guarded on the directory existing so 'npm run dev' still works with no
// build present — there, Vite serves the frontend and this is skipped.
const DIST_PATH = path.join(__dirname, 'frontend', 'dist');

if (fs.existsSync(DIST_PATH)) {
  // Vite fingerprints filenames under /assets (index-a1b2c3d4.js), so those
  // are safe to cache forever — a change produces a new name. index.html is
  // NOT fingerprinted and must revalidate, or browsers keep loading an old
  // build that points at asset files the new deploy already deleted.
  app.use(
    express.static(DIST_PATH, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // SPA fallback: React Router owns the client-side routes, so a hard refresh
  // or a pasted link to /login or /dashboard must return index.html and let
  // the router sort it out. Anything under /api is deliberately excluded so a
  // wrong endpoint still returns the JSON 404 below instead of a page of HTML.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();
    // A path with a file extension was asking for a real file. express.static
    // already had its chance and did not find it, so this is a genuine 404 —
    // returning index.html here instead would hand the browser a page of HTML
    // where it expected JavaScript, and it fails with the very unhelpful
    // "Unexpected token '<'" rather than a missing-file error.
    if (path.extname(req.path)) return next();
    // no-cache here too: this response IS index.html, and express.static's
    // setHeaders above does not run for sendFile.
    res.sendFile(path.join(DIST_PATH, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
}

// 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Middleware
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`🚀 Maidan Backend Server running on port ${config.port}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
