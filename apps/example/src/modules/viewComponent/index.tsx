import React from 'react';
import { view, Inject, ServiceResult } from '@rabjs/core';
import { ViewComponentService } from './index.service';

class ViewComponent extends React.Component<any, any> {
  @Inject(ViewComponentService)
  private readonly viewComponentService!: ServiceResult<ViewComponentService>;

  add = () => {
    this.viewComponentService.add(1);
  };

  render() {
    return  1;
    window.ccc = this;
    return (
      <div>
        <div>
          <button onClick={this.add}>加1</button>
        </div>
        <div>
          count is : <span>{this.viewComponentService.count}</span>
        </div>
      </div>
    );
  }
}

export default view(ViewComponent);
