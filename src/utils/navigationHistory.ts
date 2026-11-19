export type ActiveTab = 'today' | 'log' | 'reports';

export interface HistoryTabState {
  tabStack: ActiveTab[];
}

export function createInitialTabState(): HistoryTabState {
  return {
    tabStack: ['today'],
  };
}

export function getActiveTab(state: HistoryTabState): ActiveTab {
  return state.tabStack[state.tabStack.length - 1] ?? 'today';
}

export function getTabDepth(state: HistoryTabState): number {
  return Math.max(0, state.tabStack.length - 1);
}

/**
 * Computes next tab stack and how many browser history steps to push or pop
 * when the user clicks a navigation tab.
 */
export function transitionTab(
  state: HistoryTabState,
  targetTab: ActiveTab
): { nextState: HistoryTabState; historyDelta: number } {
  const currentTab = getActiveTab(state);
  if (currentTab === targetTab) {
    return { nextState: state, historyDelta: 0 };
  }

  if (targetTab === 'today') {
    const depth = getTabDepth(state);
    return {
      nextState: { tabStack: ['today'] },
      historyDelta: -depth,
    };
  }

  return {
    nextState: { tabStack: [...state.tabStack, targetTab] },
    historyDelta: 1,
  };
}

/**
 * Handles a browser back (popstate) event when no modal is open.
 */
export function popTabState(state: HistoryTabState): HistoryTabState {
  if (state.tabStack.length <= 1) {
    return state;
  }
  return {
    tabStack: state.tabStack.slice(0, -1),
  };
}
