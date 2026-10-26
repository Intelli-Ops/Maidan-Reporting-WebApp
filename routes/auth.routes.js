const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  registerValidation,
  loginValidation,
  approveValidation,
  rejectValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateUserValidation,
  deleteUserValidation,
} = require('../middleware/validators/auth.validators');
const { loginLimiter, registerLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/register', registerLimiter, registerValidation, validate, authController.register);
router.post('/login', loginLimiter, loginValidation, validate, authController.login);
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);
router.post('/reset-password', forgotPasswordLimiter, resetPasswordValidation, validate, authController.resetPassword);

// Protected routes — any authenticated user
router.get('/me', authenticateToken, authController.getMe);
router.post(
  '/change-password',
  authenticateToken,
  changePasswordValidation,
  validate,
  authController.changePassword
);

// Protected routes — admin and operations_manager (registration approval)
router.get(
  '/pending-users',
  authenticateToken,
  authorizeRoles('admin', 'operations_manager'),
  authController.listPendingUsers
);
router.post(
  '/pending-users/:id/approve',
  authenticateToken,
  authorizeRoles('admin', 'operations_manager'),
  approveValidation,
  validate,
  authController.approveUser
);
router.post(
  '/pending-users/:id/reject',
  authenticateToken,
  authorizeRoles('admin', 'operations_manager'),
  rejectValidation,
  validate,
  authController.rejectUser
);

// Protected routes — admin and operations_manager (user management beyond
// initial approval: view everyone, edit an already-approved user's
// role/upload-rights/active status)
router.get(
  '/users',
  authenticateToken,
  authorizeRoles('admin', 'operations_manager'),
  authController.listAllUsers
);
router.patch(
  '/users/:id',
  authenticateToken,
  authorizeRoles('admin', 'operations_manager'),
  updateUserValidation,
  validate,
  authController.updateUser
);
router.delete(
  '/users/:id',
  authenticateToken,
  authorizeRoles('admin', 'operations_manager'),
  deleteUserValidation,
  validate,
  authController.deleteUser
);

module.exports = router;
