import { Transient, useService, view } from '@rabjs/core';
import { RenderCount } from './renderCount.service';
import { useCallback } from 'react';

export const RenderCountComponent = view(() => {
  const countService = useService(RenderCount, { scope: Transient });
  const addOne = useCallback(() => countService.add(1), [countService]);
  return (
    <div>
      {countService.count}
      <button onClick={addOne}>add one</button>
      {countService.start}
      <button onClick={countService.changeStart}>change start</button>
    </div>
  );
});
