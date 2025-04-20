/** Decorates a class method so that it is debounced by the specified duration */
import { debounceDecorator } from '../symbols';
import { DEFAULT_DEBOUNCE_DURATION } from '../utils/debounce';

export default function outerDecorator(duration?: number) {
  if (duration && duration < 0) {
    throw new Error('节流值必须为大于0的数字');
  }
  return function innerDecorator(target: any, key: string) {
    Reflect.defineMetadata(debounceDecorator, duration || DEFAULT_DEBOUNCE_DURATION, target, key);
  };
}
