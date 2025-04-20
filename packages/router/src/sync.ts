import { container, Singleton, autorun } from '@rabjs/core';
import { History, Location, UnregisterCallback, LocationListener } from 'history';
import { RouterService } from './routerService';

export interface SynchronizedHistory extends History {
  subscribe: (listener: LocationListener) => UnregisterCallback;
  unsubscribe?: UnregisterCallback;
}
export const syncHistoryWithStore = (history: History): SynchronizedHistory => {
  const routerService = container.resolveInScope(RouterService, Singleton);

  // Initialise store
  routerService.history = history;

  // Handle update from history object
  const handleLocationChange = (location: Location) => {
    routerService._updateLocation(location);
  };

  const unsubscribeFromHistory = history.listen(handleLocationChange);

  handleLocationChange(history.location);

  const subscribe = (listener: LocationListener) => {
    const onStoreChange = () => {
      const rawLocation = { ...routerService.location };
      listener(rawLocation, history.action);
    };

    // Listen for changes to location state in store
    const unsubscribeFromStore = autorun(() => routerService.location, {
      scheduler: onStoreChange,
    });

    listener(routerService.location, history.action);

    return () => {
      unsubscribeFromStore();
    };
  };

  (history as SynchronizedHistory).subscribe = subscribe;
  (history as SynchronizedHistory).unsubscribe = unsubscribeFromHistory;

  return history as SynchronizedHistory;
};
