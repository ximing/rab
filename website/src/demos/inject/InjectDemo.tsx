import { Inject, Service } from "@rabjs/react";
import { bindServices, observer, useService } from "@rabjs/react";

/**
 * 依赖注入（@Inject）live demo —— guides/Service 页面的脚手架示例。
 * 同时它也验证了站点构建对「属性装饰器 + useDefineForClassFields: false」的支持。
 */

class LoggerService extends Service {
  logs: string[] = [];

  log(message: string) {
    this.logs = [...this.logs, message];
  }
}

class ClickService extends Service {
  count = 0;

  // @Inject 从当前服务所属容器解析依赖（链式、懒解析）
  @Inject(LoggerService)
  private logger!: LoggerService;

  click() {
    this.count += 1;
    this.logger.log(`第 ${this.count} 次点击`);
  }
}

const InjectDemoContent = observer(() => {
  const click = useService(ClickService);
  const logger = useService(LoggerService);
  return (
    <div>
      <div className="demo-row">
        <button className="demo-btn primary" onClick={() => click.click()}>
          点我（{click.count}）
        </button>
      </div>
      <ul style={{ margin: "12px 0 0", paddingLeft: 20, color: "var(--text-dim)" }}>
        {logger.logs.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(InjectDemoContent, [LoggerService, ClickService]);
