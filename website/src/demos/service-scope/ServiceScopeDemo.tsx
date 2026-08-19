import {
  bindServices,
  getGlobalContainer,
  observer,
  register,
  resolve,
  useService,
} from '@rabjs/react';

import { AppService, GlobalService, PageService, PanelService } from './ServiceScopeServices';

const Panel = observer(() => {
  const panel = useService(PanelService);
  return (
    <div className="demo-row">
      <strong>{panel.panelId}</strong>
      <span>count: {panel.count}</span>
      <button className="demo-btn" onClick={() => panel.increment()}>
        +1
      </button>
    </div>
  );
});

const BoundPanel = bindServices(Panel, [PanelService]);

const Page = observer(() => {
  const app = useService(AppService);
  const page = useService(PageService);

  return (
    <div>
      <div className="demo-row">
        <span>父级主题：{app.theme}</span>
        <span>应用访问：{app.visits}</span>
        <span>页面更新：{page.updates}</span>
      </div>
      <div className="demo-row">
        <button className="demo-btn" onClick={() => app.toggleTheme()}>
          切换父级主题
        </button>
        <button className="demo-btn" onClick={() => app.visit()}>
          记录应用访问
        </button>
        <button className="demo-btn" onClick={() => page.update()}>
          更新当前页面
        </button>
      </div>
      <div className="demo-row">
        <BoundPanel />
        <BoundPanel />
      </div>
    </div>
  );
});

const BoundPage = bindServices(Page, [PageService]);

const globalContainer = getGlobalContainer();
if (!globalContainer.has(GlobalService)) {
  register(GlobalService);
}

const GlobalSection = observer(() => {
  const global = resolve(GlobalService);
  return (
    <div className="demo-row">
      <span>全局计数：{global.count}</span>
      <button className="demo-btn" onClick={() => global.increment()}>
        修改全局 Service
      </button>
    </div>
  );
});

const ScopeDemo = observer(() => {
  const app = useService(AppService);
  return (
    <div>
      <p>外层 AppService 实例：{app.instanceId}</p>
      <BoundPage />
      <GlobalSection />
    </div>
  );
});

export default bindServices(ScopeDemo, [AppService]);
