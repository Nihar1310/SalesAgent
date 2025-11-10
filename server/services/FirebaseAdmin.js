const admin = require('firebase-admin');

class FirebaseAdmin {
  constructor() {
    this.initialized = false;
    this.app = null;
  }

  initialize() {
    if (this.initialized) {
      return this.app;
    }

    try {
      // Check if Firebase credentials are provided
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        console.warn('⚠️  Firebase Admin: Credentials not found. Auth middleware will be disabled.');
        return null;
      }

      // Initialize Firebase Admin
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n') // Handle escaped newlines
        })
      });

      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
      
      return this.app;
    } catch (error) {
      console.error('❌ Firebase Admin initialization failed:', error.message);
      return null;
    }
  }

  async verifyIdToken(idToken) {
    if (!this.initialized || !this.app) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error('Token verification failed:', error.message);
      throw error;
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

// Singleton instance
const firebaseAdmin = new FirebaseAdmin();

module.exports = firebaseAdmin;

