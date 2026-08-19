import * as React from 'react';

/**
 * Schedule a React store notification. In tests (`IS_REACT_ACT_ENVIRONMENT`)
 * the update is wrapped in `act` so useSyncExternalStore / setState do not
 * warn under React 19. Production paths are unchanged.
 */
export function notifyReactStore(update: () => void): void {
  const inAct = Boolean(
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  );
  const act = (React as { act?: (fn: () => void) => void }).act;
  if (inAct && typeof act === 'function') {
    act(update);
    return;
  }
  update();
}
