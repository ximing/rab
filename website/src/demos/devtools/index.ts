import DevtoolsDemo from "./DevtoolsDemo";

export default DevtoolsDemo;

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 DevtoolsDemo 时同步更新这里的字符串。
 */
export const devtoolsDemoCode = `import { useState } from "react";
import { setupWindowRootContainer } from "@rabjs/devtools";

// 应用入口调用一次：把容器树访问 API 挂到 window.__RS_ROOT_CONTAINER__
setupWindowRootContainer();

export default function DevtoolsDemo() {
  const [rows, setRows] = useState<any[] | null>(null);

  const refresh = () => {
    // listServices() 返回整棵容器树中所有已实例化的 Service（内存对象快照）
    setRows(window.__RS_ROOT_CONTAINER__?.listServices() ?? []);
  };

  return (
    <div>
      <button onClick={refresh}>列出当前页面的 Service</button>
      {rows?.map((row) => (
        <p key={row.instanceId}>
          {row.instanceId} —— 容器 {row.containerName}
        </p>
      ))}
    </div>
  );
}
`;
