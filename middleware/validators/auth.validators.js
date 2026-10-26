const { body, param } = require('express-validator');
const config = require('../../config');

// Shared strength rule for any field that receives a new password
// (registration, reset, change) — kept in one place so the rule can't drift
// between flows.
function passwordStrengthRule(field) {
  return body(field)
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter.')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter.')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number.');
}

const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters.'),
  body('email')
    .trim()
    .notEmpty()
    .isEmail()
    .withMessage('A valid email is required.')
    .custom((value) => !config.requireCompanyEmail || value.toLowerCase().endsWith('@maidan.pk'))
    .withMessage('Registration is restricted to @maidan.pk company email addresses.'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required.')
    .matches(/^\+?[0-9]{7,15}$/)
    .withMessage('Phone must be a valid number (7-15 digits, optional leading +).'),
  passwordStrengthRule('password'),
];

const loginValidation = [
  body('email').trim().notEmpty().isEmail().withMessage('A valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const approveValidation = [
  param('id').isInt({ min: 1 }).toInt(),
  body('role')
    .notEmpty()
    .isIn(['admin', 'operations_manager', 'viewer'])
    .withMessage("Role must be one of 'admin', 'operations_manager', 'viewer'."),
  body('canUpload')
    .optional()
    .isBoolean()
    .withMessage('canUpload must be a boolean.')
    .toBoolean(),
  body('canUseAiChat')
    .optional()
    .isBoolean()
    .withMessage('canUseAiChat must be a boolean.')
    .toBoolean(),
];

const rejectValidation = [
  param('id').isInt({ min: 1 }).toInt(),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason must be under 500 characters.'),
];

const forgotPasswordValidation = [
  body('email').trim().notEmpty().isEmail().withMessage('A valid email is required.'),
];

const resetPasswordValidation = [
  body('email').trim().notEmpty().isEmail().withMessage('A valid email is required.'),
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('Reset code is required.')
    .bail()
    .matches(/^\d{6}$/)
    .withMessage('Reset code must be 6 digits.'),
  passwordStrengthRule('newPassword'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  passwordStrengthRule('newPassword'),
];

const updateUserValidation = [
  param('id').isInt({ min: 1 }).toInt(),
  body('role')
    .optional()
    .isIn(['admin', 'operations_manager', 'viewer'])
    .withMessage("Role must be one of 'admin', 'operations_manager', 'viewer'."),
  body('canUpload').optional().isBoolean().withMessage('canUpload must be a boolean.').toBoolean(),
  body('canUseAiChat').optional().isBoolean().withMessage('canUseAiChat must be a boolean.').toBoolean(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.').toBoolean(),
];

const deleteUserValidation = [param('id').isInt({ min: 1 }).toInt()];

module.exports = {
  registerValidation,
  loginValidation,
  approveValidation,
  rejectValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateUserValidation,
  deleteUserValidation,
};
