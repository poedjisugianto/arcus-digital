import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Define the config type
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

// Dynamically check for firebase-applet-config.json if present
const appletConfigs = import.meta.glob('/firebase-applet-config.json', { eager: true }) as Record<string, any>;
const appletConfig = appletConfigs['/firebase-applet-config.json']?.default || appletConfigs['/firebase-applet-config.json'] || {};

const getFirebaseConfig = (): FirebaseConfig => {
  // Use environment variables (Vite style) with fallback to firebase-applet-config.json
  const envConfig: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || "",
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || "",
  };

  return envConfig;
};

const firebaseConfig = getFirebaseConfig();

const app = (() => {
  try {
    if (getApps().length > 0) return getApp();
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "") {
      console.warn("Firebase API Key is missing. Check your environment variables or firebase-applet-config.json");
      return null;
    }
    return initializeApp(firebaseConfig);
  } catch (err) {
    console.error("Firebase App initialization failed:", err);
    return null;
  }
})();

export const db = app ? (
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "" && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app)
) : null as any;
export const auth = app ? getAuth(app) : null as any;
export const storage = app ? getStorage(app) : null as any;

// Enable Offline Persistence to save quota reads
// Persistence is disabled as it often causes "Internal Assertion Failed" crashes 
// within the AI Studio sandboxed iframe environment due to storage restrictions.
/*
if (db) {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code === 'unimplemented') {
      console.warn("The current browser does not support all of the features required to enable persistence.");
    }
  });
}
*/

// Connection test removed to save daily Firestore read quota.
// App logic now handles connectivity state during actual data fetches.
