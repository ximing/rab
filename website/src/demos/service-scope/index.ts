import ServiceScopeDemo from './ServiceScopeDemo';

export default ServiceScopeDemo;
export { AppService, GlobalService, PageService, PanelService } from './ServiceScopeServices';

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 ServiceScopeServices / ServiceScopeDemo 时同步更新这里的字符串。
 */
export const serviceScopeDemoCode = `import {
  Service,
  bindServices,
  getGlobalContainer,
  observer,
  register,
  resolve,
  useService,
} from "@rabjs/react";

class AppService extends Service {
  theme: "signal" | "paper" = "signal";
  visits = 0;

  toggleTheme() {
    this.theme = this.theme === "signal" ? "paper" : "signal";
  }

  visit() {
    this.visits += 1;
  }
}

class PageService extends Service {
  title = "嵌套页面";
  updates = 0;

  update() {
    this.updates += 1;
  }
}

let nextPanelId = 0;

class PanelService extends Service {
  readonly panelId = \`panel-\${++nextPanelId}\`;
  count = 0;

  increment() {
    this.count += 1;
  }
}

class GlobalService extends Service {
  count = 0;

  increment() {
    this.count += 1;
  }
}

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
`;
