import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

/**
 * Demo 容器（全站统一的 live demo 展示组件）
 *
 * 用法：
 * ```tsx
 * import { DemoCard } from "../../components/DemoCard";
 * import CounterDemo from "../../demos/counter/CounterDemo";
 *
 * <DemoCard
 *   title="计数器"
 *   description="Service + observer 的最小示例"
 *   code={counterCodeString}   // 展示用源码字符串
 * >
 *   <CounterDemo />            // live 区：真实运行的组件
 * </DemoCard>
 * ```
 *
 * 约定：
 * - live demo 组件统一放在 src/demos/ 下（每个 demo 一个目录），页面只负责引用；
 * - `code` 是与 live 组件对应的源码字符串，保持同步（内容编写时手动维护）；
 * - 需要多文件展示时，可在 children 下方追加多个 <CodeBlock>，见 DemoCard 的 codeSlot 用法：
 *   也可以不传 code，把 <CodeBlock> 直接放在组件里组合。
 */
export interface DemoCardProps {
  title: string;
  description?: string;
  /** 展示用源码（tsx 高亮）；不传则不渲染代码区 */
  code?: string;
  /** live 区内容，通常是 src/demos/ 下的组件 */
  children: ReactNode;
}

export function DemoCard({ title, description, code, children }: DemoCardProps) {
  return (
    <section className="demo-card">
      <div className="demo-card-header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="demo-card-live">{children}</div>
      {code ? <CodeBlock language="tsx">{code}</CodeBlock> : null}
    </section>
  );
}
