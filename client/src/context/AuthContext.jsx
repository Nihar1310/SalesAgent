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
    
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          // Reset reCAPTCHA
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
      });
    }
    return window.recaptchaVerifier;
  };

  const loginWithPhone = async (phoneNumber) => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized. Please check your Firebase configuration in .env file.');
    }
    
    try {
      const recaptchaVerifier = setupRecaptcha('recaptcha-container');
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return confirmationResult;
    } catch (error) {
      console.error('Error sending OTP:', error);
      // Clean up reCAPTCHA on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
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

