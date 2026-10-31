import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence verbose internal backoff and retry warnings from the Firestore SDK
try {
  setLogLevel('silent');
} catch (_) {}

// Safely get env in both Vite and Node environments
const env = (typeof import.meta !== 'undefined' && import.meta?.env) ? import.meta.env : ((typeof process !== 'undefined' && process?.env) ? process.env : {} as any);

const rawDbId = env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any).firestoreDatabaseId;
// If the database ID looks like a Google Analytics Measurement ID (starts with G-), fall back to the correct Firestore database ID
const finalDbId = (rawDbId && rawDbId.trim().startsWith('G-')) ? (firebaseConfig as any).firestoreDatabaseId : rawDbId;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: finalDbId
};

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId);

// Enable multi-tab persistence if in browser without locking single tabs
if (typeof window !== 'undefined') {
  import('firebase/firestore').then(({ enableMultiTabIndexedDbPersistence }) => {
    if (typeof enableMultiTabIndexedDbPersistence === 'function') {
      enableMultiTabIndexedDbPersistence(db).catch(() => {});
    }
  }).catch(() => {});
}

