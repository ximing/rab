/* eslint-disable no-console */
import type { AssertResult, AssertionResult } from './assertions';

export interface ReportOptions {
  collapsed?: boolean;
  verbose?: boolean;
}

export function printAssertResult(result: AssertResult, options: ReportOptions = {}): void {
  const { collapsed = false, verbose = false } = options;
  const icon = result.pass ? '✅' : '❌';
  const title = `${icon} [${result.instanceId}]${result.description ? ` ${result.description}` : ''}`;

  const groupFn =
    typeof console.group === 'function'
      ? collapsed
        ? console.groupCollapsed.bind(console)
        : console.group.bind(console)
      : console.log.bind(console);

  const groupEnd =
    typeof console.groupEnd === 'function' ? console.groupEnd.bind(console) : () => {};

  groupFn(title);

  result.results.forEach((r: AssertionResult) => {
    if (!verbose && r.pass) return;
    const icon = r.pass ? '✓' : '✗';
    const label = r.description ? `${r.description} (${r.path})` : r.path;
    if (r.pass) {
      console.log(`  ${icon} ${label}`);
    } else {
      console.warn(`  ${icon} ${label}`);
      console.warn(`    op: ${r.op}`);
      console.warn(`    actual:  `, r.actual);
      if (r.expected !== undefined) {
        console.warn(`    expected:`, r.expected);
      }
      if (r.error) {
        console.warn(`    error:   `, r.error.message);
      }
    }
  });

  groupEnd();
}
