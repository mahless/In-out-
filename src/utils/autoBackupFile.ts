import { AppStorageData } from '../types/work';
import { createBackupPayload, parseBackupJson } from './storage';

export const AUTO_BACKUP_DEFAULT_FILENAME = 'daftar-elshoghl-backup.json';
const DB_NAME = 'daftar_elshoghl_auto_backup_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'primary-backup-file';
const META_STORAGE_KEY = 'daftar_elshoghl_auto_backup_meta_v1';

export type AutoBackupSupport = 'supported' | 'unsupported';

export type AutoBackupStatus =
  | 'unsupported'
  | 'unlinked'
  | 'active'
  | 'syncing'
  | 'needs-permission'
  | 'blocked-iframe'
  | 'error';

export interface AutoBackupMeta {
  fileName: string;
  lastSyncedAt: string | null;
}

export interface AutoBackupSnapshot {
  supported: boolean;
  status: AutoBackupStatus;
  fileName: string | null;
  lastSyncedAt: string | null;
  unsyncedChangesCount: number;
  errorMessage: string | null;
}

export interface FileWritableLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  name: string;
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  createWritable: () => Promise<FileWritableLike>;
  getFile?: () => Promise<{ text: () => Promise<string> }>;
}

export interface HandleStoreLike {
  get(): Promise<FileHandleLike | null>;
  set(handle: FileHandleLike): Promise<void>;
  clear(): Promise<void>;
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
  );
}

export function serializeAutoBackupData(data: AppStorageData): string {
  const payload = createBackupPayload(data);
  return JSON.stringify(payload, null, 2);
}

/**
 * Fingerprint of user-meaningful data (excludes exportedAt timestamp) so we only
 * overwrite the single backup file when records, shift, or monthly rates actually change.
 */
export function getBackupContentSignature(data: AppStorageData): string {
  return JSON.stringify({
    selectedShift: data.selectedShift,
    entries: data.entries,
    monthlyHourlyRates: data.monthlyHourlyRates,
  });
}

export function loadAutoBackupMeta(): AutoBackupMeta | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.fileName !== 'string' || !parsed.fileName) return null;
    return {
      fileName: parsed.fileName,
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
    };
  } catch {
    return null;
  }
}

export function saveAutoBackupMeta(meta: AutoBackupMeta | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (!meta) {
      window.localStorage.removeItem(META_STORAGE_KEY);
    } else {
      window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function openHandlesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export function createIndexedDbHandleStore(): HandleStoreLike {
  return {
    async get() {
      const db = await openHandlesDb();
      return new Promise<FileHandleLike | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(HANDLE_KEY);
        req.onsuccess = () => resolve((req.result as FileHandleLike | undefined) ?? null);
        req.onerror = () => reject(req.error ?? new Error('Failed to read handle'));
        tx.oncomplete = () => db.close();
      });
    },
    async set(handle: FileHandleLike) {
      const db = await openHandlesDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(handle, HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Failed to save handle'));
        tx.oncomplete = () => db.close();
      });
    },
    async clear() {
      const db = await openHandlesDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(HANDLE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Failed to delete handle'));
        tx.oncomplete = () => db.close();
      });
    },
  };
}

export async function queryHandleWritePermission(
  handle: FileHandleLike
): Promise<PermissionState> {
  if (typeof handle.queryPermission === 'function') {
    return handle.queryPermission({ mode: 'readwrite' });
  }
  return 'granted';
}

export async function requestHandleWritePermission(
  handle: FileHandleLike
): Promise<PermissionState> {
  if (typeof handle.requestPermission === 'function') {
    return handle.requestPermission({ mode: 'readwrite' });
  }
  return 'granted';
}

