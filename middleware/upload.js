const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname?.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

function handleUploadError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Use form field name "resume".',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed',
    });
  }

  if (err?.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  return next(err);
}

module.exports = {
  uploadResume: upload.single('resume'),
  handleUploadError,
  MAX_FILE_SIZE,
};
