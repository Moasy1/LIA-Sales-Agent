import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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

export { app, db, storage, analytics };