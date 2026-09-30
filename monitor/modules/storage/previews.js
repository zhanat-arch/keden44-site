const DB_NAME = 'keden44-control';
const STORE_NAME = 'first-page-previews';
const DOCUMENT_STORE_NAME = 'support-documents';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      if (!request.result.objectStoreNames.contains(DOCUMENT_STORE_NAME)) request.result.createObjectStore(DOCUMENT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export function saveFirstPagePreview(recordId, blob) {
  return transact('readwrite', store => store.put(blob, recordId));
}

export function getFirstPagePreview(recordId) {
  return transact('readonly', store => store.get(recordId));
}

export function deleteFirstPagePreview(recordId) {
  return transact('readwrite', store => store.delete(recordId));
}

async function transactStore(storeName, mode, action) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export function saveSupportDocument(recordId, file) {
  return transactStore(DOCUMENT_STORE_NAME, 'readwrite', store => store.put({ blob: file, name: file.name, type: file.type }, recordId));
}

export function getSupportDocument(recordId) {
  return transactStore(DOCUMENT_STORE_NAME, 'readonly', store => store.get(recordId));
}

export function deleteSupportDocument(recordId) {
  return transactStore(DOCUMENT_STORE_NAME, 'readwrite', store => store.delete(recordId));
}
