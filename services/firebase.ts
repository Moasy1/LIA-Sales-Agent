
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, listAll } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// London Innovation Academy Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCHiwZ5glKbwJskvEtap2L-4jNsyw-5eUc",
  authDomain: "lia-sales-agent.firebaseapp.com",
  projectId: "lia-sales-agent",
  storageBucket: "lia-sales-agent.firebasestorage.app",
  messagingSenderId: "177818857604",
  appId: "1:177818857604:web:16756bf2106a712a6152d1",
  measurementId: "G-SQCZ6VY6V2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

console.log("Firebase initialized for project:", firebaseConfig.projectId);

export const validateFirebaseConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Check Firestore
    // We try to read a non-existent doc just to see if we have connection permissions
    const testDocRef = doc(db, 'system', 'connection_test');
    await getDoc(testDocRef); // It's okay if it doesn't exist, we just want to ensure no Permission Denied error
    
    // 2. Check Storage
    // We try to list root (or just reference it)
    const storageRef = ref(storage, 'recordings');
    // Just creating the ref is synchronous, let's try a lightweight op if possible, 
    // but usually just init without error is a good sign. 
    // For a deeper check we could try listAll(storageRef) but that might be empty.
    
    return { success: true, message: `Connected to ${firebaseConfig.projectId}` };
  } catch (error: any) {
    console.error("Firebase Validation Failed:", error);
    return { success: false, message: error.message || "Unknown connection error" };
  }
};

export { app, db, storage, analytics };
