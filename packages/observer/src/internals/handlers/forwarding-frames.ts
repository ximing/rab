/*
 * set trap 转发帧的共享状态。
 *
 * 为什么必须是共享模块而不是各 handler 各自的模块级栈:
 * 原型链可以混合 base 与 shadow 两种 handler (base child 的原型是 shadow
 * observable, 或反之)。转发 walk 跨过 handler 边界时, 中层在"自己的栈"上
 * 打标记, 外层 receiver 的帧却在"另一个栈"上 —— 抑制逻辑完全失效
 * (链上 reaction 双通知)。帧栈必须全局唯一。
 * */
import { proxyToRaw } from '../proxy-raw-map';

export interface ForwardingSetFrame {
  target: object;
  key: PropertyKey;
  // 本帧 set trap 转发时传给 Reflect.set 的 receiver。用于本帧按落盘状态通知后
  // 锚定「本转发链的根帧」做 covered 标记 (见 markNotifiedInFlightFrames)。
  receiver: unknown;
  // 本帧转发窗口内, defineProperty trap 命中过该帧 (引擎路由回 receiver 的
  // [[DefineOwnProperty]], 或原型链 setter 对本层的同 key defineProperty)
  hit: boolean;
  // 本帧转发窗口内, 同一 {target, key} 已有嵌套写入按落盘状态发出通知,
  // 本层的通知责任已被替代: receiver-mismatch 分支与最外层 receiver 的
  // 兜底 add 都应跳过 (防止链上 reaction 双通知)
  covered: boolean;
  // covered 时随通知携带的「已通知值」(该次嵌套写入实际落盘并通知的值)。
  // covered 是布尔时有一个漏洞 (对抗审查第 4 轮 #1/#3): 同一转发窗口内,
  // 嵌套 set 通知之后 setter 还可能对同一 {target, key} 再次落盘 (显式
  // defineProperty 改值 / 重定义 accessor / 写回 receiver 的 landed 分支)。
  // 这些路径的通知责任都依赖被 covered 抑制的分支, 若只按布尔跳过,
  // 7→9 的落盘变化就无人通知, reaction 永久停留在中间值。因此跳过前必须
  // 比较「本帧落盘后的实际值」与 notifiedValue: 一致才是真正的重复通知
  // (G2b 单通知语义); 不一致则按差值补发并更新记录。
  // covered === true 时 notifiedValue 一定已被赋值 (两者只在
  // markNotifiedInFlightFrames / markCoveredForReceiverRoot 中成对写入)。
  notifiedValue: unknown;
}

export const forwardingSetFrames: ForwardingSetFrame[] = [];

export function pushForwardingFrame(
  target: object,
  key: PropertyKey,
  receiver: unknown
): ForwardingSetFrame {
  const frame: ForwardingSetFrame = {
    target,
    key,
    receiver,
    hit: false,
    covered: false,
    notifiedValue: undefined,
  };
  forwardingSetFrames.push(frame);
  return frame;
}

export function popForwardingFrame(): void {
  forwardingSetFrames.pop();
}

/*
 * defineProperty trap 判定: 是否处于某帧的 {target, key} 转发窗口内。
 * 命中的帧标记 hit=true (该层 set trap 落盘后会重读实际值参与比较)。
 *
 * 两类命中必须区分 (G2b 修复):
 *
 * 1. 引擎路由 (来自最内层 set trap 的 Reflect.set): OrdinarySetWithOwnDescriptor
 *    把 [[DefineOwnProperty]] 发到该次 Reflect.set 的 receiver 上。判定只认
 *    「trap 的 target === 栈顶帧的 target」—— 即嵌套 set trap 写自己那层的
 *    自有属性 (含 receiver 就是栈顶层自身 proxy 的场景)。此类命中**只标记
 *    栈顶帧**: 若按 {target,key} 匹配所有帧, 原型链 setter 内的嵌套普通赋值
 *    (middle.k = 7) 路由回来时会把外层同 {target,key} 帧 (middle 帧) 也标记
 *    hit, 外层 set trap 在 receiver-mismatch 分支额外通知, 与嵌套 set 自己的
 *    通知叠加 → 双通知。
 *    注意**不**用「target === proxyToRaw.get(栈顶帧的 receiver)」做路由判定:
 *    写入落回转发链根 receiver raw 时 (场景B), 栈顶帧往往是链中层帧, 该定义
 *    应交给帧循环去匹配链上真正的根帧 (根 set trap 通知); 若链上没有根帧
 *    (用户显式 Reflect.set(parent, k, v, child)), defineProperty trap 直接
 *    通知才是正确语义, 顶层短路会把通知吞掉。
 *
 * 2. 用户在转发窗口内对某在飞帧同 {target, key} 的 Object.defineProperty
 *    (如原型链 setter 对链上中间层的同 key defineProperty, 对抗审查 #1b):
 *    这不满足栈顶路由判定, 但语义上是「本帧转发窗口内的落盘」, 仍透传 +
 *    标记命中的帧 hit, 由该层 set trap 落盘后统一比较通知。
 * */
export function markForwardedDefineProperty(target: object, key: PropertyKey): boolean {
  const top = forwardingSetFrames[forwardingSetFrames.length - 1];
  if (top !== undefined && top.key === key && top.target === target) {
    top.hit = true;
    return true;
  }
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
 * set trap 正常路径 (target === proxyToRaw.get(receiver)) 按落盘状态发出通知后调用:
 * 同一 {target, key} 的在飞帧的通知责任已被本次通知替代 ——
 * - 在飞帧标记 covered: 该层 set trap 的 receiver-mismatch 分支不再重复通知
 *   (G2b: 嵌套 middle.k = 7 通知后, 外层 middle 帧的 mismatch 通知是重复的);
 * - 该帧所属转发链的根帧也标记 covered (锚定该帧的 receiver): 根 set trap
 *   的兜底 add 不再重复 (链根 reaction 经原型链 get 已注册了对本 {target,key}
 *   的依赖, 已随本次通知触发)。
 * 只按 {target, key} 精确匹配在飞帧 —— 无关链的同名 key 嵌套写入的 target
 * 不同, 天然不会误标 (不会重蹈按 key 全标的覆辙)。
 * value 是本次通知携带的落盘值: 被标记的帧记录为 notifiedValue, 后续分支
 * 跳过通知前据此判断「窗口内是否又发生了新的同 key 落盘」(值一致才是真正的
 * 重复通知, 不一致必须按差值补发, 见 ForwardingSetFrame.notifiedValue 注释)。
 * */
export function markNotifiedInFlightFrames(target: object, key: PropertyKey, value: unknown): void {
  if (forwardingSetFrames.length === 0) {
    return;
  }
  for (const frame of forwardingSetFrames) {
    if (frame.target === target && frame.key === key) {
      frame.covered = true;
      frame.notifiedValue = value;
      markCoveredForReceiverRoot(frame.receiver, key, value);
    }
  }
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
export function markCoveredForReceiverRoot(
  receiver: unknown,
  key: PropertyKey,
  value: unknown
): void {
  const rootTarget = proxyToRaw.get(receiver as object);
  if (rootTarget === undefined) {
    return;
  }
  for (const frame of forwardingSetFrames) {
    if (frame.target === rootTarget && frame.key === key) {
      frame.covered = true;
      frame.notifiedValue = value;
    }
  }
}
