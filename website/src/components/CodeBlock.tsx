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
 * - `title` 可选，显示为代码块顶部的文件名条。
 */
export interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ children: code, language = "tsx", title }: CodeBlockProps) {
  return (
    <div className="code-block">
      {title ? <div className="code-block-title">{title}</div> : null}
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
