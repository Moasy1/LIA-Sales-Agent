
import { ArchivedSession, KnowledgeItem } from '../types';

const DB_NAME = 'LIA_Voice_Agent_DB';
const STORE_SESSIONS = 'sessions';
const STORE_KNOWLEDGE = 'knowledge';
const DB_VERSION = 2; // Upgraded to support Knowledge Store

/**
 * Open the IndexedDB database.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create Sessions Store
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }

      // Create Knowledge Store (New in v2)
      if (!db.objectStoreNames.contains(STORE_KNOWLEDGE)) {
        db.createObjectStore(STORE_KNOWLEDGE, { keyPath: 'id' });
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
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
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
 */
const getBackendUrl = () => {
    let url = process.env.VITE_BACKEND_URL || '';
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
 * Save a session to the Local Database.
 */
export const saveSessionToDb = async (session: ArchivedSession): Promise<void> => {
  try {
    session.synced = false;

    const db = await openDB();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    
    store.put(session);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('Session saved locally:', session.id);
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
 * Retrieve all sessions.
 */
export const getAllSessionsFromDb = async (): Promise<ArchivedSession[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
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
 * Trigger sync.
 */
export const syncPendingSessions = async (): Promise<number> => {
  const sessions = await getAllSessionsFromDb();
  const pending = sessions.filter(s => !s.synced);
  
  if (pending.length === 0) return 0;
  
  let successCount = 0;
  for (const session of pending) {
    const success = await uploadSessionToBackend(session);
    if (success) successCount++;
  }
  return successCount;
};

// --- KNOWLEDGE BASE FUNCTIONS ---

export const saveKnowledgeItem = async (item: KnowledgeItem): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_KNOWLEDGE, 'readwrite');
  const store = tx.objectStore(STORE_KNOWLEDGE);
  store.put(item);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getKnowledgeItems = async (): Promise<KnowledgeItem[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_KNOWLEDGE, 'readonly');
  const store = tx.objectStore(STORE_KNOWLEDGE);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
        // Sort active first, then date
        const res = request.result as KnowledgeItem[];
        res.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));
        resolve(res);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteKnowledgeItem = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_KNOWLEDGE, 'readwrite');
  const store = tx.objectStore(STORE_KNOWLEDGE);
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
