/*
 * set trap 转发帧的共享状态。
 *
 * 为什么必须是共享模块而不是各 handler 各自的模块级栈:
 * 原型链可以混合 base 与 shadow 两种 handler (base child 的原型是 shadow
 * observable, 或反之)。转发 walk 跨过 handler 边界时, 中层在"自己的栈"上
 * 打标记, 外层 receiver 的帧却在"另一个栈"上 —— 抑制逻辑完全失效
 * (链上 reaction 双通知)。帧栈必须全局唯一。
 * */
import { proxyToRaw } from "../proxy-raw-map";

export interface ForwardingSetFrame {
  target: object;
  key: PropertyKey;
  // 本帧转发窗口内, defineProperty trap 命中过该帧 (引擎路由回 receiver 的
  // [[DefineOwnProperty]], 或原型链 setter 对本层的同 key defineProperty)
  hit: boolean;
  // 转发 walk 链上同 key 的某一层已按落盘状态发出通知,
  // 最外层 receiver 的兜底 add 应跳过 (防止链上 reaction 双通知)
  covered: boolean;
}

export const forwardingSetFrames: ForwardingSetFrame[] = [];

export function pushForwardingFrame(target: object, key: PropertyKey): ForwardingSetFrame {
  const frame: ForwardingSetFrame = { target, key, hit: false, covered: false };
  forwardingSetFrames.push(frame);
  return frame;
}

export function popForwardingFrame(): void {
  forwardingSetFrames.pop();
}

/*
 * defineProperty trap 判定: 是否处于某帧的 {target, key} 转发窗口内。
 * 命中的帧标记 hit=true (该层 set trap 落盘后会重读实际值参与比较)。
 * */
export function markForwardedDefineProperty(target: object, key: PropertyKey): boolean {
  let forwarded = false;
  for (const frame of forwardingSetFrames) {
    if (frame.target === target && frame.key === key) {
      frame.hit = true;
      forwarded = true;
    }
  }
  return forwarded;
}

/*
 * 中层通知后, 把"本转发链根帧"标记 covered。
 *
 * 为什么锚定 receiver 而不是按 key 名匹配所有外层帧:
 * setter 内部可能出现**无关链**的嵌套写入 (只与外链同名 key)。若按 key 名
 * 匹配, 无关链的中层通知会把外层链的帧误标 covered, 外层 receiver 的兜底
 * add 被吞 —— 被观察值真的变了却丢通知。转发链的真根是 receiver 对应的
 * raw 对象: 只有 target === proxyToRaw.get(receiver) 的帧才是本链的帧。
 * (receiver 非本系统 proxy 时 proxyToRaw.get 返回 undefined, 天然无帧可标。)
 * */
export function markCoveredForReceiverRoot(receiver: unknown, key: PropertyKey): void {
  const rootTarget = proxyToRaw.get(receiver as object);
  if (rootTarget === undefined) {
    return;
  }
  for (const frame of forwardingSetFrames) {
    if (frame.target === rootTarget && frame.key === key) {
      frame.covered = true;
    }
  }
}
