/**
 * react-native 的 Platform 抽象。
 *
 * 用运行时 require 而非顶层 import：测试 / SSR / 非 RN 环境没有装
 * react-native，顶层 import 会让整个模块图直接解析失败。require 抛错后
 * 回退到默认值，保证包在任意 JS 环境都可加载。
 */
interface PlatformLike {
  OS: string;
  Version: string | number;
}

let platform: PlatformLike | undefined;

try {
  platform = (require('react-native') as { Platform: PlatformLike }).Platform;
} catch {
  platform = undefined;
}

export const Platform: PlatformLike = platform ?? {
  // 无 DOM lib（node types）：经 globalThis 探测，避免引用未声明的 navigator
  OS:
    (globalThis as { navigator?: { product?: string } }).navigator?.product === 'ReactNative'
      ? 'unknown'
      : 'web',
  Version: '0',
};
