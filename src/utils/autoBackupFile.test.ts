import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AutoBackupMeta,
  createAutoBackupController,
  FileHandleLike,
  HandleStoreLike,
} from './autoBackupFile';
import { AppStorageData } from '../types/work';

function makeSampleData(overrides: Partial<AppStorageData> = {}): AppStorageData {
  return {
    version: 2,
    selectedShift: 'shift1',
    entries: [],
    monthlyHourlyRates: {},
    ...overrides,
  };
}

function createMockHandle(initialPerm: PermissionState = 'granted') {
  let content = '';
  let writeCount = 0;
  let permission: PermissionState = initialPerm;

  const handle: FileHandleLike = {
    name: 'daftar-elshoghl-backup.json',
    queryPermission: async () => permission,
    requestPermission: async () => {
      permission = 'granted';
      return permission;
    },
    createWritable: async () => {
      let buffer = '';
      return {
        write: async (data: string) => {
          buffer = data;
        },
        close: async () => {
          content = buffer;
          writeCount += 1;
        },
      };
    },
    getFile: async () => ({
      text: async () => content,
    }),
  };

  return {
    handle,
    getContent: () => content,
    getWriteCount: () => writeCount,
    setPermission: (p: PermissionState) => {
      permission = p;
    },
  };
}

function createMemoryHandleStore(initial: FileHandleLike | null = null): HandleStoreLike {
  let stored = initial;
  return {
    get: async () => stored,
    set: async (h) => {
      stored = h;
    },
    clear: async () => {
      stored = null;
    },
  };
}

test('1. ربط ملف واحد يكتب البيانات فورًا ويحدّث نفس الملف عند كل تغيير دون إنشاء ملفات جديدة', async () => {
  const mockFile = createMockHandle('granted');
  const store = createMemoryHandleStore();
  let savedMeta: AutoBackupMeta | null = null;

  const ctrl = createAutoBackupController({
    isSupported: () => true,
    pickSaveFile: async () => mockFile.handle,
    handleStore: store,
    loadMeta: () => savedMeta,
    saveMeta: (m) => {
      savedMeta = m;
    },
    nowIso: () => '2026-11-22T10:00:00.000Z',
  });

  const initSnap = await ctrl.init();
  assert.equal(initSnap.status, 'unlinked');

  const initialData = makeSampleData();
  const linkedSnap = await ctrl.linkFile(initialData);
  assert.equal(linkedSnap.status, 'active');
  assert.equal(linkedSnap.fileName, 'daftar-elshoghl-backup.json');
  assert.equal(mockFile.getWriteCount(), 1);

  // Sync with identical data -> skipped (no duplicate write)
  await ctrl.syncData(initialData);
  assert.equal(mockFile.getWriteCount(), 1);

  // Add entry + rate -> overwrites SAME single file
  const updatedData = makeSampleData({
    selectedShift: 'shift2',
    monthlyHourlyRates: { '2026-11': 75 },
    entries: [
      {
        id: '2026-11-22',
        workDate: '2026-11-22',
        shift: 'shift2',
        checkInTime: '15:00',
        checkOutDate: '2026-11-22',
        checkOutTime: '23:30',
        createdAt: '2026-11-22T13:00:00.000Z',
        updatedAt: '2026-11-22T21:30:00.000Z',
      },
    ],
  });

  const syncedSnap = await ctrl.syncData(updatedData);
  assert.equal(syncedSnap.status, 'active');
  assert.equal(mockFile.getWriteCount(), 2);

  const parsedOnDisk = JSON.parse(mockFile.getContent());
  assert.equal(parsedOnDisk.selectedShift, 'shift2');
  assert.equal(parsedOnDisk.monthlyHourlyRates['2026-11'], 75);
  assert.equal(parsedOnDisk.entries.length, 1);

  // Read back directly from linked handle
  const restored = await ctrl.readLinkedBackup();
  assert.equal(restored.ok, true);
  assert.equal(restored.data?.entries.length, 1);
});

