/**
 * 控制台友好报告输出
 *
 * 将断言结果以带颜色、层次化的格式输出到浏览器控制台。
 * 兼容不支持 %c 彩色输出的嵌入式 WebView DevTools（自动降级）。
 */

import type { AssertResult, AssertionResult } from '@rabjs/shared';

export interface ReportOptions {
  /** 是否将 console.group 折叠，默认 false（展开） */
  collapsed?: boolean;
  /** 是否在全部通过时也打印报告，默认 true */
  verbose?: boolean;
}

/**
 * 检测当前环境是否支持 console.group
 */
function supportsGroup(): boolean {
  return typeof console !== 'undefined' && typeof console.group === 'function';
}

/**
 * 格式化单条断言结果的行文本
 */
function formatResultLine(r: AssertionResult): string {
  const icon = r.passed ? '✓' : '✗';
  const opDesc = formatOpDesc(r);
  if (r.message) {
    return `  ${icon} ${r.path} ${opDesc}  (${r.message})`;
  }
  return `  ${icon} ${r.path} ${opDesc}`;
}

/**
 * 格式化操作符描述
 */
function formatOpDesc(r: AssertionResult): string {
  const { op, expected } = r;
  switch (op) {
    case 'eq': {
      return `=== ${formatValue(expected)}`;
    }
    case 'neq': {
      return `!== ${formatValue(expected)}`;
    }
    case 'gt': {
      return `> ${formatValue(expected)}`;
    }
    case 'gte': {
      return `>= ${formatValue(expected)}`;
    }
    case 'lt': {
      return `< ${formatValue(expected)}`;
    }
    case 'lte': {
      return `<= ${formatValue(expected)}`;
    }
    case 'exists': {
      return 'exists';
    }
    case 'notExists': {
      return 'notExists';
    }
    case 'includes': {
      return `includes ${formatValue(expected)}`;
    }
    case 'notIncludes': {
      return `notIncludes ${formatValue(expected)}`;
    }
    case 'matches': {
      return `matches /${String(expected)}/`;
    }
    case 'type': {
      return `typeof === "${String(expected)}"`;
    }
    case 'length': {
      return `length === ${formatValue(expected)}`;
    }
    case 'lengthGt': {
      return `length > ${formatValue(expected)}`;
    }
    case 'lengthGte': {
      return `length >= ${formatValue(expected)}`;
    }
    case 'lengthLt': {
      return `length < ${formatValue(expected)}`;
    }
    case 'lengthLte': {
      return `length <= ${formatValue(expected)}`;
    }
    case 'deepEq': {
      return `deepEq ${formatValue(expected)}`;
    }
    case 'between': {
      const [lo, hi] = expected as [number, number];
      return `between [${lo}, ${hi}]`;
    }
    case 'hasKeys': {
      return `hasKeys ${formatValue(expected)}`;
    }
    case 'matchObject': {
      return `matchObject ${formatValue(expected)}`;
    }
    case 'some': {
      return `some(...)`;
    }
    case 'every': {
      return `every(...)`;
    }
    default: {
      return String(op);
    }
  }
}

/**
 * 格式化值用于显示
 */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * 将断言结果打印到控制台
 *
 * 全部通过时：简洁单行（带折叠 group）
 * 有失败时：展开详细信息，每条失败项显示期望值和实际值
 *
 * @param result 断言结果
 * @param options 报告选项
 */
export function printAssertResult(
  result: AssertResult & { instanceId?: string },
  options: ReportOptions = {}
): void {
  const { collapsed = false, verbose = true } = options;

  // 如果全部通过且 verbose=false，不输出
  if (result.passed && !verbose) return;

  const instanceId = result.instanceId ?? '(unknown)';
  const desc = (result as { description?: string }).description;
  const statusIcon = result.passed ? '✅' : '❌';
  const summary = `[${result.summary.passed}/${result.summary.total}]`;
  const descPart = desc ? ` ${desc}` : '';
  const title = `${statusIcon} ${instanceId} ${summary}${descPart}`;

  if (supportsGroup()) {
    const groupFn = collapsed ? console.groupCollapsed : console.group;
    groupFn.call(console, title);

    for (const r of result.results) {
      if (r.passed) {
        console.log(`  ✓ ${r.path} ${formatOpDesc(r)}`);
      } else {
        console.warn(
          `  ✗ ${r.path} ${formatOpDesc(r)}\n` +
            `      Expected: ${formatValue(r.expected)}\n` +
            `      Actual:   ${formatValue(r.actual)}` +
            (r.message ? `\n      Message:  ${r.message}` : '')
        );
      }
    }

    console.groupEnd();
  } else {
    // 降级模式：不使用 console.group
    console.log(title);
    for (const r of result.results) {
      console.log(formatResultLine(r));
      if (!r.passed) {
        console.log(`      Expected: ${formatValue(r.expected)}`);
        console.log(`      Actual:   ${formatValue(r.actual)}`);
        if (r.message) {
          console.log(`      Message:  ${r.message}`);
        }
      }
    }
  }
}
