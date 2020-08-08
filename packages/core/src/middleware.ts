import { interfaces } from 'inversify';
import { container } from '@rabjs/ioc';
import { getObserverService } from './utils/service';

function serviceMiddleware(planAndResolve: any): any {
  return (args: interfaces.NextArgs) => {
    const result = planAndResolve(args);
    return getObserverService(result);
  };
}

container.applyMiddleware(serviceMiddleware);
