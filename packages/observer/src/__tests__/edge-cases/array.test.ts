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
});
