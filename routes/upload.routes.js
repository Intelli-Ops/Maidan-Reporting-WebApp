const express = require('express');
const multer = require('multer');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { authenticateToken, requireUploadRights } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      const err = new Error('Only .xlsx files are accepted.');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(authenticateToken, requireUploadRights, uploadLimiter);

router.post('/upload', (req, res, next) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) {
      err.statusCode = err.statusCode || 400; // multer errors (size limit, bad field) are client errors
      return next(err);
    }
    next();
  });
}, uploadController.upload);

module.exports = router;
