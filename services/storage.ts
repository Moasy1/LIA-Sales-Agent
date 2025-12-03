import { ArchivedSession } from '../types';

const DB_NAME = 'LIA_Voice_Agent_DB';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

/**
 * Open the IndexedDB database.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * Save a session to the Local Database (IndexedDB).
 * This persists Audio Blobs which localStorage cannot do.
 */
export const saveSessionToDb = async (session: ArchivedSession): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // We store the session object directly. IndexedDB handles Blobs automatically.
    store.put(session);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('Session saved to local DB:', session.id);
        // OPTIONAL: Trigger Backend Upload Here
        uploadSessionToBackend(session); 
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save session to DB:', err);
  }
};

/**
 * Retrieve all sessions from the Local Database.
 */
export const getAllSessionsFromDb = async (): Promise<ArchivedSession[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        // Sort by date descending (newest first)
        const results = request.result as ArchivedSession[];
        results.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load sessions:', err);
    return [];
  }
};

/**
 * --- BACKEND INTEGRATION POINT ---
 * When you have a real server (Node.js, Python, Supabase, etc.), 
 * configure the URL below.
 */
// Safely access environment variable to avoid runtime errors
const BACKEND_API_URL = (import.meta as any)?.env?.VITE_BACKEND_URL || ''; 

const uploadSessionToBackend = async (session: ArchivedSession) => {
    if (!BACKEND_API_URL) {
        // console.log("Skipping server upload: VITE_BACKEND_URL not set.");
        return;
    }

    try {
        const formData = new FormData();
        formData.append('id', session.id);
        formData.append('data', JSON.stringify({
            transcripts: session.transcripts,
            actions: session.actions,
            leads: session.leads,
            startTime: session.startTime,
            endTime: session.endTime
        }));

        if (session.audioBlob) {
            formData.append('audio', session.audioBlob, `session-${session.id}.webm`);
        }

        const response = await fetch(`${BACKEND_API_URL}/sessions`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Server returned error');
        console.log("Session successfully uploaded to backend!");

    } catch (error) {
        console.error("Failed to upload session to backend:", error);
    }
}