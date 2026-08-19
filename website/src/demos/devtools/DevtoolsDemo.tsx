import { setupWindowRootContainer } from '@rabjs/devtools';
import type { RSRootContainerHandle } from '@rabjs/devtools';
import { useState } from 'react';

/**
 * DevTools live demo —— 列出当前页面容器树里所有已实例化的 Service。
 *
 * 真实项目中 setupWindowRootContainer() 在应用入口调用一次即可；
 * 这里在模块作用域调用（重复调用只是重新赋值 handle，无副作用）。
 * 本站所有 demo 都是通过 bindServices 挂到全局容器下的，
 * 所以你在本站点其他 demo 点几下，再回来刷新列表，就能看到对应实例。
 */
setupWindowRootContainer();

type ServiceRow = ReturnType<RSRootContainerHandle['listServices']>[number];

export default function DevtoolsDemo() {
  const [rows, setRows] = useState<ServiceRow[] | null>(null);

  const refresh = () => {
    setRows(window.__RS_ROOT_CONTAINER__?.listServices() ?? []);
  };

  return (
    <div>
      <div className="demo-row">
        <button className="demo-btn primary" onClick={refresh}>
          列出当前页面的 Service
        </button>
      </div>
      {rows ? (
        rows.length > 0 ? (
          <ul style={{ margin: '12px 0 0', paddingLeft: 20 }}>
            {rows.map(row => (
              <li key={row.instanceId} style={{ marginBottom: 6 }}>
                <code>{row.instanceId}</code>
                <span style={{ color: 'var(--text-dim)' }}> —— 容器 {row.containerName}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-dim)', marginTop: 12 }}>
            还没有已实例化的 Service。先去「在线 Demo」点几下，再回来刷新。
          </p>
        )
      ) : null}
    </div>
  );
}