export async function writeBackupToHandle(
  handle: FileHandleLike,
  data: AppStorageData
): Promise<void> {
  const content = serializeAutoBackupData(data);
  const writable = await handle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

export async function readBackupFromHandle(handle: FileHandleLike) {
  if (typeof handle.getFile !== 'function') {
    return {
      ok: false,
      error: 'المتصفح مش قادر يقرأ الملف المرتبط حاليًا.',
    };
  }
  const file = await handle.getFile();
  const text = await file.text();
  return parseBackupJson(text);
}

export interface AutoBackupDeps {
  isSupported?: () => boolean;
  pickSaveFile?: () => Promise<FileHandleLike>;
  handleStore?: HandleStoreLike;
  loadMeta?: () => AutoBackupMeta | null;
  saveMeta?: (meta: AutoBackupMeta | null) => void;
  nowIso?: () => string;
}

export interface AutoBackupController {
  init(): Promise<AutoBackupSnapshot>;
  linkFile(currentData: AppStorageData): Promise<AutoBackupSnapshot>;
  reauthorize(currentData: AppStorageData): Promise<AutoBackupSnapshot>;
  syncAutoBackupOnChange(data: AppStorageData, force?: boolean): Promise<AutoBackupSnapshot>;
  syncData(data: AppStorageData, force?: boolean): Promise<AutoBackupSnapshot>;
  unlinkFile(): Promise<AutoBackupSnapshot>;
  readLinkedBackup(): ReturnType<typeof parseBackupJson> | Promise<ReturnType<typeof parseBackupJson>>;
  getSnapshot(): AutoBackupSnapshot;
}

function defaultPickSaveFile(): Promise<FileHandleLike> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options?: Record<string, unknown>) => Promise<FileHandleLike>;
    }
  ).showSaveFilePicker;
  if (typeof picker !== 'function') {
    return Promise.reject(new Error('File System Access API not supported'));
  }
  return picker({
    suggestedName: AUTO_BACKUP_DEFAULT_FILENAME,
    types: [
      {
        description: 'ملف نسخة احتياطية JSON',
        accept: { 'application/json': ['.json'] },
      },
    ],
  });
}

/**
 * Standalone synchronization function called after saves or edits in the application.
 * Reads the handle from IndexedDB, checks queryPermission({ mode: 'readwrite' }),
 * and silently writes directly to the same file via createWritable().
 */
export async function syncAutoBackupOnChange(
  data: AppStorageData,
  deps: AutoBackupDeps = {}
): Promise<AutoBackupSnapshot> {
  const checkSupported = deps.isSupported ?? isFileSystemAccessSupported;
  if (!checkSupported()) {
    return {
      supported: false,
      status: 'unsupported',
      fileName: null,
      lastSyncedAt: null,
      unsyncedChangesCount: 1,
      errorMessage: null,
    };
  }

  const handleStore = deps.handleStore ?? createIndexedDbHandleStore();
  const loadMeta = deps.loadMeta ?? loadAutoBackupMeta;
  const saveMeta = deps.saveMeta ?? saveAutoBackupMeta;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  const meta = loadMeta();

  let handle: FileHandleLike | null = null;
  try {
    handle = await handleStore.get();
  } catch {
    return {
      supported: true,
      status: 'error',
      fileName: meta?.fileName ?? null,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
      unsyncedChangesCount: 1,
      errorMessage: 'تعذر الوصول إلى مخزن الملف في IndexedDB.',
    };
  }

  if (!handle) {
    return {
      supported: true,
      status: 'unlinked',
      fileName: null,
      lastSyncedAt: null,
      unsyncedChangesCount: 1,
      errorMessage: null,
    };
  }

  const perm = await queryHandleWritePermission(handle);
  const fileName = handle.name || meta?.fileName || AUTO_BACKUP_DEFAULT_FILENAME;

  if (perm !== 'granted') {
    return {
      supported: true,
      status: perm === 'prompt' ? 'needs-permission' : 'error',
      fileName,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
      unsyncedChangesCount: 1,
      errorMessage:
        perm === 'denied'
          ? 'تم رفض إذن الكتابة على الملف. اربط الملف مرة تانية.'
          : null,
    };
  }

  try {
    await writeBackupToHandle(handle, data);
    const syncedAt = nowIso();
    saveMeta({ fileName, lastSyncedAt: syncedAt });
    return {
      supported: true,
      status: 'active',
      fileName,
      lastSyncedAt: syncedAt,
      unsyncedChangesCount: 0,
      errorMessage: null,
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NotAllowedError') {
      return {
        supported: true,
        status: 'needs-permission',
        fileName,
        lastSyncedAt: meta?.lastSyncedAt ?? null,
        unsyncedChangesCount: 1,
        errorMessage: null,
      };
    }
    return {
      supported: true,
      status: 'error',
      fileName,
      lastSyncedAt: meta?.lastSyncedAt ?? null,
      unsyncedChangesCount: 1,
      errorMessage: 'تعذر الكتابة الصامتة في الملف. جرب ربط الملف مرة تانية.',
    };
  }
}

