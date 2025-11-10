const firebaseAdmin = require('../services/FirebaseAdmin');
const User = require('../models/User');

// User model will be injected by the app
let userModel = null;

function setUserModel(model) {
  userModel = model;
}

/**
 * Middleware to verify Firebase ID tokens on protected routes
 * Attaches decoded user info and role/status to req.user if valid
 */
async function authenticateFirebaseToken(req, res, next) {
  try {
    // Skip auth if Firebase is not initialized (optional auth mode)
    if (!firebaseAdmin.isInitialized()) {
      console.warn('Firebase auth middleware: Firebase not initialized, skipping auth check');
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid token format'
      });
    }

    // Verify the ID token
    const decodedToken = await firebaseAdmin.verifyIdToken(idToken);
    
    // Look up user in SQLite database
    let dbUser = null;
    if (userModel) {
      dbUser = await userModel.findByFirebaseUid(decodedToken.uid);
      
      // Check if user exists and is active
      if (dbUser) {
        if (dbUser.status === 'inactive') {
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Your account has been deactivated. Please contact an administrator.',
            code: 'ACCOUNT_INACTIVE'
          });
        }
        
        if (dbUser.status === 'pending_approval') {
          return res.status(403).json({ 
            error: 'Forbidden',
            message: 'Your account is pending approval. Please wait for an administrator to approve your access.',
            code: 'ACCOUNT_PENDING'
          });
        }
      }
    }
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
      email: decodedToken.email,
      firebase: decodedToken,
      // Add database user info if available
      id: dbUser?.id || null,
      role: dbUser?.role || 'pending',
      status: dbUser?.status || 'pending_approval',
      displayName: dbUser?.display_name || null,
      dbUser: dbUser
    };

    next();
  } catch (error) {
    console.error('Firebase auth error:', error.message);
    
    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Token expired. Please sign in again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Token revoked. Please sign in again.',
        code: 'TOKEN_REVOKED'
      });
    }

    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid authentication token'
    });
  }
}

/**
 * Optional auth middleware - allows requests through but attaches user if token present
 */
async function optionalFirebaseAuth(req, res, next) {
  try {
    if (!firebaseAdmin.isInitialized()) {
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await firebaseAdmin.verifyIdToken(idToken);
      
      req.user = {
        uid: decodedToken.uid,
        phoneNumber: decodedToken.phone_number,
        email: decodedToken.email,
        firebase: decodedToken
      };
    }
  } catch (error) {
    // Don't block request, just don't attach user
    console.log('Optional auth: Token invalid or missing');
  }
  
  next();
}

module.exports = {
  authenticateFirebaseToken,
  optionalFirebaseAuth,
  setUserModel
};

