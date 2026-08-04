/**
 * 产品服务测试 - 展示复杂的响应式状态管理和计算属性
 * 测试场景：电商产品列表的筛选、搜索、排序功能
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  observer,
  useLocalObservable,
  observable,
  observe,
  unobserve,
} from "../../main";

// ============ 共享类型和工具 ============

interface Product {
  id: number;
  name: string;
  description: string;
  category: "主食" | "饮品" | "小食" | "甜品";
  price: number;
  stock: number;
  sales: number;
  status: "active" | "inactive" | "out_of_stock";
  image: string;
  rating?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 完整的产品数据集
 */
const FULL_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "经典汉堡",
    category: "主食",
    price: 25.8,
    status: "active",
    image: "🍔",
    description: "新鲜牛肉配生菜番茄",
    stock: 100,
    sales: 1280,
    createdAt: "2024-01-01",
  },
  {
    id: 2,
    name: "拿铁咖啡",
    category: "饮品",
    price: 18.5,
    status: "active",
    image: "☕",
    description: "精选咖啡豆制作",
    stock: 200,
    sales: 856,
    createdAt: "2024-01-02",
  },
  {
    id: 3,
    name: "芝士披萨",
    category: "主食",
    price: 42.0,
    status: "out_of_stock",
    image: "🍕",
    description: "意式手工披萨",
    stock: 0,
    sales: 645,
    createdAt: "2024-01-03",
  },
  {
    id: 4,
    name: "炸鸡翅",
    category: "小食",
    price: 32.8,
    status: "active",
    image: "🍗",
    description: "香酥脆嫩炸鸡翅",
    stock: 50,
    sales: 423,
    createdAt: "2024-01-04",
  },
  {
    id: 5,
    name: "草莓奶昔",
    category: "饮品",
    price: 22.0,
    status: "inactive",
    image: "🥤",
    description: "新鲜草莓制作",
    stock: 80,
    sales: 234,
    createdAt: "2024-01-05",
  },
  {
    id: 6,
    name: "巧克力蛋糕",
    category: "甜品",
    price: 35.5,
    status: "active",
    image: "🍰",
    description: "浓郁巧克力味蛋糕",
    stock: 30,
    sales: 567,
    createdAt: "2024-01-06",
  },
];

/**
 * 产品服务基类 - 包含筛选、搜索、排序逻辑
 */
class ProductService {
  products: Product[] = [];
  currentProduct: Product | null = null;
  loading = false;
  total = 0;
  categories: string[] = ["all", "主食", "饮品", "小食", "甜品"];
  statuses: string[] = ["all", "active", "inactive", "out_of_stock"];

  // 筛选和排序状态
  searchTerm = "";
  filterCategory = "all";
  filterStatus = "all";
  sortBy = "name";

  constructor(products: Product[] = []) {
    this.products = JSON.parse(JSON.stringify(products));
  }

  // 计算属性 - 过滤后的商品列表
  get filteredProducts(): Product[] {
    return this.products
      .filter((product) => {
        const matchesSearch =
          product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          product.description
            .toLowerCase()
            .includes(this.searchTerm.toLowerCase());
        const matchesCategory =
          this.filterCategory === "all" ||
          product.category === this.filterCategory;
        const matchesStatus =
          this.filterStatus === "all" || product.status === this.filterStatus;
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        switch (this.sortBy) {
          case "name":
            return a.name.localeCompare(b.name);
          case "price":
            return a.price - b.price;
          case "sales":
            return b.sales - a.sales;
          case "stock":
            return b.stock - a.stock;
          default:
            return 0;
        }
      });
  }

  // 计算属性 - 总销售额
  get totalSales(): number {
    return this.filteredProducts.reduce(
      (sum, product) => sum + product.sales,
      0
    );
  }

  // 计算属性 - 平均价格
  get averagePrice(): number {
    if (this.filteredProducts.length === 0) return 0;
    const sum = this.filteredProducts.reduce(
      (acc, product) => acc + product.price,
      0
    );
    return sum / this.filteredProducts.length;
  }
}

