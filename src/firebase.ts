import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, getDocFromServer, Timestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// In a real scenario, this would be loaded from firebase-applet-config.json
// Since setup failed, we'll use placeholders or environment variables
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "PLACEHOLDER",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "PLACEHOLDER",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "PLACEHOLDER",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "PLACEHOLDER",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "PLACEHOLDER",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "PLACEHOLDER"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Helper to test connection
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}

export type { User as FirebaseUser };
export { Timestamp };
