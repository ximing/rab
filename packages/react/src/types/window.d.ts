import type { RSRootContainerHandle } from '../domain/root-container-handle';

declare global {
  interface Window {
    __RS_ROOT_CONTAINER__?: RSRootContainerHandle;
  }
}

export type { RSRootContainerHandle } from '../domain/root-container-handle';
