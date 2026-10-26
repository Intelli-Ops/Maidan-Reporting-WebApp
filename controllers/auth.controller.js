const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const userAuthCache = require('../services/userAuthCache');
const emailService = require('../services/email.service');
const auditLog = require('../services/auditLog.service');
const config = require('../config');

async function register(req, res, next) {
  try {
    // Only these fields are ever read from the body — role is never
    // accepted here, no matter what the request contains, since role
    // assignment only happens through the admin approval flow.
    const { email, password, fullName, phone } = req.body;

    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
    }

    const user = await authService.createUser({
      email,
      password,
      fullName,
      phone,
      role: null,
      status: 'pending',
    });
    delete user.password_hash;

    res.status(201).json({
      success: true,
      message: 'Registration received. Your account is pending admin approval.',
      data: { user },
    });
  } catch (err) {
    // Two concurrent registrations for the same email both pass the
    // pre-check above and race to the DB's UNIQUE constraint — the loser
    // gets the same friendly message the pre-check would have given it,
    // instead of a raw constraint-violation error.
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const invalidCredentials = () =>
      res.status(401).json({
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        error: 'Invalid email or password.',
      });

    const user = await authService.findUserByEmail(email);
    if (!user) {
      // Still runs a real bcrypt compare (against a fixed dummy hash) rather
      // than returning immediately, so this branch takes a comparable amount
      // of time to the "wrong password" branch below — otherwise the two are
      // distinguishable by response time alone, defeating the whole point of
      // the identical response body/status.
      await authService.verifyPasswordTimingSafe(password, null);
      return invalidCredentials();
    }

    // Per-account lockout, independent of source IP — loginLimiter alone
    // doesn't slow an attacker spreading guesses across many IPs against one
    // known account. Checked before the password compare since there's no
    // reason to spend a bcrypt cycle on a request that's rejected either way.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        success: false,
        errorCode: 'ACCOUNT_LOCKED',
        error: 'Too many failed login attempts. Please try again in a few minutes.',
      });
    }

    // Verify the password before revealing anything about account state,
    // so an attacker probing emails without the correct password can't
    // learn whether an account exists or is pending/rejected/deactivated.
    const isMatch = await authService.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      await authService.recordFailedLogin(user.id);
      return invalidCredentials();
    }
    await authService.clearFailedLogins(user.id);

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        errorCode: 'PENDING_APPROVAL',
        error: 'Your account is pending admin approval.',
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        errorCode: 'ACCOUNT_REJECTED',
        error: 'Your registration was not approved. Please contact an administrator.',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        errorCode: 'ACCOUNT_DEACTIVATED',
        error: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        canUpload: user.can_upload,
        canUseAiChat: user.can_use_ai_chat,
        tv: user.token_version,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    delete user.password_hash;
    delete user.reset_token_hash;
    delete user.reset_token_expires_at;
    delete user.token_version;
    delete user.failed_login_attempts;
    delete user.locked_until;

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found.',
      });
    }
    delete user.token_version;

    res.json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

async function listPendingUsers(req, res, next) {
  try {
    const users = await authService.findPendingUsers();
    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    next(err);
  }
}

async function approveUser(req, res, next) {
  try {
    const { role, canUpload, canUseAiChat } = req.body;

    // Only an admin can grant the admin role — an operations_manager
    // approving registrations must not be able to escalate someone to admin.
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only an admin can grant the admin role.',
      });
    }

    const updated = await authService.approveUser({
      id: req.params.id,
      role,
      canUpload: canUpload === true,
      canUseAiChat: canUseAiChat === true,
      approvedByUserId: req.user.id,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Pending user not found, or already processed.',
      });
    }

    auditLog.record({
      actorUserId: req.user.id,
      action: 'user.approve',
      targetType: 'user',
      targetId: String(updated.id),
      metadata: { email: updated.email, role: updated.role, canUpload: updated.can_upload, canUseAiChat: updated.can_use_ai_chat },
    });

    res.json({
      success: true,
      message: 'User approved.',
      data: { user: updated },
    });
  } catch (err) {
    next(err);
  }
}

