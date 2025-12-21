import { Operation } from '@rabjs/observer';

export function debuggerReaction(operation: Operation) {
  if (['get', 'has', 'iterate'].includes(operation.type)) {
    return;
  }
  console.log(
    '数据变更触发了 schedule:',
    `target`,
    operation.target,
    'key',
    operation.key,
    'type',
    operation.type,
    'value: ',
    operation.value,
    'oldValue:',
    operation.oldValue
  );
}
