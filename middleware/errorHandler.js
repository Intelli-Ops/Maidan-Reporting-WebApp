function errorHandler(err, req, res, next) {
  console.error('❌ Server Error:', err);

  const statusCode = err.statusCode || 500;
  // err.statusCode marks an operational error deliberately thrown with a
  // client-safe message (e.g. "already exists", "not found"). Anything
  // without one is an unexpected failure — often a raw driver/DB error whose
  // .message can contain column/constraint names — so it gets a generic
  // message instead of being forwarded to the client.
  const message = err.statusCode ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
