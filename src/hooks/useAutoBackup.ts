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
        ctrl.syncData(latestDataRef.current).then((synced) => {
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
    const currentSnap = ctrl.getSnapshot();
    if (!initializedRef.current || currentSnap.status !== 'active') {
      return;
    }

    const timer = window.setTimeout(() => {
      ctrl.syncData(latestDataRef.current).then((next) => {
        setSnapshot(next);
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [appData]);

  // Flush pending backup immediately when tab goes background or closes
  useEffect(() => {
    const flushNow = () => {
      const ctrl = controllerRef.current!;
      if (ctrl.getSnapshot().status === 'active' && hasMountedDataChangeRef.current) {
        ctrl.syncData(latestDataRef.current).then((next) => {
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

  const syncNow = useCallback(async () => {
    const next = await controllerRef.current!.syncData(latestDataRef.current, true);
    setSnapshot(next);
  }, []);

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
    syncNow,
    unlinkFile,
    readLinkedBackup,
  };
}