async function rejectUser(req, res, next) {
  try {
    const { reason } = req.body;

    const updated = await authService.rejectUser({
      id: req.params.id,
      reason: reason || null,
      approvedByUserId: req.user.id,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Pending user not found, or already processed.',
      });
    }

    auditLog.record({
      actorUserId: req.user.id,
      action: 'user.reject',
      targetType: 'user',
      targetId: String(updated.id),
      metadata: { email: updated.email, reason: reason || null },
    });

    res.json({
      success: true,
      message: 'User rejected.',
      data: { user: updated },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password
// Body: { email }. Emails a 6-digit OTP (via Brevo) to the address on file —
// proof the requester controls that inbox, not just knowledge of a fact
// about the account. Always returns the same generic message regardless of
// whether the email matches an account, so this can't be used to probe which
// emails are registered. In non-production, the raw OTP is also echoed back
// in the response as devOtp — there's no test inbox to read otherwise, and
// this disappears automatically once NODE_ENV=production in a real
// deployment.
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const genericResponse = (extra) =>
      res.json({
        success: true,
        message: 'If that email matches an account, a reset code has been sent.',
        ...(extra ? { data: extra } : {}),
      });

    if (!config.brevoApiKey) {
      return res.status(503).json({
        success: false,
        error: 'Password reset email is not configured yet. Set BREVO_API_KEY to enable it.',
      });
    }

    const user = await authService.findUserByEmail(email);
    if (!user || user.status !== 'approved' || !user.is_active) {
      return genericResponse();
    }

    const { rawOtp } = await authService.setResetOtp(user.id);

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Reset your Maidan Sports Complex password',
        html: emailService.buildOtpEmailHtml(rawOtp),
      });
    } catch (emailErr) {
      // Don't let an email-provider hiccup turn into an account-enumeration
      // signal — log it server-side and still respond generically.
      console.error('Failed to send password reset email:', emailErr);
    }

    // Explicit allow-list, not "anything that isn't 'production'" — an unset
    // or misconfigured NODE_ENV must never echo a real reset code back in
    // the response, since that defeats the whole point of emailing it.
    const devExtra = process.env.NODE_ENV === 'development' ? { devOtp: rawOtp } : undefined;
    return genericResponse(devExtra);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
