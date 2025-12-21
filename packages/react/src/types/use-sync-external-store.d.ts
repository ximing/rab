/**
 * use-sync-external-store 类型声明
 */
declare module 'use-sync-external-store/shim' {
  export function useSyncExternalStore<Snapshot>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => Snapshot,
    getServerSnapshot?: () => Snapshot
  ): Snapshot;
}
