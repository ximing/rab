export function isClassComponent(Component: any) {
  return !!(
    typeof Component === 'function' &&
    Component.prototype &&
    Component.prototype.isReactComponent
  );
}
