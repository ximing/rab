import { Component } from 'react';
import { viewServices, ServiceResult } from '@rabjs/core';
import { DemoService } from './demo.service';
import { CountService } from '../../count';

class _Demo extends Component<{
  c: string;
  demoService: ServiceResult<DemoService>;
  countService: ServiceResult<CountService>;
}> {
  render() {
    const { demoService, countService } = this.props;
    console.log('demo render');
    return (
      <div>
        <p>demo:</p>
        <button
          onClick={() => {
            demoService.count = demoService.count + 1;
            countService.add(demoService.count);
          }}
        >
          click demo
        </button>
        <button
          onClick={() => {
            demoService.addAsync(1);
          }}
        >
          sync add
        </button>
        demo count{demoService.count}
        {demoService.$model.addAsync.loading && <span>loading...</span>}
      </div>
    );
  }
}

export const Demo = viewServices({
  demoService: DemoService,
  countService: CountService,
})(_Demo);
