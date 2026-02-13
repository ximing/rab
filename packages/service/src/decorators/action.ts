/**
 * Action 装饰器，用于标记需要批量更新的方法
 * 注意：在 Service 中，所有方法默认都是 action，除非使用 @SyncAction 装饰器
 *
 * @example
 * ```typescript
 * class UserService extends Service {
 *   @Action
 *   async fetchUser(id: string) {
 *     return fetch(`/api/users/${id}`).then(r => r.json());
 *   }
 * }
 * ```
 */
export function Action(
  target: any,
  propertyKey: string,
  descriptor?: PropertyDescriptor
): PropertyDescriptor | void {
  // 标记该方法为 Action
  if (descriptor && descriptor.value) {
    descriptor.value.__isAction = true;
    return descriptor;
  }
}
