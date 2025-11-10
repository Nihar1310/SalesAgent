/**
 * Role-based access control middleware
 */

/**
 * Requires user to be an active super admin
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Admin privileges required',
      code: 'ADMIN_REQUIRED'
    });
  }

  if (req.user.status !== 'active') {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Account is not active',
      code: 'ACCOUNT_NOT_ACTIVE'
    });
  }

  next();
}

/**
 * Requires user to have an active account (any role)
 */
function requireActive(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (req.user.status !== 'active') {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Account is not active or pending approval',
      code: 'ACCOUNT_NOT_ACTIVE'
    });
  }

  next();
}

/**
 * Blocks staff users from making edits (POST/PUT/DELETE)
 * Allows GET requests and admin users
 */
function blockStaffEdit(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Allow all GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Allow super_admin to do anything
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Block staff from POST/PUT/DELETE
  if (req.user.role === 'staff') {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Staff users cannot create, update, or delete this resource',
      code: 'STAFF_EDIT_FORBIDDEN'
    });
  }

  // Block pending users from everything except GET
  return res.status(403).json({ 
    error: 'Forbidden',
    message: 'Your account is pending approval',
    code: 'ACCOUNT_PENDING'
  });
}

/**
 * Allows only admin or the user themselves to access the resource
 */
function requireAdminOrSelf(userIdParam = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const targetUserId = parseInt(req.params[userIdParam]);
    
    // Allow if super admin or accessing own resource
    if (req.user.role === 'super_admin' || req.user.id === targetUserId) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  };
}

module.exports = {
  requireAdmin,
  requireActive,
  blockStaffEdit,
  requireAdminOrSelf
};

