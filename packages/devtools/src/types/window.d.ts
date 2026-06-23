import type { RSRootContainerHandle } from '../root-container-handle';

declare global {
  interface Window {
    __RS_ROOT_CONTAINER__?: RSRootContainerHandle;
  }
}
