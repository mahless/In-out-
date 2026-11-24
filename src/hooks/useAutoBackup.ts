import { useCallback, useEffect, useRef, useState } from 'react';
import { AppStorageData } from '../types/work';
import {
  AutoBackupSnapshot,
  createAutoBackupController,
  getBackupContentSignature,
  isFileSystemAccessSupported,
} from '../utils/autoBackupFile';

const DEBOUNCE_MS = 450;

export interface UseAutoBackupResult {
  snapshot: AutoBackupSnapshot;
  linkFile: () => Promise<void>;
  reauthorize: () => Promise<void>;
  syncAutoBackupOnChange: (data?: AppStorageData) => Promise<void>;
  syncNow: () => Promise<void>;
  unlinkFile: () => Promise<void>;
  readLinkedBackup: () => ReturnType<
    ReturnType<typeof createAutoBackupController>['readLinkedBackup']
  >;
}

export function useAutoBackup(appData: AppStorageData): UseAutoBackupResult {
  const controllerRef = useRef<ReturnType<typeof createAutoBackupController> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createAutoBackupController();
  }

  const [snapshot, setSnapshot] = useState<AutoBackupSnapshot>(() => ({
    supported: isFileSystemAccessSupported(),
    status: isFileSystemAccessSupported() ? 'unlinked' : 'unsupported',
    fileName: null,
    lastSyncedAt: null,
    unsyncedChangesCount: 0,
    errorMessage: null,
  }));

  const latestDataRef = useRef<AppStorageData>(appData);
  latestDataRef.current = appData;

  const initialSignatureRef = useRef<string>(getBackupContentSignature(appData));
  const hasMountedDataChangeRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);

  // Initialize stored file handle on mount
  useEffect(() => {
    let active = true;
    const ctrl = controllerRef.current!;
    ctrl.init().then((next) => {
      if (!active) return;
      initializedRef.current = true;
      setSnapshot(next);
      // If handle is already active on reopen and data changed since mount, sync immediately
      if (next.status === 'active' && hasMountedDataChangeRef.current) {
        ctrl.syncAutoBackupOnChange(latestDataRef.current).then((synced) => {
          if (active) setSnapshot(synced);
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Watch any data change (entries, shift, monthlyHourlyRates) and auto-overwrite the single linked file
  useEffect(() => {
    const currentSignature = getBackupContentSignature(appData);
    if (currentSignature === initialSignatureRef.current && !hasMountedDataChangeRef.current) {
      return;
    }
    hasMountedDataChangeRef.current = true;

    const ctrl = controllerRef.current!;
    if (!initializedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      ctrl.syncAutoBackupOnChange(latestDataRef.current).then((next) => {
        setSnapshot(next);
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [appData]);

  // Flush pending backup immediately when tab goes background or closes
  useEffect(() => {
    const flushNow = () => {
      const ctrl = controllerRef.current!;
      if (hasMountedDataChangeRef.current) {
        ctrl.syncAutoBackupOnChange(latestDataRef.current).then((next) => {
          setSnapshot(next);
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flushNow);
    };
  }, []);

  const linkFile = useCallback(async () => {
    initializedRef.current = true;
    const next = await controllerRef.current!.linkFile(latestDataRef.current);
    setSnapshot(next);
  }, []);

  const reauthorize = useCallback(async () => {
    initializedRef.current = true;
    const next = await controllerRef.current!.reauthorize(latestDataRef.current);
    setSnapshot(next);
  }, []);

  const syncAutoBackupOnChange = useCallback(async (data?: AppStorageData) => {
    const target = data ?? latestDataRef.current;
    const next = await controllerRef.current!.syncAutoBackupOnChange(target, true);
    setSnapshot(next);
  }, []);

  const syncNow = useCallback(async () => {
    await syncAutoBackupOnChange();
  }, [syncAutoBackupOnChange]);

  const unlinkFile = useCallback(async () => {
    const next = await controllerRef.current!.unlinkFile();
    setSnapshot(next);
  }, []);

  const readLinkedBackup = useCallback(
    () => controllerRef.current!.readLinkedBackup(),
    []
  );

  return {
    snapshot,
    linkFile,
    reauthorize,
    syncAutoBackupOnChange,
    syncNow,
    unlinkFile,
    readLinkedBackup,
  };
}
