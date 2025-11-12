import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '../firebase';
import api from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [idToken, setIdToken] = useState(null);
  const [dbUser, setDbUser] = useState(null); // User metadata from SQLite

  useEffect(() => {
    // Check if Firebase auth is available
    if (!auth) {
      console.error('Firebase auth not initialized');
      setLoading(false);
      return;
    }

    // Listen for auth state changes
    let unsubscribe;
    try {
      unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        setUser(firebaseUser);
        
        if (firebaseUser) {
          // Get fresh ID token
          try {
            const token = await firebaseUser.getIdToken();
            setIdToken(token);
            localStorage.setItem('firebaseIdToken', token);
            
            // Fetch user metadata from backend
            try {
              const response = await api.get('/users/me');
              setDbUser(response.data);
            } catch (err) {
              console.error('Error fetching user metadata:', err);
              setDbUser(null);
            }
          } catch (error) {
            console.error('Error getting ID token:', error);
          }
        } else {
          setIdToken(null);
          setDbUser(null);
          localStorage.removeItem('firebaseIdToken');
        }
        
        setLoading(false);
      });
    } catch (error) {
      console.error('Error setting up auth listener:', error);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const setupRecaptcha = (elementId) => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized. Please check your Firebase configuration.');
    }
    
    // Clean up existing verifier if any
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.warn('Error clearing existing reCAPTCHA:', e);
      }
      window.recaptchaVerifier = null;
    }
    
    // Ensure the container element exists
    const container = document.getElementById(elementId);
    if (!container) {
      throw new Error(`reCAPTCHA container element "${elementId}" not found. Make sure it exists in the DOM.`);
    }
    
    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
        size: 'invisible',
        callback: () => {
          console.log('reCAPTCHA solved successfully');
        },
        'expired-callback': () => {
          console.warn('reCAPTCHA expired, resetting...');
          if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
          }
        }
      });
      
      // Render the reCAPTCHA (for invisible, this prepares it)
      window.recaptchaVerifier.render().then((widgetId) => {
        console.log('reCAPTCHA rendered with widget ID:', widgetId);
        window.recaptchaWidgetId = widgetId;
      }).catch((error) => {
        console.error('Error rendering reCAPTCHA:', error);
        throw new Error(`Failed to initialize reCAPTCHA: ${error.message}`);
      });
      
      return window.recaptchaVerifier;
    } catch (error) {
      console.error('Error setting up reCAPTCHA:', error);
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          // Ignore cleanup errors
        }
        window.recaptchaVerifier = null;
      }
      throw error;
    }
  };

  const loginWithPhone = async (phoneNumber) => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized. Please check your Firebase configuration in .env file.');
    }
    
    // Validate phone number format
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      throw new Error('Phone number must start with country code (e.g., +91 for India)');
    }
    
    let recaptchaVerifier = null;
    try {
      // Wait a bit to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      recaptchaVerifier = setupRecaptcha('recaptcha-container');
      
      // Wait for reCAPTCHA to be ready (for invisible, this should be quick)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Calling signInWithPhoneNumber with:', phoneNumber);
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      console.log('OTP sent successfully');
      return confirmationResult;
    } catch (error) {
      console.error('Error sending OTP:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Provide more helpful error messages
      if (error.code === 'auth/invalid-app-credential') {
        throw new Error('Firebase configuration error: Please check that localhost is added to authorized domains in Firebase Console and API key restrictions allow localhost.');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Phone authentication is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method → Phone.');
      } else if (error.code === 'auth/invalid-phone-number') {
        throw new Error('Invalid phone number format. Please use E.164 format (e.g., +919876543210).');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please try again later.');
      }
      
      // Clean up reCAPTCHA on error
      if (recaptchaVerifier || window.recaptchaVerifier) {
        try {
          (recaptchaVerifier || window.recaptchaVerifier).clear();
        } catch (e) {
          console.warn('Error clearing reCAPTCHA:', e);
        }
        window.recaptchaVerifier = null;
        window.recaptchaWidgetId = null;
      }
      
      throw error;
    }
  };

  const verifyOtp = async (confirmationResult, otp) => {
    try {
      const result = await confirmationResult.confirm(otp);
      // User is signed in, token will be set by onAuthStateChanged
      return result.user;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  };

  const registerUser = async (displayName = null) => {
    try {
      const response = await api.post('/users/register', { 
        displayName: displayName || user?.phoneNumber 
      });
      
      // Update dbUser with response
      if (response.data.user) {
        setDbUser(response.data.user);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  };

  const updateDisplayName = async (displayName) => {
    if (!dbUser?.id) {
      throw new Error('User not found');
    }

    try {
      const response = await api.put(`/users/${dbUser.id}/display-name`, { displayName });
      
      // Update local dbUser state
      if (response.data.user) {
        setDbUser(prev => ({
          ...prev,
          displayName: response.data.user.displayName
        }));
      }
      
      return response.data;
    } catch (error) {
      console.error('Error updating display name:', error);
      throw error;
    }
  };

  const logout = async () => {
    if (!auth) {
      console.warn('Firebase auth not initialized, clearing local state only');
      setUser(null);
      setIdToken(null);
      setDbUser(null);
      localStorage.removeItem('firebaseIdToken');
      return;
    }
    
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIdToken(null);
      setDbUser(null);
      localStorage.removeItem('firebaseIdToken');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const getIdToken = async (forceRefresh = false) => {
    if (!user) return null;
    
    try {
      const token = await user.getIdToken(forceRefresh);
      setIdToken(token);
      localStorage.setItem('firebaseIdToken', token);
      return token;
    } catch (error) {
      console.error('Error refreshing ID token:', error);
      return null;
    }
  };

  const value = {
    user,
    idToken,
    loading,
    dbUser,
    loginWithPhone,
    verifyOtp,
    registerUser,
    updateDisplayName,
    logout,
    getIdToken,
    isAuthenticated: !!user,
    // Role helpers
    isAdmin: dbUser?.role === 'super_admin' && dbUser?.status === 'active',
    isStaff: dbUser?.role === 'staff' && dbUser?.status === 'active',
    isPending: dbUser?.status === 'pending_approval',
    isActive: dbUser?.status === 'active',
    role: dbUser?.role || 'pending',
    status: dbUser?.status || 'pending_approval'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