export function createAutoBackupController(deps: AutoBackupDeps = {}): AutoBackupController {
  const checkSupported = deps.isSupported ?? isFileSystemAccessSupported;
  const pickSaveFile = deps.pickSaveFile ?? defaultPickSaveFile;
  const handleStore = deps.handleStore ?? createIndexedDbHandleStore();
  const loadMeta = deps.loadMeta ?? loadAutoBackupMeta;
  const saveMeta = deps.saveMeta ?? saveAutoBackupMeta;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  let currentHandle: FileHandleLike | null = null;
  let lastSyncedSignature: string | null = null;
  let pendingUnsyncedCount = 0;

  let snapshot: AutoBackupSnapshot = {
    supported: checkSupported(),
    status: checkSupported() ? 'unlinked' : 'unsupported',
    fileName: null,
    lastSyncedAt: null,
    unsyncedChangesCount: 0,
    errorMessage: null,
  };

  let writeChain: Promise<AutoBackupSnapshot> = Promise.resolve(snapshot);

  function updateSnapshot(patch: Partial<AutoBackupSnapshot>): AutoBackupSnapshot {
    snapshot = { ...snapshot, ...patch };
    return snapshot;
  }

  async function init(): Promise<AutoBackupSnapshot> {
    const supported = checkSupported();
    if (!supported) {
      return updateSnapshot({
        supported: false,
        status: 'unsupported',
        fileName: null,
        lastSyncedAt: null,
        unsyncedChangesCount: 0,
        errorMessage: null,
      });
    }

    const meta = loadMeta();
    try {
      const storedHandle = await handleStore.get();
      if (!storedHandle) {
        currentHandle = null;
        return updateSnapshot({
          supported: true,
          status: 'unlinked',
          fileName: null,
          lastSyncedAt: null,
          unsyncedChangesCount: 0,
          errorMessage: null,
        });
      }

      currentHandle = storedHandle;
      const perm = await queryHandleWritePermission(storedHandle);
      const fileName = storedHandle.name || meta?.fileName || AUTO_BACKUP_DEFAULT_FILENAME;
      const status: AutoBackupStatus =
        perm === 'granted' ? 'active' : perm === 'prompt' ? 'needs-permission' : 'error';

      return updateSnapshot({
        supported: true,
        status,
        fileName,
        lastSyncedAt: meta?.lastSyncedAt ?? null,
        unsyncedChangesCount: 0,
        errorMessage:
          perm === 'denied'
            ? 'المتصفح منع الكتابة على الملف ده. اختار الملف تاني لتفعيل الحفظ التلقائي.'
            : null,
      });
    } catch {
      return updateSnapshot({
        supported: true,
        status: meta ? 'needs-permission' : 'unlinked',
        fileName: meta?.fileName ?? null,
        lastSyncedAt: meta?.lastSyncedAt ?? null,
        unsyncedChangesCount: 0,
        errorMessage: null,
      });
    }
  }

  async function performWrite(
    handle: FileHandleLike,
    data: AppStorageData,
    force: boolean
  ): Promise<AutoBackupSnapshot> {
    const sig = getBackupContentSignature(data);
    if (!force && lastSyncedSignature === sig && snapshot.status === 'active') {
      return snapshot;
    }

    const perm = await queryHandleWritePermission(handle);
    if (perm !== 'granted') {
      pendingUnsyncedCount += 1;
      return updateSnapshot({
        status: perm === 'prompt' ? 'needs-permission' : 'error',
        unsyncedChangesCount: pendingUnsyncedCount,
        errorMessage:
          perm === 'denied'
            ? 'تم رفض إذن الكتابة على الملف. اربط الملف مرة تانية.'
            : null,
      });
    }

    updateSnapshot({ status: 'syncing', errorMessage: null });

    try {
      await writeBackupToHandle(handle, data);
      lastSyncedSignature = sig;
      pendingUnsyncedCount = 0;
      const syncedAt = nowIso();
      const fileName = handle.name || snapshot.fileName || AUTO_BACKUP_DEFAULT_FILENAME;
      saveMeta({ fileName, lastSyncedAt: syncedAt });
      return updateSnapshot({
        status: 'active',
        fileName,
        lastSyncedAt: syncedAt,
        unsyncedChangesCount: 0,
        errorMessage: null,
      });
    } catch (err) {
      pendingUnsyncedCount += 1;
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError') {
        return updateSnapshot({
          status: 'needs-permission',
          unsyncedChangesCount: pendingUnsyncedCount,
          errorMessage: null,
        });
      }
      if (name === 'NotFoundError') {
        return updateSnapshot({
          status: 'error',
          unsyncedChangesCount: pendingUnsyncedCount,
          errorMessage: 'ملف النسخة الاحتياطية اتنقل أو اتمسح من مكانه. اختار ملف جديد.',
        });
      }
      return updateSnapshot({
        status: 'error',
        unsyncedChangesCount: pendingUnsyncedCount,
        errorMessage: 'تعذر تحديث ملف النسخة الاحتياطية تلقائيًا. جرب ربط الملف تاني.',
      });
    }
  }

  function syncAutoBackupOnChange(
    data: AppStorageData,
    force = false
  ): Promise<AutoBackupSnapshot> {
    if (!snapshot.supported) {
      pendingUnsyncedCount += 1;
      return Promise.resolve(
        updateSnapshot({
          unsyncedChangesCount: pendingUnsyncedCount,
        })
      );
    }

    writeChain = writeChain.then(async () => {
      if (!currentHandle) {
        try {
          const stored = await handleStore.get();
          if (stored) {
            currentHandle = stored;
          }
        } catch {
          // IDB read failed
        }
      }

      if (!currentHandle) {
        pendingUnsyncedCount += 1;
        return updateSnapshot({
          status: 'unlinked',
          unsyncedChangesCount: pendingUnsyncedCount,
        });
      }

      return performWrite(currentHandle, data, force);
    });

    return writeChain;
  }

  function syncData(data: AppStorageData, force = false): Promise<AutoBackupSnapshot> {
    return syncAutoBackupOnChange(data, force);
  }

  async function linkFile(currentData: AppStorageData): Promise<AutoBackupSnapshot> {
    if (!checkSupported()) {
      return updateSnapshot({
        supported: false,
        status: 'unsupported',
      });
    }

    try {
      const handle = await pickSaveFile();
      currentHandle = handle;
      try {
        await handleStore.set(handle);
      } catch {
        // Keep handle active in memory even if IndexedDB persistence is restricted
      }

      // Initial silent write immediately
      await writeBackupToHandle(handle, currentData);
      const syncedAt = nowIso();
      const fileName = handle.name || AUTO_BACKUP_DEFAULT_FILENAME;
      lastSyncedSignature = getBackupContentSignature(currentData);
      pendingUnsyncedCount = 0;
      saveMeta({ fileName, lastSyncedAt: syncedAt });

      return updateSnapshot({
        supported: true,
        status: 'active',
        fileName,
        lastSyncedAt: syncedAt,
        unsyncedChangesCount: 0,
        errorMessage: null,
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : '';
      if (name === 'AbortError') {
        return snapshot;
      }
      if (
        name === 'SecurityError' ||
        msg.toLowerCase().includes('sub frame') ||
        msg.toLowerCase().includes('iframe')
      ) {
        return updateSnapshot({
          status: 'blocked-iframe',
          errorMessage:
            'المتصفح مانع اختيار ملف من جوه إطار المعاينة. افتح التطبيق في تبويب مستقل أو ثبّته كتطبيق PWA عشان الحفظ التلقائي في ملف واحد يشتغل.',
        });
      }
      return updateSnapshot({
        status: 'error',
        errorMessage: 'تعذر ربط ملف النسخة الاحتياطية على الجهاز.',
      });
    }
  }

  async function reauthorize(currentData: AppStorageData): Promise<AutoBackupSnapshot> {
    if (!currentHandle) {
      return linkFile(currentData);
    }
    try {
      const perm = await requestHandleWritePermission(currentHandle);
      if (perm === 'granted') {
        return syncAutoBackupOnChange(currentData, true);
      }
      return updateSnapshot({
        status: perm === 'prompt' ? 'needs-permission' : 'error',
        errorMessage:
          perm === 'denied'
            ? 'مفيش صلاحية للكتابة على الملف. اختار ملف جديد.'
            : null,
      });
    } catch {
      return updateSnapshot({
        status: 'error',
        errorMessage: 'تعذر تجديد صلاحية الملف. اختار الملف مرة تانية.',
      });
    }
  }

  async function unlinkFile(): Promise<AutoBackupSnapshot> {
    currentHandle = null;
    lastSyncedSignature = null;
    pendingUnsyncedCount = 0;
    saveMeta(null);
    try {
      await handleStore.clear();
    } catch {
      // Ignore IndexedDB cleanup errors
    }
    return updateSnapshot({
      status: checkSupported() ? 'unlinked' : 'unsupported',
      fileName: null,
      lastSyncedAt: null,
      unsyncedChangesCount: 0,
      errorMessage: null,
    });
  }

  async function readLinkedBackup() {
    if (!currentHandle) {
      return {
        ok: false,
        error: 'مفيش ملف نسخة احتياطية مربوط حاليًا.',
      };
    }
    try {
      return await readBackupFromHandle(currentHandle);
    } catch {
      return {
        ok: false,
        error: 'تعذر قراءة الملف المرتبط. تأكد إن الملف لسه موجود في مكانه.',
      };
    }
  }

  return {
    init,
    linkFile,
    reauthorize,
    syncAutoBackupOnChange,
    syncData,
    unlinkFile,
    readLinkedBackup,
    getSnapshot: () => snapshot,
  };
}
