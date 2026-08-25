/**
 * 状态筛选更新测试 - 严格按照 product-mini-v2 例子复现
 *
 * 测试场景：模拟 product-mini-v2 的实际使用场景
 * 验证当 setFilterStatus 触发后，列表和数字应该正确更新
 *
 * 关键问题：
 * - observer 在定义时包裹 ✅ 能正常筛选
 * - observer 在导出时包裹 ❌ 不能正常筛选（需要复现）
 *
 * 关键测试点：
 * 1. observer 包裹方式对响应式的影响
 * 2. 计算属性 filteredProducts 的响应式追踪
 * 3. 按钮点击后的 UI 更新正确性
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { observer, observable } from '../../main';

// ============ 类型定义 ============

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  status: 'active' | 'inactive' | 'out_of_stock';
  image: string;
  description: string;
  stock: number;
  sales: number;
  createdAt: string;
}

// ============ ProductService 实现 ============

class ProductService {
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

  // 获取状态文本
  getStatusText(status: string): string {
    switch (status) {
      case 'active':
        return '在售';
      case 'inactive':
        return '下架';
      case 'out_of_stock':
        return '售罄';
      default:
        return status;
    }
  }

  // 计算属性 - 过滤后的商品列表
  get filteredProducts(): Product[] {
    const filtered = this.products.filter(product => {
      const matchesSearch =
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesCategory =
        this.filterCategory === 'all' || product.category === this.filterCategory;
      const matchesStatus = this.filterStatus === 'all' || product.status === this.filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    return filtered.sort((a, b) => {
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

  // 更新状态筛选
  setFilterStatus(status: string) {
    this.filterStatus = status;
  }
}

// ============ 测试用例 ============

describe('FilterStatus 更新测试 - 按照 product-mini-v2 例子', () => {
  describe('正确方式：observer 在定义时包裹', () => {
    it('点击按钮后应该正确筛选商品', async () => {
      const productService = observable(new ProductService());

      // ✅ 正确方式：定义时使用 observer 包裹（和 product-mini-v2 一样）
      const ProductPage = observer(() => {
        return (
          <div>
            <div data-testid="filters">
              <button
                onClick={() => {
                  productService.setFilterStatus('all');
                }}
                data-testid="filter-all"
              >
                {productService.getStatusText('all')}
              </button>
              <button
                onClick={() => {
                  productService.setFilterStatus('active');
                }}
                data-testid="filter-active"
              >
                {productService.getStatusText('active')}
              </button>
              <button
                onClick={() => {
                  productService.setFilterStatus('inactive');
                }}
                data-testid="filter-inactive"
              >
                {productService.getStatusText('inactive')}
              </button>
            </div>
            <div data-testid="product-count">{productService.filteredProducts.length}</div>
            <div data-testid="product-grid">
              {productService.filteredProducts.map(product => {
                const statusText = productService.getStatusText(product.status);
                return (
                  <div key={product.id} data-testid={`product-${product.id}`}>
                    <h3>{product.name}</h3>
                    <span data-testid={`status-${product.id}`}>{statusText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      });

      render(<ProductPage />);

      // 初始状态：显示所有商品（6个）
      expect(screen.getByTestId('product-count')).toHaveTextContent('6');
      expect(screen.getByTestId('product-1')).toBeInTheDocument();
      expect(screen.getByTestId('product-2')).toBeInTheDocument();
      expect(screen.getByTestId('product-3')).toBeInTheDocument();
      expect(screen.getByTestId('product-4')).toBeInTheDocument();
      expect(screen.getByTestId('product-5')).toBeInTheDocument();
      expect(screen.getByTestId('product-6')).toBeInTheDocument();

      // 点击 active 按钮
      fireEvent.click(screen.getByTestId('filter-active'));

      await waitFor(() => {
        // 应该只显示 4 个 active 商品
        expect(screen.getByTestId('product-count')).toHaveTextContent('4');
        expect(screen.getByTestId('product-1')).toBeInTheDocument(); // 经典汉堡
        expect(screen.getByTestId('product-2')).toBeInTheDocument(); // 拿铁咖啡
        expect(screen.queryByTestId('product-3')).not.toBeInTheDocument(); // 芝士披萨 (out_of_stock)
        expect(screen.getByTestId('product-4')).toBeInTheDocument(); // 炸鸡翅
        expect(screen.queryByTestId('product-5')).not.toBeInTheDocument(); // 草莓奶昔 (inactive)
        expect(screen.getByTestId('product-6')).toBeInTheDocument(); // 巧克力蛋糕
      });

      // 点击 inactive 按钮
      fireEvent.click(screen.getByTestId('filter-inactive'));

      await waitFor(() => {
        // 应该只显示 1 个 inactive 商品
        expect(screen.getByTestId('product-count')).toHaveTextContent('1');
        expect(screen.queryByTestId('product-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('product-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('product-3')).not.toBeInTheDocument();
        expect(screen.queryByTestId('product-4')).not.toBeInTheDocument();
        expect(screen.getByTestId('product-5')).toBeInTheDocument(); // 草莓奶昔
        expect(screen.queryByTestId('product-6')).not.toBeInTheDocument();
      });

      // 点击 all 按钮重置
      fireEvent.click(screen.getByTestId('filter-all'));

      await waitFor(() => {
        // 应该显示所有商品（6个）
        expect(screen.getByTestId('product-count')).toHaveTextContent('6');
        expect(screen.getByTestId('product-1')).toBeInTheDocument();
        expect(screen.getByTestId('product-2')).toBeInTheDocument();
        expect(screen.getByTestId('product-3')).toBeInTheDocument();
        expect(screen.getByTestId('product-4')).toBeInTheDocument();
        expect(screen.getByTestId('product-5')).toBeInTheDocument();
        expect(screen.getByTestId('product-6')).toBeInTheDocument();
      });
    });
  });

  describe('问题方式：observer 在导出时包裹', () => {
    it('点击按钮后应该正确筛选商品（但可能失败）', async () => {
      const productService = observable(new ProductService());

      // ❌ 问题方式：定义时不包裹，导出时包裹
      const ProductPageBase = () => {
        return (
          <div>
            <div data-testid="filters">
              <button
                onClick={() => {
                  productService.setFilterStatus('all');
                }}
                data-testid="filter-all"
              >
                {productService.getStatusText('all')}
              </button>
              <button
                onClick={() => {
                  productService.setFilterStatus('active');
                }}
                data-testid="filter-active"
              >
                {productService.getStatusText('active')}
              </button>
              <button
                onClick={() => {
                  productService.setFilterStatus('inactive');
                }}
                data-testid="filter-inactive"
              >
                {productService.getStatusText('inactive')}
              </button>
            </div>
            <div data-testid="product-count">{productService.filteredProducts.length}</div>
            <div data-testid="product-grid">
              {productService.filteredProducts.map(product => {
                const statusText = productService.getStatusText(product.status);
                return (
                  <div key={product.id} data-testid={`product-${product.id}`}>
                    <h3>{product.name}</h3>
                    <span data-testid={`status-${product.id}`}>{statusText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      };

      // 导出时包裹
      const ProductPage = observer(ProductPageBase);

      render(<ProductPage />);

      // 初始状态：显示所有商品（6个）
      expect(screen.getByTestId('product-count')).toHaveTextContent('6');
      expect(screen.getByTestId('product-1')).toBeInTheDocument();
      expect(screen.getByTestId('product-2')).toBeInTheDocument();
      expect(screen.getByTestId('product-3')).toBeInTheDocument();
      expect(screen.getByTestId('product-4')).toBeInTheDocument();
      expect(screen.getByTestId('product-5')).toBeInTheDocument();
      expect(screen.getByTestId('product-6')).toBeInTheDocument();

      // 点击 active 按钮
      fireEvent.click(screen.getByTestId('filter-active'));

      await waitFor(() => {
        // 应该只显示 4 个 active 商品
        // 但如果有问题，这里会失败
        expect(screen.getByTestId('product-count')).toHaveTextContent('4');
        expect(screen.getByTestId('product-1')).toBeInTheDocument(); // 经典汉堡
        expect(screen.getByTestId('product-2')).toBeInTheDocument(); // 拿铁咖啡
        expect(screen.queryByTestId('product-3')).not.toBeInTheDocument(); // 芝士披萨 (out_of_stock)
        expect(screen.getByTestId('product-4')).toBeInTheDocument(); // 炸鸡翅
        expect(screen.queryByTestId('product-5')).not.toBeInTheDocument(); // 草莓奶昔 (inactive)
        expect(screen.getByTestId('product-6')).toBeInTheDocument(); // 巧克力蛋糕
      });

      // 点击 inactive 按钮
      fireEvent.click(screen.getByTestId('filter-inactive'));

      await waitFor(() => {
        // 应该只显示 1 个 inactive 商品
        expect(screen.getByTestId('product-count')).toHaveTextContent('1');
        expect(screen.queryByTestId('product-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('product-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('product-3')).not.toBeInTheDocument();
        expect(screen.queryByTestId('product-4')).not.toBeInTheDocument();
        expect(screen.getByTestId('product-5')).toBeInTheDocument(); // 草莓奶昔
        expect(screen.queryByTestId('product-6')).not.toBeInTheDocument();
      });

      // 点击 all 按钮重置
      fireEvent.click(screen.getByTestId('filter-all'));

      await waitFor(() => {
        // 应该显示所有商品（6个）
        expect(screen.getByTestId('product-count')).toHaveTextContent('6');
        expect(screen.getByTestId('product-1')).toBeInTheDocument();
        expect(screen.getByTestId('product-2')).toBeInTheDocument();
        expect(screen.getByTestId('product-3')).toBeInTheDocument();
        expect(screen.getByTestId('product-4')).toBeInTheDocument();
        expect(screen.getByTestId('product-5')).toBeInTheDocument();
        expect(screen.getByTestId('product-6')).toBeInTheDocument();
      });
    });
  });

  describe('对比测试：两种方式的差异', () => {
    it('方式1（定义时包裹）vs 方式2（导出时包裹）', async () => {
      const productService1 = observable(new ProductService());
      const productService2 = observable(new ProductService());

      // 方式1：定义时包裹
      const ProductPage1 = observer(() => (
        <div>
          <div data-testid="count1">{productService1.filteredProducts.length}</div>
          <button onClick={() => productService1.setFilterStatus('active')} data-testid="btn1">
            Filter
          </button>
        </div>
      ));

      // 方式2：导出时包裹
      const ProductPage2Base = () => (
        <div>
          <div data-testid="count2">{productService2.filteredProducts.length}</div>
          <button onClick={() => productService2.setFilterStatus('active')} data-testid="btn2">
            Filter
          </button>
        </div>
      );
      const ProductPage2 = observer(ProductPage2Base);

      const { rerender } = render(
        <div>
          <ProductPage1 />
          <ProductPage2 />
        </div>
      );

      // 初始状态
      expect(screen.getByTestId('count1')).toHaveTextContent('6');
      expect(screen.getByTestId('count2')).toHaveTextContent('6');

      // 点击方式1的按钮
      fireEvent.click(screen.getByTestId('btn1'));

      await waitFor(() => {
        expect(screen.getByTestId('count1')).toHaveTextContent('4');
      });

      // 点击方式2的按钮
      fireEvent.click(screen.getByTestId('btn2'));

      await waitFor(() => {
        // 如果有问题，这里可能不会更新
        expect(screen.getByTestId('count2')).toHaveTextContent('4');
      });
    });
  });
});
