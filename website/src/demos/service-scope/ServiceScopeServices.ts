import { Service } from '@rabjs/react';

export class AppService extends Service {
  theme: 'signal' | 'paper' = 'signal';
  visits = 0;

  toggleTheme() {
    this.theme = this.theme === 'signal' ? 'paper' : 'signal';
  }

  visit() {
    this.visits += 1;
  }
}

export class PageService extends Service {
  title = '嵌套页面';
  updates = 0;

  update() {
    this.updates += 1;
  }
}

let nextPanelId = 0;

export class PanelService extends Service {
  readonly panelId = `panel-${++nextPanelId}`;
  count = 0;

  increment() {
    this.count += 1;
  }
}

export class GlobalService extends Service {
  count = 0;

  increment() {
    this.count += 1;
  }
}
