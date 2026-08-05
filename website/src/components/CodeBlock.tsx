import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

/**
 * 代码高亮块（全站统一的代码展示组件）
 *
 * 用法：
 * ```tsx
 * import { CodeBlock } from "../../components/CodeBlock";
 *
 * <CodeBlock language="tsx" title="Counter.tsx">{codeString}</CodeBlock>
 * ```
 *
 * - `code` 以字符串传入（模板字符串即可），不是 React 子元素；
 * - `language` 用 prism 的语言 id，文档站常用 "tsx" / "ts" / "bash" / "json"；
 * - `title` 可选，显示为代码块顶部的文件名条；
 * - 右上角始终有复制按钮。
 */
export interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ children: code, language = "tsx", title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用（非安全上下文等）时静默失败
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-title">
        <span>{title ?? language}</span>
        <button type="button" className="code-copy" onClick={copy}>
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
