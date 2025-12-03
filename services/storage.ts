
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
 * Helper to update a session's sync status in DB
 */
const markSessionAsSynced = async (id: string) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const data = request.result as ArchivedSession;
      if (data) {
        data.synced = true;
        store.put(data);
      }
    };
  } catch (err) {
    console.error("Failed to mark session as synced", err);
  }
};

/**
 * --- BACKEND INTEGRATION POINT ---
 * Configured to use VITE_BACKEND_URL from process.env (injected by Vite).
 */
const getBackendUrl = () => {
    let url = process.env.VITE_BACKEND_URL || '';
    // Remove trailing slash if present to avoid double slashes
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
};

const uploadSessionToBackend = async (session: ArchivedSession): Promise<boolean> => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
        console.log("Skipping server upload: VITE_BACKEND_URL not set.");
        return false;
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

        // Adjust endpoint '/api/sessions' based on your actual Vercel backend route
        const response = await fetch(`${backendUrl}/api/sessions`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        console.log("Session successfully uploaded to backend!");
        await markSessionAsSynced(session.id);
        return true;

    } catch (error) {
        console.error("Failed to upload session to backend:", error);
        return false;
    }
}

/**
 * Save a session to the Local Database (IndexedDB).
 * Sets synced=false initially, then attempts upload.
 */
export const saveSessionToDb = async (session: ArchivedSession): Promise<void> => {
  try {
    // Initialize as not synced
    session.synced = false;

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    store.put(session);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('Session saved locally:', session.id);
        // Attempt immediate upload
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
        const results = request.result as ArchivedSession[];
        // Sort by date descending
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
 * Manually trigger synchronization for all pending sessions.
 * Call this from the "Sync Now" button in the dashboard.
 */
export const syncPendingSessions = async (): Promise<number> => {
  const sessions = await getAllSessionsFromDb();
  const pending = sessions.filter(s => !s.synced);
  
  if (pending.length === 0) return 0;

  console.log(`Attempting to sync ${pending.length} pending sessions...`);
  
  let successCount = 0;
  for (const session of pending) {
    const success = await uploadSessionToBackend(session);
    if (success) successCount++;
  }
  
  return successCount;
};
