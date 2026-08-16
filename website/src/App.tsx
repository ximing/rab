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
import SkillRnDebug from "./pages/ai/SkillRnDebug";
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
 *
 * 视觉语义：传统用法（人写代码）= --human 琥珀；AI 用法（agent 读写状态）= --agent 青。
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
  { to: "/ai/skill-rn-debug", label: "rab-rn-debug Skill" },
  { to: "/ai/web-mcp", label: "@rabjs/web-mcp" },
];

interface NavItem {
  to: string;
  label: string;
}

function NavGroup({
  title,
  items,
  accent,
}: {
  title: string;
  items: NavItem[];
  accent: "agent" | "human";
}) {
  const tick = accent === "agent" ? "bg-agent" : "bg-human";
  const activeText = accent === "agent" ? "text-agent" : "text-human";
  const activeBg = accent === "agent" ? "bg-agent/10" : "bg-human/10";
  return (
    <div className="mb-7">
      <p className="eyebrow mb-2 px-3 flex items-center">
        <span className={`inline-block w-2 h-2 rounded-sm mr-2 ${tick}`} />
        {title}
      </p>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/ai"}
          className={({ isActive }) =>
            [
              "block px-3 py-1.5 rounded-lg text-[13.5px] transition-colors no-underline",
              isActive
                ? `${activeBg} ${activeText} font-medium`
                : "text-fg/85 hover:bg-card hover:no-underline",
            ].join(" ")
          }
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
      <div className="flex min-h-screen">
        <aside className="w-[248px] shrink-0 border-r border-line bg-panel px-4 py-6 sticky top-0 h-screen overflow-y-auto max-md:hidden">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 px-3 mb-8 text-fg hover:no-underline"
          >
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-agent animate-[signal-pulse_2.2s_ease-in-out_infinite]" />
            <span className="text-[19px] font-bold tracking-tight font-display">
              RAB
            </span>
            <span className="font-mono text-[10px] text-dim border border-line rounded px-1.5 py-px mt-0.5">
              v9
            </span>
          </NavLink>
          <NavGroup title="传统用法" items={guideNav} accent="human" />
          <NavGroup title="AI 用法" items={aiNav} accent="agent" />
        </aside>
        <main className="flex-1 min-w-0 px-6 md:px-12 pt-10 pb-24 max-w-[960px] prose-rab">
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
            <Route path="/ai/skill-rn-debug" element={<SkillRnDebug />} />
            <Route path="/ai/web-mcp" element={<WebMcp />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
