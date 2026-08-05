import { Service } from "@rabjs/react";

type Lang = "zh" | "en";

/**
 * 服务协作 demo 的两个 Service。
 *
 * GreetingService 通过 getter + this.resolve 从所属容器解析 SettingsService：
 * - resolve 从当前 Service 实例所属的容器解析依赖，容器内 singleton 缓存
 *   保证每次拿到同一个实例；
 * - 因此被依赖的 Service 必须注册在同一个容器树里（这里是同一个
 *   bindServices 列表；嵌套容器时沿父链向上也可解析到）；
 * - SettingsService 里也可以用同样的方式继续 resolve 别的服务。
 */

export class SettingsService extends Service {
  lang: Lang = "zh";

  setLang(lang: Lang) {
    this.lang = lang;
  }
}

export class GreetingService extends Service {
  // 推荐写法：getter + this.resolve，从所属容器解析依赖
  get settings() {
    return this.resolve(SettingsService);
  }

  name = "RAB";

  // getter 跨服务读取：settings.lang 变化时 greeting 也会自动更新
  get greeting(): string {
    return this.settings.lang === "zh"
      ? `你好，${this.name}！`
      : `Hello, ${this.name}!`;
  }

  setName(name: string) {
    this.name = name;
  }
}
