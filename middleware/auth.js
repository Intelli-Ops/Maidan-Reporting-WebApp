const jwt = require('jsonwebtoken');
const config = require('../config');
const authService = require('../services/auth.service');
const userAuthCache = require('../services/userAuthCache');

// Marks a failure of the SESSION ITSELF (no token, bad token, dead account,
// token outlived a password change) as opposed to a permission failure on an
// otherwise-valid session. The client keys its "clear the token and send them
// to /login" behaviour off this code.
//
// It used to have to infer that by matching the exact error strings below,
// and the password-change message was missing from its list — so after
// changing their password a user sat in a dead session where every request
// 401'd and nothing ever redirected them back to login. A code the two sides
// agree on cannot drift the way a copied sentence can.
const SESSION_INVALID = 'SESSION_INVALID';

// The JWT's own claims (role/canUpload/canUseAiChat/etc.) are a snapshot from
// whenever it was issued — up to JWT_EXPIRES_IN old. Rather than trust them,
// re-fetch the user's current row on every request and build req.user from
// that instead, so an admin revoking a role, upload rights, AI chat access,
// or deactivating the account entirely takes effect on this user's very next
// request — not whenever their existing token happens to expire.
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      errorCode: SESSION_INVALID,
      error: 'Access denied. No authentication token provided.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(403).json({
      success: false,
      errorCode: SESSION_INVALID,
      error: 'Invalid or expired authentication token.',
    });
  }

  try {
    let user = userAuthCache.get(decoded.id);
    if (!user) {
      user = await authService.findUserById(decoded.id);
      if (user) userAuthCache.set(decoded.id, user);
    }

    if (!user || user.status !== 'approved' || !user.is_active) {
      return res.status(401).json({
        success: false,
        errorCode: SESSION_INVALID,
        error: 'This account is no longer active. Please contact an administrator.',
      });
    }

    // decoded.tv is absent on tokens issued before token_version existed —
    // those stay valid until they naturally expire (a soft rollout, not a
    // forced logout of every session the moment this shipped). A token
    // issued after this shipped that doesn't match the user's current
    // token_version was minted before their last password change/reset —
    // reject it so a stolen token doesn't outlive that change.
    if (decoded.tv !== undefined && decoded.tv !== user.token_version) {
      return res.status(401).json({
        success: false,
        errorCode: SESSION_INVALID,
        error: 'Your session is no longer valid — your password was changed. Please log in again.',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      canUpload: user.can_upload,
      canUseAiChat: user.can_use_ai_chat,
      // Read from the database row like every other field here, never from
      // the token — see the note above authenticateToken. A JWT minted
      // before the flag changed must not keep asserting the old value.
      isSystemAdmin: user.is_system_admin === true,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. User role not identified.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

// Upload access is a per-user flag assigned at approval time (or later),
// independent of role — a manager type other than admin only gets it if
// explicitly granted. Admins always retain upload rights regardless of
// the flag.
function requireUploadRights(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. User role not identified.',
    });
  }

  if (req.user.role !== 'admin' && !req.user.canUpload) {
    return res.status(403).json({
      success: false,
      error: 'You do not have rights to upload files. Please contact an administrator.',
    });
  }

  next();
}

// Same per-user-flag pattern as requireUploadRights, for the AI chatbot
// endpoint — a brand-new feature, so unlike upload rights nobody but admins
// gets it by default; everyone else needs it explicitly granted.
function requireAiChatAccess(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. User role not identified.',
    });
  }

  if (req.user.role !== 'admin' && !req.user.canUseAiChat) {
    return res.status(403).json({
      success: false,
      error: 'You do not have rights to use the AI chatbot. Please contact an administrator.',
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireUploadRights,
  requireAiChatAccess,
};
