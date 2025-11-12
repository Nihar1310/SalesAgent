import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Debug: Log env vars (remove in production)
const envCheck = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? `SET (${import.meta.env.VITE_FIREBASE_API_KEY.substring(0, 10)}...)` : 'MISSING',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'MISSING',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'MISSING',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'MISSING',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'MISSING',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'MISSING'
};
console.log('🔍 Firebase env vars check:', envCheck);
console.log('🌐 Current origin:', window.location.origin);
console.log('🔑 API Key (first 15 chars):', import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 15) || 'NOT SET');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.replace(/^"|"$/g, '').trim(), // Remove quotes if present
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.replace(/^"|"$/g, '').trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.replace(/^"|"$/g, '').trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.replace(/^"|"$/g, '').trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.replace(/^"|"$/g, '').trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.replace(/^"|"$/g, '').trim()
};

// Validate required fields
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field] || firebaseConfig[field] === '');

if (missingFields.length > 0) {
  console.error('❌ Missing Firebase config:', missingFields);
  console.error('Current config:', firebaseConfig);
  console.warn('⚠️  Firebase will not initialize. Please check your .env file.');
}

// Initialize Firebase only if config is valid
let app;
let auth;

if (missingFields.length === 0) {
  try {
    console.log('🚀 Attempting to initialize Firebase with config:', {
      apiKey: firebaseConfig.apiKey?.substring(0, 15) + '...',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      appId: firebaseConfig.appId
    });
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log('✅ Firebase initialized successfully');
    
    // Additional debug: Check auth settings
    if (auth) {
      console.log('📱 Auth domain:', auth.config.authDomain);
      console.log('🔐 API key matches:', auth.config.apiKey?.substring(0, 15) === firebaseConfig.apiKey?.substring(0, 15));
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed!');
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    console.error('Config used:', {
      apiKey: firebaseConfig.apiKey?.substring(0, 15) + '...',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId
    });
    auth = null;
    app = null;
  }
} else {
  console.error('⚠️  Skipping Firebase initialization due to missing config fields:', missingFields);
  console.error('Current config values:', {
    apiKey: firebaseConfig.apiKey || 'EMPTY',
    authDomain: firebaseConfig.authDomain || 'EMPTY',
    projectId: firebaseConfig.projectId || 'EMPTY',
    appId: firebaseConfig.appId || 'EMPTY'
  });
  auth = null;
  app = null;
}

export { auth };
export default app;

