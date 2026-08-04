import InjectDemo from "./InjectDemo";

export default InjectDemo;

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 InjectDemo 时同步更新这里的字符串。
 */
export const injectDemoCode = `import { Inject, Service } from "@rabjs/react";
import { bindServices, observer, useService } from "@rabjs/react";

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
    this.logger.log(\`第 \${this.count} 次点击\`);
  }
}

const InjectDemoContent = observer(() => {
  const click = useService(ClickService);
  const logger = useService(LoggerService);
  return (
    <div>
      <button onClick={() => click.click()}>点我（{click.count}）</button>
      <ul>
        {logger.logs.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
});

export default bindServices(InjectDemoContent, [LoggerService, ClickService]);
`;
