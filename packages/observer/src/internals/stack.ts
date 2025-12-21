/**
 * 栈数据结构的 TypeScript 实现
 * 支持泛型,提供类型安全的栈操作
 * 使用 Map 优化 has 操作,将时间复杂度从 O(n) 降至 O(1)
 */
export class Stack<T> {
  private items: T[] = [];
  private itemCounts: Map<T, number> = new Map();

  /**
   * 获取栈的大小
   * 使用 getter 代替手动维护,避免不一致问题
   */
  get size(): number {
    return this.items.length;
  }

  /**
   * 清空栈
   */
  clear(): void {
    this.items = [];
    this.itemCounts.clear();
  }

  /**
   * 向栈顶添加元素
   * @param item - 要添加的元素
   * @returns 栈的新大小
   */
  push(item: T): number {
    this.items.push(item);
    // 优化: 使用 || 0 代替 ?? 0,减少一次类型检查
    // 因为 Map.get() 返回 undefined 或 number,0 是安全的默认值
    this.itemCounts.set(item, (this.itemCounts.get(item) || 0) + 1);
    return this.items.length;
  }

  /**
   * 移除并返回栈顶元素
   * @returns 栈顶元素,如果栈为空则返回 undefined
   */
  pop(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }
    const item = this.items.pop();
    if (item !== undefined) {
      const count = this.itemCounts.get(item);
      if (count === 1) {
        this.itemCounts.delete(item);
      } else if (count !== undefined) {
        this.itemCounts.set(item, count - 1);
      }
    }
    return item;
  }

  /**
   * 获取栈顶元素(不移除)
   * @returns 栈顶元素,如果栈为空则返回 undefined
   */
  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  /**
   * 检查栈是否为空
   * @returns 如果栈为空返回 true
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * 检查栈中是否包含指定元素
   * 时间复杂度: O(1)
   * @param item - 要查找的元素
   * @returns 如果包含返回 true
   */
  has(item: T): boolean {
    return this.itemCounts.has(item);
  }

  /**
   * 遍历栈中的元素(从栈顶到栈底)
   * @param callback - 对每个元素执行的回调函数
   * @param thisArg - 回调函数中 this 的值
   */
  forEach(callback: (value: T, index: number, stack: this) => void, thisArg?: unknown): void {
    const context = thisArg ?? this;
    const l = this.items.length;
    for (let i = 0; i < l; i++) {
      callback.call(context, this.items[l - i - 1], i, this);
    }
  }

  /**
   * 将栈转换为数组(从栈顶到栈底)
   * @returns 包含栈中所有元素的数组
   */
  toArray(): T[] {
    const l = this.items.length;
    const array = new Array<T>(l);
    let i = l;

    while (i--) {
      array[i] = this.items[l - i - 1];
    }

    return array;
  }

  /**
   * 创建一个迭代器,用于遍历栈中的值(从栈顶到栈底)
   * @returns 值迭代器
   */
  *values(): IterableIterator<T> {
    const l = this.items.length;
    for (let i = 0; i < l; i++) {
      yield this.items[l - i - 1];
    }
  }

  /**
   * 创建一个迭代器,用于遍历栈中的键值对(从栈顶到栈底)
   * @returns 键值对迭代器
   */
  *entries(): IterableIterator<[number, T]> {
    const l = this.items.length;
    for (let i = 0; i < l; i++) {
      yield [i, this.items[l - i - 1]];
    }
  }

  /**
   * 使栈可迭代
   */
  [Symbol.iterator](): IterableIterator<T> {
    return this.values();
  }

  /**
   * 转换为字符串
   */
  toString(): string {
    return this.toArray().join(',');
  }

  /**
   * 转换为 JSON
   */
  toJSON(): T[] {
    return this.toArray();
  }

  /**
   * 从可迭代对象创建栈
   * @param iterable - 可迭代对象
   * @returns 新的栈实例
   */
  static from<T>(iterable: Iterable<T>): Stack<T> {
    const stack = new Stack<T>();
    for (const value of iterable) {
      stack.push(value);
    }
    return stack;
  }

  /**
   * 获取指定元素在栈中的出现次数
   * @param item - 要查询的元素
   * @returns 出现次数
   */
  count(item: T): number {
    return this.itemCounts.get(item) ?? 0;
  }

  /**
   * 从参数列表创建栈
   * @param args - 参数列表
   * @returns 新的栈实例
   */
  static of<T>(...args: T[]): Stack<T> {
    return Stack.from(args);
  }
}
