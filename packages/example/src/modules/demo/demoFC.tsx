import React from 'react';
import { view, useService } from '@rabjs/core';
import { DemoService } from './demo.service';

export const DemoFC = view(() => {
  const demoService = useService(DemoService);
  console.log('demoFC render');
  return (
    <div>
      <p>demoFC:</p>
      <button
        onClick={() => {
          demoService.count = demoService.count + 1;
        }}
      >
        click
      </button>
      demo count{demoService.count}
    </div>
  );
});
