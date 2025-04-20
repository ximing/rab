import { ActionMethodStatesOfService } from '../../types';

export type ServiceResult<M, K extends keyof M = keyof M> = {
  [key in K]: M[key];
} & {
  $model: ActionMethodStatesOfService<M>;
};