// Body: { email, otp, newPassword }. Consumes the OTP emailed by
// forgot-password (single-use, 10-minute expiry) and sets the new password.
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await authService.findUserByResetOtp(email, otp);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'This reset code is invalid or has expired. Please request a new one.',
      });
    }

    await authService.resetPassword({ userId: user.id, newPassword });
    // Drop the cached snapshot immediately rather than waiting out its TTL,
    // so the bumped token_version (and thus a stolen pre-reset token's
    // invalidation) takes effect on this user's very next request.
    userAuthCache.invalidate(user.id);

    res.json({
      success: true,
      message: 'Password has been reset. You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/change-password
// Body: { currentPassword, newPassword }. For a logged-in user changing
// their own password — requires proving the current one first.
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await authService.findUserWithPasswordHashById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const isMatch = await authService.verifyPassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    await authService.changePassword({ userId: user.id, newPassword });
    userAuthCache.invalidate(user.id);

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/users
// Admin-only: every user regardless of status, for a user-management screen.
async function listAllUsers(req, res, next) {
  try {
    const users = await authService.findAllUsers();
    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/auth/users/:id
// Admin/operations_manager: edit an already-approved user's role / upload
// rights / active status. Escalation guards, in the order they're applied
// below:
//   1. Nobody can lock themselves out through their own row (self-guard).
//   2. Only an admin can grant the admin role.
//   3. The account carrying is_system_admin is editable only by itself.
//   4. An operations_manager can't touch an account that's already an admin
//      at all (any field), not just the role — without this they could leave
//      role alone and still deactivate an admin, or strip their access.
//   5. Role and active status on an admin account are reserved to the system
//      administrator. Guard 4 stops the lesser roles; this one stops one
//      admin re-grading another, which is otherwise a lateral move into
//      control of the whole account set.
async function updateUser(req, res, next) {
  try {
    // is_system_admin is deliberately absent from this list, and from the SET
    // clause in authService.updateUser. No request body can set or clear it,
    // at any privilege level.
    const { role, canUpload, canUseAiChat, isActive } = req.body;

    // Same self-lockout guard deleteUser already had. Nothing stopped an
    // admin PATCHing their OWN id with isActive:false or a lesser role —
    // authenticateToken rejects the account on the very next request, and if
    // they were the only admin there is then no one left who can undo it.
    // The UI hides these controls for your own row, but the API is the
    // boundary that has to hold; a direct call bypassed it entirely.
    if (Number(req.params.id) === req.user.id) {
      if (isActive === false) {
        return res.status(400).json({
          success: false,
          error: 'You cannot deactivate your own account.',
        });
      }
      if (role !== undefined && role !== req.user.role) {
        return res.status(400).json({
          success: false,
          error: 'You cannot change your own role.',
        });
      }
    }

    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only an admin can grant the admin role.',
      });
    }

    const target = await authService.findUserById(req.params.id);

    if (target?.is_system_admin && target.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'This account can only be changed by its owner.',
      });
    }

    if (req.user.role !== 'admin' && target?.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only an admin can change another admin\'s settings.',
      });
    }

    // Compared against the stored values rather than merely being present,
    // because the edit form always submits all four fields — a request that
    // resends the same role and status is not a change and shouldn't be
    // rejected. Only an actual re-grade is.
    const changesRole = role !== undefined && role !== target?.role;
    const changesActive = isActive !== undefined && isActive !== target?.is_active;
    if (
      target?.role === 'admin' &&
      target.id !== req.user.id &&
      !req.user.isSystemAdmin &&
      (changesRole || changesActive)
    ) {
      return res.status(403).json({
        success: false,
        error:
          'Only the system administrator can change another administrator’s role or account status.',
      });
    }

    const updated = await authService.updateUser({
      id: req.params.id,
      role,
      canUpload,
      canUseAiChat,
      isActive,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Approved user not found.',
      });
    }

    // Drop the cached permission snapshot so this change is visible on the
    // user's very next request instead of waiting out the cache's TTL.
    userAuthCache.invalidate(updated.id);

    auditLog.record({
      actorUserId: req.user.id,
      action: 'user.update',
      targetType: 'user',
      targetId: String(updated.id),
      metadata: { email: updated.email, role, canUpload, canUseAiChat, isActive },
    });

    res.json({
      success: true,
      message: 'User updated.',
      data: { user: updated },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/auth/users/:id
// Admin/operations_manager: permanently remove an account. Guards against
// locking yourself out (self-delete), against deleting the system
// administrator's account at all, and against anyone but the system
// administrator deleting an admin account — deletion is the other way to
// remove an admin, so it carries the same restriction updateUser puts on
// role and active status. A foreign-key violation (this account is on record as having
// approved someone else) is reported as a clear 409 rather than a 500.
async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account.',
      });
    }

    const target = await authService.findUserById(id);
    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }
    if (target.is_system_admin) {
      return res.status(403).json({
        success: false,
        error: 'This account cannot be deleted.',
      });
    }
    if (target.role === 'admin' && !req.user.isSystemAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only the system administrator can delete an administrator account.',
      });
    }

    await authService.deleteUser(id);
    userAuthCache.invalidate(id);

    auditLog.record({
      actorUserId: req.user.id,
      action: 'user.delete',
      targetType: 'user',
      targetId: String(id),
      metadata: { email: target.email, role: target.role },
    });

    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        success: false,
        error: 'This account approved other registrations and cannot be deleted.',
      });
    }
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  listPendingUsers,
  approveUser,
  rejectUser,
  forgotPassword,
  resetPassword,
  changePassword,
  listAllUsers,
  updateUser,
  deleteUser,
};
