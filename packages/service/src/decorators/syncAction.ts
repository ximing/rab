/**
 * SyncAction 装饰器，用于排除某些方法不使用 Action 批量更新
 * 在 Service 中，所有方法默认都是 Action，使用此装饰器可以排除特定方法
 *
 * @example
 * ```typescript
 * class UserService extends Service {
 *   @SyncAction
 *   syncData() {
 *     // 这个方法不会使用 Action 批量更新
 *   }
 * }
 * ```
 */
export function SyncAction(
  target: any,
  propertyKey: string,
  descriptor?: PropertyDescriptor
): PropertyDescriptor | void {
  // 标记该方法为非 Action
  if (descriptor && descriptor.value) {
    descriptor.value.__isNoAction = true;
    return descriptor;
  }
}
