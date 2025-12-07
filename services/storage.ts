
import { ArchivedSession, KnowledgeItem } from '../types';
import { db, storage } from './firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const DB_NAME = 'LIA_Voice_Agent_DB';
const STORE_SESSIONS = 'sessions';
const STORE_KNOWLEDGE = 'knowledge';
const DB_VERSION = 2;

/**
 * Open the IndexedDB database.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }

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
 * --- FIREBASE INTEGRATION POINT ---
 */
const uploadSessionToBackend = async (session: ArchivedSession): Promise<boolean> => {
    if (!db || !storage) {
        console.log("Skipping sync: Firebase not initialized.");
        return false;
    }

    try {
        console.log(`Starting upload for session ${session.id}...`);

        let audioDownloadUrl = null;

        // 1. Upload Audio to Firebase Storage (if exists)
        if (session.audioBlob) {
            const storageRef = ref(storage, `recordings/session-${session.id}.webm`);
            // Validate MIME type for correct playback in console
            const metadata = {
              contentType: session.audioBlob.type || 'audio/webm',
            };
            await uploadBytes(storageRef, session.audioBlob, metadata);
            audioDownloadUrl = await getDownloadURL(storageRef);
            console.log("Audio uploaded:", audioDownloadUrl);
        }

        // 2. Prepare Data for Firestore
        // CRITICAL FIX: Firestore throws error on 'undefined'. We must convert undefined optional fields to null.
        // We also explicitly convert Date objects to ISO strings to ensure serialization works perfectly.
        const sessionData = {
            id: session.id,
            startTime: session.startTime.toISOString(),
            endTime: session.endTime.toISOString(),
            transcripts: session.transcripts.map(t => ({
                id: t.id,
                sender: t.sender,
                text: t.text,
                timestamp: t.timestamp.toISOString()
            })),
            actions: session.actions.map(a => ({
                id: a.id,
                type: a.type,
                details: a.details,
                status: a.status,
                timestamp: a.timestamp.toISOString()
            })),
            leads: session.leads.map(l => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                email: l.email || null,     // Fix: undefined -> null
                interest: l.interest || null, // Fix: undefined -> null
                timestamp: l.timestamp.toISOString()
            })),
            audioUrl: audioDownloadUrl || null,
            uploadedAt: new Date().toISOString()
        };

        // 3. Save Session Document
        await setDoc(doc(db, "sessions", session.id), sessionData);

        // 4. Save Leads to a separate collection for easier CRM management
        if (session.leads.length > 0) {
            const batch = writeBatch(db);
            session.leads.forEach(lead => {
                const leadRef = doc(db, "leads", lead.id);
                batch.set(leadRef, {
                    id: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email || null,
                    interest: lead.interest || null,
                    sessionId: session.id,
                    timestamp: lead.timestamp.toISOString()
                });
            });
            await batch.commit();
            console.log(`Synced ${session.leads.length} leads to CRM.`);
        }

        console.log("Session saved to Firestore!");
        await markSessionAsSynced(session.id);
        return true;

    } catch (error) {
        console.error("Failed to upload session to Firebase:", error);
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
        // Attempt immediate sync
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
// Note: Currently these only exist locally in IndexedDB. 
// In a full implementation, you would also sync these to a 'knowledge' collection in Firestore.

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
