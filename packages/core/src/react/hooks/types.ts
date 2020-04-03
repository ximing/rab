import { Service } from '../../service';
import { ActionMethodStatesOfService } from '../../types';

export type ServiceResult<
  M extends Service,
  K extends keyof M = Exclude<keyof M, keyof Service>
> = {
  [key in K]: M[key];
} & {
  $model: ActionMethodStatesOfService<M>;
};
