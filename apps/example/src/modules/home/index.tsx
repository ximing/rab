import { useService, view } from '@rabjs/core';
import { CountService } from '../../count';
import ViewComponent from '../viewComponent';
import { RenderCountComponent } from '../renderCount';
import { useLocation } from 'react-router-dom';

export const Home = view(() => {
  const countService = useService(CountService);
  const location = useLocation();
  return (
    <div>
      <div>
        <button onClick={() => countService.add(1)}>click </button>
        <p>count: {countService.count}</p>
        <p>path: {location.pathname}</p>
      </div>
      <div>ViewComponent(Class):</div>
      <ViewComponent />
      <div>RenderCountComponent(FC):</div>
      <RenderCountComponent />
    </div>
  );
});
