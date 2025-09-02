import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Debug: Log environment variables (remove in production)
console.log('Firebase Config Debug:', {
  hasApiKey: !!process.env.REACT_APP_FIREBASE_API_KEY,
  hasAuthDomain: !!process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  hasProjectId: !!process.env.REACT_APP_FIREBASE_PROJECT_ID,
  hasStorageBucket: !!process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  hasMessagingSenderId: !!process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  hasAppId: !!process.env.REACT_APP_FIREBASE_APP_ID,
});

// Validate required environment variables
const requiredEnvVars = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Check for missing variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => `REACT_APP_FIREBASE_${key.toUpperCase().replace(/([A-Z])/g, '_$1')}`);

if (missingVars.length > 0) {
  console.error('Missing Firebase environment variables:', missingVars);
  throw new Error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
}

// Your web app's Firebase configuration
const firebaseConfig = requiredEnvVars;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;