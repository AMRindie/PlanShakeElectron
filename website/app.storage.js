// ============================================
// PlanShake Unified Storage System
// ============================================
// Provides persistent storage across:
// - PC (Electron): Uses localStorage (backed up to file via electron-store if available)  
// - Mobile/PWA: Uses IndexedDB (survives Safari's 7-day localStorage purge)
// ============================================

const Storage = (function () {
    const DB_NAME = 'PlanShakeDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'keyvalue';

    let db = null;
    let isIndexedDBAvailable = false;

    // Check if IndexedDB is available
    function checkIndexedDB() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                resolve(false);
                return;
            }

            try {
                const request = indexedDB.open('__test__');
                request.onerror = () => resolve(false);
                request.onsuccess = () => {
                    indexedDB.deleteDatabase('__test__');
                    resolve(true);
                };
            } catch (e) {
                resolve(false);
            }
        });
    }

    // Initialize IndexedDB
    function initDB() {
        return new Promise((resolve, reject) => {
            if (db) {
                resolve(db);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.warn('IndexedDB error, falling back to localStorage');
                isIndexedDBAvailable = false;
                resolve(null);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                isIndexedDBAvailable = true;
                console.log('✅ IndexedDB initialized');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
        });
    }

    // Get value from storage
    async function get(key) {
        // Try IndexedDB first
        if (isIndexedDBAvailable && db) {
            try {
                const value = await getFromIndexedDB(key);
                if (value !== null) return value;
            } catch (e) {
                console.warn('IndexedDB get failed:', e);
            }
        }

        // Fallback to localStorage
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    }

    function getFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };
        });
    }

    // Set value in storage
    async function set(key, value) {
        // Save to IndexedDB
        if (isIndexedDBAvailable && db) {
            try {
                await setToIndexedDB(key, value);
            } catch (e) {
                console.warn('IndexedDB set failed:', e);
            }
        }

        // Also save to localStorage as backup
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('localStorage set error:', e);
        }
    }

    function setToIndexedDB(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ key, value });

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Remove value from storage
    async function remove(key) {
        // Remove from IndexedDB
        if (isIndexedDBAvailable && db) {
            try {
                await removeFromIndexedDB(key);
            } catch (e) {
                console.warn('IndexedDB remove failed:', e);
            }
        }

        // Remove from localStorage
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('localStorage remove error:', e);
        }
    }

    function removeFromIndexedDB(key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Clear all storage
    async function clear() {
        // Clear IndexedDB
        if (isIndexedDBAvailable && db) {
            try {
                await clearIndexedDB();
            } catch (e) {
                console.warn('IndexedDB clear failed:', e);
            }
        }

        // Clear localStorage (only app-related keys)
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('trelloLite') || key.startsWith('planshake'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            console.error('localStorage clear error:', e);
        }
    }

    function clearIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Initialize on load
    async function init() {
        const hasIDB = await checkIndexedDB();
        if (hasIDB) {
            await initDB();

            // Migrate data from localStorage to IndexedDB if needed
            await migrateFromLocalStorage();
        } else {
            console.log('IndexedDB not available, using localStorage only');
        }
    }

    // Migrate existing localStorage data to IndexedDB
    async function migrateFromLocalStorage() {
        const dataKey = 'trelloLiteData';
        const existing = localStorage.getItem(dataKey);

        if (existing && isIndexedDBAvailable && db) {
            try {
                const parsed = JSON.parse(existing);
                const idbData = await getFromIndexedDB(dataKey);

                // Only migrate if IndexedDB doesn't have the data yet
                if (!idbData) {
                    await setToIndexedDB(dataKey, parsed);
                    console.log('✅ Migrated data to IndexedDB');
                }
            } catch (e) {
                console.warn('Migration failed:', e);
            }
        }
    }

    // Auto-initialize
    init();

    return {
        get,
        set,
        remove,
        clear,
        init
    };
})();

// Make available globally
window.Storage = Storage;
