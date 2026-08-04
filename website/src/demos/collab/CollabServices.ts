import { Inject, Service } from "@rabjs/react";

type Lang = "zh" | "en";

/**
 * 服务协作 demo 的两个 Service。
 *
 * GreetingService 通过 @Inject 从所属容器解析 SettingsService：
 * - 懒解析：第一次访问 this.settings 时才从容器 resolve，之后缓存；
 * - 链式：SettingsService 里也可以继续 @Inject 别的服务；
 * - 两个服务必须在同一个容器里（这里是同一个 bindServices）。
 */

export class SettingsService extends Service {
  lang: Lang = "zh";

  setLang(lang: Lang) {
    this.lang = lang;
  }
}

export class GreetingService extends Service {
  @Inject(SettingsService)
  private settings!: SettingsService;

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
