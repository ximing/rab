import { Transient, useService, view } from '@rabjs/core';
import { RenderCount } from './renderCount.service';
import React, { useCallback } from 'react';

export const RenderCountComponent = view(() => {
  const countService = useService(RenderCount, { scope: Transient });
  const addOne = useCallback(() => countService.add(1), [countService]);
  console.log('----》RenderCountComponent render');
  return (
    <div>
      {countService.start}
      <button onClick={addOne}>add one</button>
      <button onClick={countService.changeStart}>change start</button>
    </div>
  );
});
