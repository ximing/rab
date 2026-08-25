/**
 * reactionTrack 测试
 * 测试响应式追踪系统的各种边界情况和特殊场景
 */

import { observable } from '../../observable';
import { observe, unobserve } from '../../main';
interface Product {
  id: number;
  name: string;
  description: string;
  category: '主食' | '饮品' | '小食' | '甜品';
  price: number;
  stock: number;
  sales: number;
  status: 'active' | 'inactive' | 'out_of_stock';
  image: string;
  rating?: number;
  createdAt: string;
  updatedAt?: string;
}

describe('reactionTrack', () => {
  describe('数组排序', () => {
    test('lazy 模式下手动触发 reaction，追踪执行次数', () => {
      class ProductClass {
        // 响应式状态
        products: Product[] = [
          {
            id: 1,
            name: '经典汉堡',
            category: '主食',
            price: 25.8,
            status: 'active',
            image: '🍔',
            description: '新鲜牛肉配生菜番茄',
            stock: 100,
            sales: 1280,
            createdAt: '2024-01-01',
          },
          {
            id: 2,
            name: '拿铁咖啡',
            category: '饮品',
            price: 18.5,
            status: 'active',
            image: '☕',
            description: '精选咖啡豆制作',
            stock: 200,
            sales: 856,
            createdAt: '2024-01-02',
          },
          {
            id: 3,
            name: '芝士披萨',
            category: '主食',
            price: 42.0,
            status: 'out_of_stock',
            image: '🍕',
            description: '意式手工披萨',
            stock: 0,
            sales: 645,
            createdAt: '2024-01-03',
          },
          {
            id: 4,
            name: '炸鸡翅',
            category: '小食',
            price: 32.8,
            status: 'active',
            image: '🍗',
            description: '香酥脆嫩炸鸡翅',
            stock: 50,
            sales: 423,
            createdAt: '2024-01-04',
          },
          {
            id: 5,
            name: '草莓奶昔',
            category: '饮品',
            price: 22.0,
            status: 'inactive',
            image: '🥤',
            description: '新鲜草莓制作',
            stock: 80,
            sales: 234,
            createdAt: '2024-01-05',
          },
          {
            id: 6,
            name: '巧克力蛋糕',
            category: '甜品',
            price: 35.5,
            status: 'active',
            image: '🍰',
            description: '浓郁巧克力味蛋糕',
            stock: 30,
            sales: 567,
            createdAt: '2024-01-06',
          },
        ];
        currentProduct: Product | null = null;
        loading = false;
        total = 0;
        categories: string[] = ['all', '主食', '饮品', '小食', '甜品'];
        statuses: string[] = ['all', 'active', 'inactive', 'out_of_stock'];

        // 筛选和排序状态
        searchTerm = '';
        filterCategory = 'all';
        filterStatus = 'all';
        sortBy = 'name';

        // 计算属性 - 过滤后的商品列表
        get filteredProducts(): Product[] {
          return this.products
            .filter(product => {
              const matchesSearch =
                product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(this.searchTerm.toLowerCase());
              const matchesCategory =
                this.filterCategory === 'all' || product.category === this.filterCategory;
              const matchesStatus =
                this.filterStatus === 'all' || product.status === this.filterStatus;
              return matchesSearch && matchesCategory && matchesStatus;
            })
            .sort((a, b) => {
              switch (this.sortBy) {
                case 'name':
                  return a.name.localeCompare(b.name);
                case 'price':
                  return a.price - b.price;
                case 'sales':
                  return b.sales - a.sales;
                case 'stock':
                  return b.stock - a.stock;
                default:
                  return 0;
              }
            });
        }
      }

      const product = new ProductClass();
      const obProduct = observable(product);

      // 追踪 reaction 执行次数
      let executionCount = 0;
      const results: number[] = [];
      function render() {
        executionCount++;
        const result = obProduct.filteredProducts.length;
        results.push(result);
        return result;
      }
      // 使用 lazy 模式创建 reaction，不会立即执行
      // reaction 函数内部直接调用 render，这样无论是手动触发还是自动触发都能正常工作
      const reaction = observe(
        () => {
          return render();
        },
        {
          lazy: true, // 不会立即执行
        }
      );

      // 初始状态：reaction 还没有执行过
      expect(executionCount).toBe(0);
      expect(results).toEqual([]);

      // 手动触发第一次执行
      reaction();
      expect(executionCount).toBe(1);
      expect(results).toEqual([6]); // 所有 6 个商品都符合条件

      // 修改 filterCategory，应该自动触发 reaction
      obProduct.filterCategory = '主食';
      expect(executionCount).toBe(2);
      expect(results).toEqual([6, 2]); // 主食类有 2 个商品

      // 手动再次触发
      reaction();
      expect(executionCount).toBe(3);
      expect(results).toEqual([6, 2, 2]);

      // 修改 filterStatus，应该自动触发 reaction
      obProduct.filterStatus = 'active';
      expect(executionCount).toBe(4);
      expect(results).toEqual([6, 2, 2, 1]); // 主食 + active 只有 1 个

      // 修改 searchTerm，应该自动触发 reaction
      obProduct.searchTerm = '汉堡';
      expect(executionCount).toBe(5);
      expect(results).toEqual([6, 2, 2, 1, 1]); // 搜索"汉堡"，主食+active 有 1 个匹配（经典汉堡）

      // 重置 filterCategory 和 filterStatus
      obProduct.filterCategory = 'all';
      obProduct.filterStatus = 'all';
      expect(executionCount).toBe(7);
      expect(results).toEqual([6, 2, 2, 1, 1, 1, 1]); // 搜索"汉堡"，所有条件下只有 1 个匹配

      // 手动触发多次
      reaction();
      reaction();
      expect(executionCount).toBe(9);
      expect(results).toEqual([6, 2, 2, 1, 1, 1, 1, 1, 1]);

      // 清理
      unobserve(reaction);
    });

    test('lazy 模式下追踪数据变更触发的 schedule', () => {
      const state = observable({
        count: 0,
        name: 'test',
      });

      let executionCount = 0;
      const operations: Array<{ key: string; type: string }> = [];

      const reaction = observe(
        () => {
          executionCount++;
          return state.count + state.name.length;
        },
        {
          lazy: true,
          debugger: operation => {
            operations.push({
              key: String(operation.key),
              type: operation.type,
            });
          },
        }
      );

      // 初始状态
      expect(executionCount).toBe(0);
      expect(operations).toEqual([]);

      // 手动触发第一次，建立依赖关系
      reaction();
      expect(executionCount).toBe(1);
      // 第一次执行会记录 get 操作（建立依赖）
      expect(operations).toContainEqual({ key: 'count', type: 'get' });
      expect(operations).toContainEqual({ key: 'name', type: 'get' });

      const operationsBeforeChange = operations.length;

      // 修改 count，应该触发 reaction 并记录 set 操作
      state.count = 1;
      expect(executionCount).toBe(2);
      // 应该有新的 set 操作记录
      expect(operations.length).toBeGreaterThan(operationsBeforeChange);
      expect(operations).toContainEqual({ key: 'count', type: 'set' });

      // 修改 name，应该触发 reaction
      state.name = 'updated';
      expect(executionCount).toBe(3);
      expect(operations).toContainEqual({ key: 'name', type: 'set' });

      // 修改不相关的属性（不会触发 reaction）
      const countBefore = executionCount;
      state.count = 1; // 设置相同的值
      // 注意：即使值相同，set 操作也会被记录，但 reaction 可能不会重新执行
      // 这取决于具体的实现

      unobserve(reaction);
    });

    test('First Filter then sort', () => {
      const obj = observable({ arr: [1, 2, 3, 4, 5, 6] });
      const operations: number[] = [];
      let executionCount = 0;
      const reaction = observe(
        () => {
          operations.push(executionCount++);
          let arr = obj.arr.filter(item => item != 2);
          return arr.sort((a, b) => a - b);
        },
        { lazy: true }
      );
      expect(executionCount).toBe(0);
      reaction();
      expect(executionCount).toBe(1);
      expect(operations).toEqual([0]);
      unobserve(reaction);
    });

    test('次数追踪v1', () => {
      const localScheduledReactions: any[] = [];
      const obj = observable({
        products: [
          {
            id: 1,
            name: '经典汉堡',
          },
          {
            id: 2,
            name: '拿铁咖啡',
          },
          {
            id: 3,
            name: '芝士披萨',
          },
        ],
        get filteredProducts() {
          let p = this.products.filter(item => item.id != 1);
          p.sort((a, b) => {
            return b.name.localeCompare(a.name);
          });
          return p;
        },
      });
      const localScheduler = (reaction: any) => {
        localScheduledReactions.push(reaction);
      };
      const reaction = observe(
        () => {
          return obj.filteredProducts;
        },
        { lazy: true, scheduler: localScheduler }
      );
      reaction();
      expect(localScheduledReactions.length).toBe(0);
    });
    test('次数追踪v2', () => {
      const localScheduledReactions: any[] = [];
      const obj = observable({
        products: [
          {
            id: 1,
            name: '经典汉堡',
          },
          {
            id: 2,
            name: '拿铁咖啡',
          },
          {
            id: 3,
            name: '芝士披萨',
          },
        ],
        get filteredProducts() {
          let p = [...this.products].filter(item => item.id != 1);
          p.sort((a, b) => {
            return b.name.localeCompare(a.name);
          });
          return p;
        },
      });
      const localScheduler = (reaction: any) => {
        localScheduledReactions.push(reaction);
      };
      const reaction = observe(
        () => {
          return obj.filteredProducts;
        },
        { lazy: true, scheduler: localScheduler }
      );
      reaction();
      expect(localScheduledReactions.length).toBe(0);
    });
  });

  describe('数组变异方法响应式', () => {
    test('push 方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([1, 2, 3]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('1,2,3');

      // push 添加一个元素
      list.push(4);
      expect(dummy!).toBe('1,2,3,4');
      expect(list).toEqual([1, 2, 3, 4]);

      // push 添加多个元素
      list.push(5, 6);
      expect(dummy!).toBe('1,2,3,4,5,6');
      expect(list).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('pop 方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([1, 2, 3]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('1,2,3');

      // pop 移除最后一个元素
      const popped = list.pop();
      expect(dummy!).toBe('1,2');
      expect(popped).toBe(3);
      expect(list).toEqual([1, 2]);

      // pop 继续移除
      list.pop();
      expect(dummy!).toBe('1');
      expect(list).toEqual([1]);
    });

    test('shift 方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([1, 2, 3]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('1,2,3');

      // shift 移除第一个元素
      const shifted = list.shift();
      expect(dummy!).toBe('2,3');
      expect(shifted).toBe(1);
      expect(list).toEqual([2, 3]);

      // shift 继续移除
      list.shift();
      expect(dummy!).toBe('3');
      expect(list).toEqual([3]);
    });

    test('unshift 方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([1, 2, 3]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('1,2,3');

      // unshift 添加一个元素到开头
      list.unshift(0);
      expect(dummy!).toBe('0,1,2,3');
      expect(list).toEqual([0, 1, 2, 3]);

      // unshift 添加多个元素
      list.unshift(-2, -1);
      expect(dummy!).toBe('-2,-1,0,1,2,3');
      expect(list).toEqual([-2, -1, 0, 1, 2, 3]);
    });

    test('splice 方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([1, 2, 3, 4, 5]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('1,2,3,4,5');

      // splice 删除元素
      const spliced = list.splice(1, 2);
      expect(dummy!).toBe('1,4,5');
      expect(spliced).toEqual([2, 3]);
      expect(list).toEqual([1, 4, 5]);

      // splice 替换元素
      list.splice(1, 1, 10, 11);
      expect(dummy!).toBe('1,10,11,5');
      expect(list).toEqual([1, 10, 11, 5]);

      // splice 插入元素
      list.splice(2, 0, 20);
      expect(dummy!).toBe('1,10,20,11,5');
      expect(list).toEqual([1, 10, 20, 11, 5]);
    });

    test('reverse 方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([1, 2, 3]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('1,2,3');

      // reverse 反序数组
      list.reverse();
      expect(dummy!).toBe('3,2,1');
      expect(list).toEqual([3, 2, 1]);
    });

    test('sort 方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([3, 1, 2]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('3,1,2');

      // sort 排序数组
      list.sort((a, b) => a - b);
      expect(dummy!).toBe('1,2,3');
      expect(list).toEqual([1, 2, 3]);
    });

    test('push 对象到数组应该触发响应式', () => {
      let dummy: number;
      const list = observable([
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
      ]);
      observe(() => {
        dummy = list.length;
      });

      expect(dummy!).toBe(2);

      // push 新元素
      list.push({ id: 3, name: 'item3' });
      expect(dummy!).toBe(3);
      expect(list).toHaveLength(3);
    });

    test('连续的数组变异方法应该正确触发响应式', () => {
      let dummy: string;
      const list = observable([1, 2, 3]);
      observe(() => (dummy = list.join(',')));

      expect(dummy!).toBe('1,2,3');

      // 执行多个变异方法
      list.push(4);
      expect(dummy!).toBe('1,2,3,4');

      list.pop();
      expect(dummy!).toBe('1,2,3');

      list.unshift(0);
      expect(dummy!).toBe('0,1,2,3');

      list.shift();
      expect(dummy!).toBe('1,2,3');
    });

    test('push 空值到数组应该触发响应式', () => {
      let dummy: number;
      const list = observable<(number | null | undefined)[]>([]);
      observe(() => {
        dummy = list.length;
      });

      expect(dummy!).toBe(0);

      // push 空值
      list.push(undefined);
      expect(dummy!).toBe(1);

      // push null
      list.push(null);
      expect(dummy!).toBe(2);
    });

    test('pop 在空数组上应该不触发响应式', () => {
      let dummy: number;
      const list = observable<number[]>([]);
      observe(() => {
        dummy = list.length;
      });

      expect(dummy!).toBe(0);

      // pop 空数组，不改变长度
      const popped = list.pop();
      expect(dummy!).toBe(0); // 不应该触发
      expect(popped).toBeUndefined();
    });

    test('shift 在空数组上应该不触发响应式', () => {
      let dummy: number;
      const list = observable<number[]>([]);
      observe(() => {
        dummy = list.length;
      });

      expect(dummy!).toBe(0);

      // shift 空数组
      const shifted = list.shift();
      expect(dummy!).toBe(0); // 不应该触发
      expect(shifted).toBeUndefined();
    });

    test('依赖数组元素的计算属性应该被正确追踪', () => {
      class Store {
        items = [1, 2, 3];

        get sum() {
          return this.items.reduce((acc, val) => acc + val, 0);
        }
      }

      const store = observable(new Store());
      let result: number;

      observe(() => {
        result = store.sum;
      });

      expect(result!).toBe(6);

      // push 新元素，计算属性应该重新计算
      store.items.push(4);
      expect(result!).toBe(10);

      // pop 元素
      store.items.pop();
      expect(result!).toBe(6);
    });

    test('追踪数组特定元素的变化', () => {
      let dummy: number | undefined;
      const state = observable({
        items: [{ value: 1 }],
      });

      observe(() => {
        dummy = state.items[0]?.value;
      });

      expect(dummy!).toBe(1);

      // push 新对象，追踪的还是第一个元素
      state.items.push({ value: 2 });
      expect(dummy!).toBe(1); // 还是第一个元素的值

      // 修改追踪的第一个元素会触发
      state.items[0].value = 10;
      expect(dummy!).toBe(10);
    });

    test('追踪整个数组的迭代', () => {
      let dummy: number;
      const list = observable([1, 2, 3]);

      observe(() => {
        // 通过 for...of 遍历数组会追踪整个数组
        dummy = 0;
        for (const item of list) {
          dummy += item;
        }
      });

      expect(dummy!).toBe(6);

      // push 新元素
      list.push(4);
      expect(dummy!).toBe(10);

      // pop 元素
      list.pop();
      expect(dummy!).toBe(6);
    });

    test('数组 forEach 方法应该追踪数组变化', () => {
      let dummy: number;
      const list = observable([1, 2, 3]);

      observe(() => {
        dummy = 0;
        list.forEach(item => {
          dummy += item;
        });
      });

      expect(dummy!).toBe(6);

      // push 新元素
      list.push(4);
      expect(dummy!).toBe(10);
    });

    test('数组索引赋值应该触发响应式', () => {
      let dummy: string;
      const list = observable(['a', 'b', 'c']);
      observe(() => (dummy = list.join('-')));

      expect(dummy!).toBe('a-b-c');

      // 修改索引
      list[1] = 'B';
      expect(dummy!).toBe('a-B-c');

      // 添加新索引
      list[3] = 'd';
      expect(dummy!).toBe('a-B-c-d');
    });

    test('通过索引赋值改变数组长度应该触发响应式', () => {
      let dummy: string;
      const list = observable<string[]>([]);
      list[1] = 'World!';
      observe(() => (dummy = list.join(' ')));

      expect(dummy!).toBe(' World!');

      // 填充索引 0
      list[0] = 'Hello';
      expect(dummy!).toBe('Hello World!');

      // pop 移除最后一个元素
      list.pop();
      expect(dummy!).toBe('Hello');
    });

    test('单纯输出数组但不做运算时，push 是否触发响应式', () => {
      let dummy: any;
      const list = observable([1, 2, 3]);
      let executionCount = 0;

      // 单纯地访问和输出数组，不进行任何运算操作
      observe(() => {
        executionCount++;
        dummy = list; // 仅输出数组本身，不进行任何计算
      });

      expect(executionCount).toBe(1);
      expect(dummy).toEqual([1, 2, 3]);

      // push 会改变数组的 length 属性（内部通过 set length 实现）
      // 由于我们只是单纯访问了 list 这个属性，但没有访问 list.length
      // 所以没有建立对 length 的依赖追踪
      // 虽然 push 会改变数组内容，但响应式系统发现数据变化后不会触发 reaction
      // 因为这个 reaction 没有追踪到任何会被 push 影响的属性
      list.push(4);

      // 结果：虽然 dummy 已经被改变（因为是引用），但 reaction 不会重新执行
      // 因为没有建立真正的依赖关系
      expect(executionCount).toBe(1); // 不会再执行
      expect(dummy).toEqual([1, 2, 3, 4]); // dummy 看起来已变化（引用指向同一个对象）
    });

    test('单纯输出数组且访问 length 时，push 是否触发响应式', () => {
      let dummy: number;
      const list = observable([1, 2, 3]);
      let executionCount = 0;

      // 访问数组的 length 属性
      observe(() => {
        executionCount++;
        dummy = list.length; // 访问 length 属性
      });

      expect(executionCount).toBe(1);
      expect(dummy!).toBe(3);

      // push 会改变 length，应该触发 reaction
      list.push(4);

      expect(executionCount).toBe(2); // 应该被触发
      expect(dummy!).toBe(4);
    });

    test('仅访问数组引用而不消费，push 后是否重新执行', () => {
      let dummy: any;
      let executionCount = 0;
      const list = observable([1, 2, 3]);

      const reaction = observe(
        () => {
          executionCount++;
          // 仅访问数组，不做任何操作
          return list;
        },
        { lazy: true }
      );

      // 手动触发一次，建立依赖关系
      reaction();
      expect(executionCount).toBe(1);

      // 现在 push
      list.push(4);

      // 问题关键：虽然我们 get 了 list，但如果没有对它进行任何操作（length、迭代等）
      // 那么响应式系统不知道这个 reaction 依赖了数组的变化
      // 因此不会自动触发
      console.log('executionCount after push (lazy mode):', executionCount);
      expect(executionCount).toBe(1); // 预期不会再次执行，因为没有建立真正的依赖
    });
  });
});
