import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActiveTab,
  createInitialTabState,
  getActiveTab,
  HistoryTabState,
  popTabState,
  transitionTab,
} from '../utils/navigationHistory';

interface ModalEntry {
  id: string;
  onClose: () => void;
}

interface NavigationContextValue {
  activeTab: ActiveTab;
  navigateToTab: (tab: ActiveTab) => void;
  registerOpenModal: (id: string, onClose: () => void) => void;
  unregisterModal: (id: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabState, setTabState] = useState<HistoryTabState>(() => createInitialTabState());
  const tabStateRef = useRef<HistoryTabState>(tabState);
  tabStateRef.current = tabState;

  const modalStackRef = useRef<ModalEntry[]>([]);
  const pendingCleanupPopsRef = useRef<number>(0);
  const pendingUnregisterTimersRef = useRef<Map<string, number>>(new Map());

  // Ensure initial base state exists in browser history
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.history.state || typeof window.history.state.__appDepth !== 'number') {
      window.history.replaceState(
        { ...(window.history.state || {}), __appDepth: 0, __kind: 'base' },
        ''
      );
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (pendingCleanupPopsRef.current > 0) {
        pendingCleanupPopsRef.current -= 1;
        return;
      }

      // Priority 1: Close topmost open modal
      if (modalStackRef.current.length > 0) {
        const topModal = modalStackRef.current[modalStackRef.current.length - 1];
        modalStackRef.current = modalStackRef.current.slice(0, -1);
        topModal.onClose();
        return;
      }

      // Priority 2: Step back through tabs until reaching 'today' (Home)
      setTabState((prev) => {
        const next = popTabState(prev);
        tabStateRef.current = next;
        return next;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToTab = useCallback((targetTab: ActiveTab) => {
    const { nextState, historyDelta } = transitionTab(tabStateRef.current, targetTab);
    if (historyDelta === 0 && getActiveTab(tabStateRef.current) === targetTab) {
      return;
    }

    tabStateRef.current = nextState;
    setTabState(nextState);

    if (typeof window === 'undefined') return;

    if (historyDelta > 0) {
      const prevDepth =
        typeof window.history.state?.__appDepth === 'number' ? window.history.state.__appDepth : 0;
      window.history.pushState(
        { __appDepth: prevDepth + 1, __kind: 'tab', tab: targetTab },
        ''
      );
    } else if (historyDelta < 0) {
      pendingCleanupPopsRef.current += 1;
      window.history.go(historyDelta);
    }
  }, []);

  const registerOpenModal = useCallback((id: string, onClose: () => void) => {
    // Cancel any scheduled unregister cleanup (handles React StrictMode double-mount cleanly)
    const pendingTimer = pendingUnregisterTimersRef.current.get(id);
    if (pendingTimer !== undefined) {
      window.clearTimeout(pendingTimer);
      pendingUnregisterTimersRef.current.delete(id);
    }

    const exists = modalStackRef.current.some((m) => m.id === id);
    if (exists) {
      modalStackRef.current = modalStackRef.current.map((m) =>
        m.id === id ? { id, onClose } : m
      );
      return;
    }

    modalStackRef.current = [...modalStackRef.current, { id, onClose }];
    if (typeof window !== 'undefined') {
      const prevDepth =
        typeof window.history.state?.__appDepth === 'number' ? window.history.state.__appDepth : 0;
      window.history.pushState({ __appDepth: prevDepth + 1, __kind: 'modal', id }, '');
    }
  }, []);

  const unregisterModal = useCallback((id: string) => {
    const exists = modalStackRef.current.some((m) => m.id === id);
    if (!exists) {
      // Already popped via Mobile Back button (popstate)
      return;
    }

    const timer = window.setTimeout(() => {
      pendingUnregisterTimersRef.current.delete(id);
      const stillExists = modalStackRef.current.some((m) => m.id === id);
      if (!stillExists) return;

      modalStackRef.current = modalStackRef.current.filter((m) => m.id !== id);
      pendingCleanupPopsRef.current += 1;
      window.history.back();
    }, 0);

    pendingUnregisterTimersRef.current.set(id, timer);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        activeTab: getActiveTab(tabState),
        navigateToTab,
        registerOpenModal,
        unregisterModal,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export function useAppNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useAppNavigation must be used inside NavigationProvider');
  }
  return ctx;
}

/**
 * Automatically wires any modal/dialog to the device Back button (popstate).
 * Pressing Back closes the modal cleanly without leaving the current screen.
 */
export function useModalBackHandler(id: string, isOpen: boolean, onClose: () => void) {
  const ctx = useContext(NavigationContext);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!ctx) return;
    if (isOpen) {
      ctx.registerOpenModal(id, () => onCloseRef.current());
      return () => {
        ctx.unregisterModal(id);
      };
    }
  }, [ctx, id, isOpen]);
}