test('2. التحديثات المتلاحقة تُرتّب تسلسليًا دون تداخل الكتابة على الملف', async () => {
  const mockFile = createMockHandle('granted');
  const store = createMemoryHandleStore(mockFile.handle);

  const ctrl = createAutoBackupController({
    isSupported: () => true,
    handleStore: store,
    loadMeta: () => ({ fileName: mockFile.handle.name, lastSyncedAt: null }),
    saveMeta: () => {},
  });

  await ctrl.init();
  const d1 = makeSampleData({ monthlyHourlyRates: { '2026-11': 50 } });
  const d2 = makeSampleData({ monthlyHourlyRates: { '2026-11': 65 } });

  await Promise.all([ctrl.syncData(d1), ctrl.syncData(d2)]);
  assert.equal(mockFile.getWriteCount(), 2);
  assert.equal(JSON.parse(mockFile.getContent()).monthlyHourlyRates['2026-11'], 65);
});

test('3. عند إعادة فتح التطبيق بصلاحية prompt يظهر طلب تفعيل بضغطة واحدة وبعد الموافقة يحدّث الملف فورًا', async () => {
  const mockFile = createMockHandle('prompt');
  const store = createMemoryHandleStore(mockFile.handle);

  const ctrl = createAutoBackupController({
    isSupported: () => true,
    handleStore: store,
    loadMeta: () => ({ fileName: 'daftar-elshoghl-backup.json', lastSyncedAt: null }),
    saveMeta: () => {},
  });

  const snap = await ctrl.init();
  assert.equal(snap.status, 'needs-permission');
  assert.equal(snap.fileName, 'daftar-elshoghl-backup.json');

  const data = makeSampleData({ selectedShift: 'shift3' });
  const afterReauth = await ctrl.reauthorize(data);
  assert.equal(afterReauth.status, 'active');
  assert.equal(mockFile.getWriteCount(), 1);
  assert.equal(JSON.parse(mockFile.getContent()).selectedShift, 'shift3');

  // Unlink clears store
  const unlinked = await ctrl.unlinkFile();
  assert.equal(unlinked.status, 'unlinked');
  assert.equal(unlinked.fileName, null);
  assert.equal(await store.get(), null);
});

test('4. معالجة المتصفح غير المدعوم أو الإطار المقيّد أو إلغاء الاختيار بأمان', async () => {
  const unsupportedCtrl = createAutoBackupController({
    isSupported: () => false,
  });
  const unsupportedSnap = await unsupportedCtrl.init();
  assert.equal(unsupportedSnap.status, 'unsupported');

  const cancelledCtrl = createAutoBackupController({
    isSupported: () => true,
    handleStore: createMemoryHandleStore(),
    pickSaveFile: async () => {
      const err = new Error('User cancelled');
      err.name = 'AbortError';
      throw err;
    },
  });
  await cancelledCtrl.init();
  const afterCancel = await cancelledCtrl.linkFile(makeSampleData());
  assert.equal(afterCancel.status, 'unlinked');

  const iframeCtrl = createAutoBackupController({
    isSupported: () => true,
    handleStore: createMemoryHandleStore(),
    pickSaveFile: async () => {
      const err = new Error('Cross origin sub frames are not allowed to show a file picker');
      err.name = 'SecurityError';
      throw err;
    },
  });
  await iframeCtrl.init();
  const afterIframe = await iframeCtrl.linkFile(makeSampleData());
  assert.equal(afterIframe.status, 'blocked-iframe');
});

test('5. مزامنة البيانات أثناء وجود إذن prompt تطلب الإذن وتحدث الملف فورًا', async () => {
  const mockFile = createMockHandle('prompt');
  const store = createMemoryHandleStore(mockFile.handle);

  const ctrl = createAutoBackupController({
    isSupported: () => true,
    handleStore: store,
    loadMeta: () => ({ fileName: 'daftar-elshoghl-backup.json', lastSyncedAt: null }),
    saveMeta: () => {},
  });

  const snap = await ctrl.init();
  assert.equal(snap.status, 'needs-permission');

  // When syncData is called (e.g. user performed an action), it attempts requestHandleWritePermission and writes
  const synced = await ctrl.syncData(makeSampleData({ selectedShift: 'shift2' }), true);
  assert.equal(synced.status, 'active');
  assert.equal(mockFile.getWriteCount(), 1);
  assert.equal(JSON.parse(mockFile.getContent()).selectedShift, 'shift2');
});

