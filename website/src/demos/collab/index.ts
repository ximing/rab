import CollabDemo from "./CollabDemo";

export default CollabDemo;
export { SettingsService, GreetingService } from "./CollabServices";

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 CollabServices / CollabDemo 时同步更新这里的字符串。
 */
export const collabDemoCode = `import { Service } from "@rabjs/react";
import { bindServices, observer, useService } from "@rabjs/react";

type Lang = "zh" | "en";

class SettingsService extends Service {
  lang: Lang = "zh";

  setLang(lang: Lang) {
    this.lang = lang;
  }
}

class GreetingService extends Service {
  // 推荐写法：getter + this.resolve，从所属容器解析依赖
  get settings() {
    return this.resolve(SettingsService);
  }

  name = "RAB";

  // 跨服务的 computed：settings.lang 变化时自动更新
  get greeting(): string {
    return this.settings.lang === "zh"
      ? \`你好，\${this.name}！\`
      : \`Hello, \${this.name}!\`;
  }
}

const Collab = observer(() => {
  const settings = useService(SettingsService);
  const greeting = useService(GreetingService);
  return (
    <div>
      <button onClick={() => settings.setLang("zh")}>中文</button>
      <button onClick={() => settings.setLang("en")}>English</button>
      <p>{greeting.greeting}</p>
    </div>
  );
});

// 两个服务注册进同一个容器，this.resolve 才能解析到
export default bindServices(Collab, [SettingsService, GreetingService]);
`;