// ============ 测试用例 ============
describe("ProductService React 组件集成", () => {
  it("ProductService With React", async () => {
    const productService = observable(
      new ProductService(FULL_PRODUCTS.slice(0, 3))
    );

    const ProductList = observer(() => {
      return (
        <div data-testid="product-count">
          {productService.filteredProducts.length === 0
            ? "没有找到商品"
            : `找到 ${productService.filteredProducts.length} 个商品`}
        </div>
      );
    });

    render(<ProductList />);

    // 初始状态
    expect(screen.getByTestId("product-count")).toHaveTextContent(
      "找到 3 个商品"
    );
  });

  it("应该在 React 组件中使用 ProductService", async () => {
    const productService = observable(
      new ProductService(FULL_PRODUCTS.slice(0, 3))
    );

    const ProductList = observer(() => {
      return (
        <div>
          <div>
            <input
              placeholder="搜索商品"
              value={productService.searchTerm}
              onChange={(e) => (productService.searchTerm = e.target.value)}
              data-testid="search-input"
            />
            <select
              value={productService.filterCategory}
              onChange={(e) => (productService.filterCategory = e.target.value)}
              data-testid="category-select"
            >
              <option value="all">全部分类</option>
              <option value="主食">主食</option>
              <option value="饮品">饮品</option>
              <option value="小食">小食</option>
              <option value="甜品">甜品</option>
            </select>
            <select
              value={productService.filterStatus}
              onChange={(e) => (productService.filterStatus = e.target.value)}
              data-testid="status-select"
            >
              <option value="all">全部状态</option>
              <option value="active">上架</option>
              <option value="inactive">下架</option>
              <option value="out_of_stock">缺货</option>
            </select>
          </div>
          <div data-testid="product-count">
            {productService.filteredProducts.length === 0
              ? "没有找到商品"
              : `找到 ${productService.filteredProducts.length} 个商品`}
          </div>
          <ul>
            {productService.filteredProducts.map((product) => (
              <li key={product.id} data-testid={`product-${product.id}`}>
                {product.image} {product.name} - ¥{product.price}
              </li>
            ))}
          </ul>
        </div>
      );
    });

    render(<ProductList />);

    // 初始状态
    expect(screen.getByTestId("product-count")).toHaveTextContent(
      "找到 3 个商品"
    );
    expect(screen.getByTestId("product-1")).toBeInTheDocument();
    expect(screen.getByTestId("product-2")).toBeInTheDocument();
    expect(screen.getByTestId("product-3")).toBeInTheDocument();

    // 搜索
    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "汉堡" } });

    await waitFor(() => {
      expect(screen.getByTestId("product-count")).toHaveTextContent(
        "找到 1 个商品"
      );
      expect(screen.getByTestId("product-1")).toBeInTheDocument();
      expect(screen.queryByTestId("product-2")).not.toBeInTheDocument();
    });

    // 清空搜索
    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.getByTestId("product-count")).toHaveTextContent(
        "找到 3 个商品"
      );
    });

    // 按分类筛选
    const categorySelect = screen.getByTestId(
      "category-select"
    ) as HTMLSelectElement;
    fireEvent.change(categorySelect, { target: { value: "主食" } });

    await waitFor(() => {
      expect(screen.getByTestId("product-count")).toHaveTextContent(
        "找到 2 个商品"
      );
      expect(screen.getByTestId("product-1")).toBeInTheDocument();
      expect(screen.getByTestId("product-3")).toBeInTheDocument();
    });

    // 按状态筛选
    const statusSelect = screen.getByTestId(
      "status-select"
    ) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "active" } });

    await waitFor(() => {
      expect(screen.getByTestId("product-count")).toHaveTextContent(
        "找到 1 个商品"
      );
      expect(screen.getByTestId("product-1")).toBeInTheDocument();
      expect(screen.queryByTestId("product-3")).not.toBeInTheDocument();
    });
  });

  it("应该使用 useLocalObservable 创建本地产品服务", async () => {
    const ProductPage = observer(() => {
      const productService = useLocalObservable(() => ({
        products: FULL_PRODUCTS.slice(0, 2) as Product[],
        searchTerm: "",
        filterCategory: "all",
        filterStatus: "all",
        sortBy: "name",

        get filteredProducts(): Product[] {
          return this.products
            .filter((product) => {
              const matchesSearch =
                product.name
                  .toLowerCase()
                  .includes(this.searchTerm.toLowerCase()) ||
                product.description
                  .toLowerCase()
                  .includes(this.searchTerm.toLowerCase());
              const matchesCategory =
                this.filterCategory === "all" ||
                product.category === this.filterCategory;
              const matchesStatus =
                this.filterStatus === "all" ||
                product.status === this.filterStatus;
              return matchesSearch && matchesCategory && matchesStatus;
            })
            .sort((a, b) => {
              switch (this.sortBy) {
                case "name":
                  return a.name.localeCompare(b.name);
                case "price":
                  return a.price - b.price;
                case "sales":
                  return b.sales - a.sales;
                case "stock":
                  return b.stock - a.stock;
                default:
                  return 0;
              }
            });
        },
      }));

      return (
        <div>
          <input
            placeholder="搜索"
            value={productService.searchTerm}
            onChange={(e) => (productService.searchTerm = e.target.value)}
            data-testid="search"
          />
          <div data-testid="count">
            {productService.filteredProducts.length}
          </div>
          <ul>
            {productService.filteredProducts.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      );
    });

    render(<ProductPage />);

    expect(screen.getByTestId("count")).toHaveTextContent("2");

    const searchInput = screen.getByTestId("search") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "咖啡" } });

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
      expect(screen.getByText("拿铁咖啡")).toBeInTheDocument();
    });
  });
});

describe("ProductService 响应式追踪", () => {
  it("应该追踪计算属性的变化", () => {
    const service = observable(new ProductService(FULL_PRODUCTS.slice(0, 2)));

    const results: number[] = [];
    const reaction = observe(() => {
      results.push(service.filteredProducts.length);
    });

    // 初始执行
    expect(results).toEqual([2]);

    // 修改筛选条件
    service.filterCategory = "主食";
    expect(results).toEqual([2, 1]);

    // 修改搜索条件
    service.searchTerm = "咖啡";
    expect(results).toEqual([2, 1, 0]);

    // 重置
    service.filterCategory = "all";
    service.searchTerm = "";
    expect(results).toEqual([2, 1, 0, 1, 2]);

    unobserve(reaction);
  });

  it("应该计算总销售额和平均价格", () => {
    const service = observable(new ProductService(FULL_PRODUCTS.slice(0, 3)));

    // 初始状态
    expect(service.totalSales).toBe(1280 + 856 + 645); // 2781
    expect(service.averagePrice).toBeCloseTo((25.8 + 18.5 + 42.0) / 3, 2);

    // 按分类筛选后重新计算
    service.filterCategory = "主食";
    expect(service.totalSales).toBe(1280 + 645); // 1925
    expect(service.averagePrice).toBeCloseTo((25.8 + 42.0) / 2, 2);

    // 按状态筛选后重新计算
    service.filterStatus = "active";
    expect(service.totalSales).toBe(1280); // 只有经典汉堡
    expect(service.averagePrice).toBe(25.8);
  });
});
