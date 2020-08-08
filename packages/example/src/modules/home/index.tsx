import React from 'react';
import { useService, view } from '@rabjs/core';
import { RouterService } from '@rabjs/router';
import { CountService } from '../../count';
import ViewComponent from '../viewComponent';
import { RenderCountComponent } from '../renderCount';

export const Home = view(() => {
  const countService = useService(CountService);
  const routerService = useService(RouterService);
  return (
    <div>
      <div>
        <button onClick={() => countService.add(1)}>click </button>
        <p>count: {countService.count}</p>
        <p>path: {routerService.location.pathname}</p>
      </div>
      <div>ViewComponent:</div>
      <ViewComponent />
      <div>RenderCountComponent:</div>
      <RenderCountComponent />
    </div>
  );
});
