import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";

import QuickStart from "./pages/guides/QuickStart";
import Demos from "./pages/guides/Demos";
import Service from "./pages/guides/Service";
import ObserverPage from "./pages/guides/ObserverPage";
import Devtools from "./pages/guides/Devtools";

import AiOverview from "./pages/ai/AiOverview";
import SkillRabReact from "./pages/ai/SkillRabReact";
import SkillCdpDebug from "./pages/ai/SkillCdpDebug";
import WebMcp from "./pages/ai/WebMcp";

/**
 * 路由约定
 * ----------
 * - 使用 HashRouter：GitHub Pages 项目页（https://ximing.github.io/rab/）没有
 *   SPA fallback，hash 路由刷新深层页面不会 404。vite.config.ts 的 base 仍为 '/rab/'。
 * - 快速开始只有一个页面：路由 /quick-start，文件在 src/pages/guides/QuickStart.tsx
 *   （它属于"传统用法"板块，所以放在 guides/ 目录下，但路由不套 /guides 前缀，
 *   方便首页和外链直接引用）。
 * - 传统用法板块其余页面都在 /guides/* 下；AI 用法板块在 /ai/* 下。
 * - 新增页面步骤：在 src/pages/ 对应目录建组件 -> 在下方 navItems 与 <Routes> 各加一条。
 */

const guideNav = [
  { to: "/quick-start", label: "快速开始" },
  { to: "/guides/demos", label: "在线 Demo" },
  { to: "/guides/service", label: "Service 服务容器" },
  { to: "/guides/observer", label: "Observer 观察者" },
  { to: "/guides/devtools", label: "DevTools 调试" },
];

const aiNav = [
  { to: "/ai", label: "AI 用法总览" },
  { to: "/ai/skill-rab-react", label: "rab-react Skill" },
  { to: "/ai/skill-cdp-debug", label: "rab-cdp-debug Skill" },
  { to: "/ai/web-mcp", label: "@rabjs/web-mcp" },
];

function NavGroup({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div className="nav-group">
      <p className="nav-group-title">{title}</p>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/ai"}
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div className="layout">
        <aside className="sidebar">
          <NavLink to="/" className="brand">
            RAB
          </NavLink>
          <NavGroup title="传统用法" items={guideNav} />
          <NavGroup title="AI 用法" items={aiNav} />
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />

            {/* 传统用法板块 */}
            <Route path="/quick-start" element={<QuickStart />} />
            <Route path="/guides/demos" element={<Demos />} />
            <Route path="/guides/service" element={<Service />} />
            <Route path="/guides/observer" element={<ObserverPage />} />
            <Route path="/guides/devtools" element={<Devtools />} />

            {/* AI 用法板块 */}
            <Route path="/ai" element={<AiOverview />} />
            <Route path="/ai/skill-rab-react" element={<SkillRabReact />} />
            <Route path="/ai/skill-cdp-debug" element={<SkillCdpDebug />} />
            <Route path="/ai/web-mcp" element={<WebMcp />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
