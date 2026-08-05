import { bindServices, observer, useService } from "@rabjs/react";
import { GreetingService, SettingsService } from "./CollabServices";

/**
 * 服务协作 live demo —— GreetingService 通过 getter + this.resolve 解析 SettingsService。
 * 切换语言时只改 SettingsService.lang，GreetingService.greeting
 * 作为跨服务的 computed 自动跟着变。
 */
const Collab = observer(() => {
  const settings = useService(SettingsService);
  const greeting = useService(GreetingService);

  return (
    <div>
      <div className="demo-row">
        <button
          className={`demo-btn${settings.lang === "zh" ? " primary" : ""}`}
          onClick={() => settings.setLang("zh")}
        >
          中文
        </button>
        <button
          className={`demo-btn${settings.lang === "en" ? " primary" : ""}`}
          onClick={() => settings.setLang("en")}
        >
          English
        </button>
        <input
          value={greeting.name}
          onChange={(e) => greeting.setName(e.target.value)}
          style={{ padding: "6px 10px" }}
        />
      </div>
      <p style={{ fontSize: 18, marginTop: 12 }}>{greeting.greeting}</p>
    </div>
  );
});

export default bindServices(Collab, [SettingsService, GreetingService]);
