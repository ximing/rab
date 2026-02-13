# 案例 4：组件+Service 新封装模式

这个案例展示了一种新的、更优雅的组件+Service 封装模式，通过创建可复用的组件+Service 组合，提高代码的可维护性和可复用性。

## 场景描述

实现一个**分页数据表格**组件，展示如何：

- 创建可复用的组件+Service 组合
- 使用高阶组件（HOC）模式简化 API
- 实现通用的数据加载、分页、排序功能
- 提供灵活的自定义选项

## 核心思想

传统方式：

```
组件 → useService → Service → API
```

新的封装模式：

```
组件+Service 组合 → 导出单一接口 → 使用者只需关心组件
```

## 完整代码

### 1. 定义通用类型

```typescript
// types/pagination.ts
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SortState {
  field: string;
  order: 'asc' | 'desc';
}

export interface DataTableOptions<T> {
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  onRowClick?: (row: T) => void;
  columns: DataTableColumn<T>[];
}

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface ApiListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 2. 创建通用的 DataTable Service

```typescript
// services/DataTableService.ts
import { Service } from '@rabjs/react';
import { PaginationState, SortState } from '../types/pagination';

export interface DataTableServiceConfig<T> {
  fetchData: (
    page: number,
    pageSize: number,
    sort?: SortState
  ) => Promise<{
    items: T[];
    total: number;
  }>;
  pageSize?: number;
}

export class DataTableService<T> extends Service {
  // 状态
  items: T[] = [];
  pagination: PaginationState = {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  };
  sort: SortState = { field: '', order: 'asc' };
  selectedRows: Set<string> = new Set();

  // 配置
  private config: DataTableServiceConfig<T>;

  constructor(config: DataTableServiceConfig<T>) {
    super();
    this.config = config;
    if (config.pageSize) {
      this.pagination.pageSize = config.pageSize;
    }
  }

  // 计算属性
  get totalPages(): number {
    return Math.ceil(this.pagination.total / this.pagination.pageSize);
  }

  get hasNextPage(): boolean {
    return this.pagination.page < this.totalPages;
  }

  get hasPrevPage(): boolean {
    return this.pagination.page > 1;
  }

  get isAllSelected(): boolean {
    return this.items.length > 0 && this.selectedRows.size === this.items.length;
  }

  // 方法
  async loadData() {
    try {
      const result = await this.config.fetchData(
        this.pagination.page,
        this.pagination.pageSize,
        this.sort
      );
      this.items = result.items;
      this.pagination.total = result.total;
      this.pagination.totalPages = this.totalPages;
    } catch (error) {
      console.error('Failed to load data:', error);
      throw error;
    }
  }

  async goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.pagination.page = page;
      await this.loadData();
    }
  }

  async nextPage() {
    if (this.hasNextPage) {
      await this.goToPage(this.pagination.page + 1);
    }
  }

  async prevPage() {
    if (this.hasPrevPage) {
      await this.goToPage(this.pagination.page - 1);
    }
  }

  async changePageSize(pageSize: number) {
    this.pagination.pageSize = pageSize;
    this.pagination.page = 1;
    await this.loadData();
  }

  async sort(field: string, order: 'asc' | 'desc') {
    this.sort = { field, order };
    this.pagination.page = 1;
    await this.loadData();
  }

  toggleRowSelection(rowId: string) {
    if (this.selectedRows.has(rowId)) {
      this.selectedRows.delete(rowId);
    } else {
      this.selectedRows.add(rowId);
    }
  }

  toggleAllSelection() {
    if (this.isAllSelected) {
      this.selectedRows.clear();
    } else {
      this.items.forEach((item: any) => {
        this.selectedRows.add(item.id);
      });
    }
  }

  clearSelection() {
    this.selectedRows.clear();
  }

  async refresh() {
    await this.loadData();
  }
}
```

### 3. 创建通用的 DataTable 组件

```typescript
// components/DataTable.tsx
import React, { useEffect, useState } from 'react';
import { observer, useService } from '@rabjs/react';
import { DataTableService } from '../services/DataTableService';
import { DataTableColumn } from '../types/pagination';
import './DataTable.css';

interface DataTableProps<T> {
  service: DataTableService<T>;
  columns: DataTableColumn<T>[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  loading?: boolean;
}

export const DataTable = observer(function DataTable<T extends { id: string }>(
  props: DataTableProps<T>
) {
  const { service, columns, onRowClick, selectable = false, loading = false } = props;
  const [localLoading, setLocalLoading] = useState(loading);

  useEffect(() => {
    const loadData = async () => {
      setLocalLoading(true);
      try {
        await service.loadData();
      } finally {
        setLocalLoading(false);
      }
    };
    loadData();
  }, [service]);

  return (
    <div className="data-table-container">
      {/* 表格 */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {selectable && (
                <th className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={service.isAllSelected}
                    onChange={() => service.toggleAllSelection()}
                  />
                </th>
              )}
              {columns.map(column => (
                <th key={String(column.key)} style={{ width: column.width }}>
                  <div className="column-header">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <button
                        className="sort-btn"
                        onClick={() =>
                          service.sort(
                            String(column.key),
                            service.sort.order === 'asc' ? 'desc' : 'asc'
                          )
                        }
                      >
                        ⇅
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localLoading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="loading">
                  加载中...
                </td>
              </tr>
            ) : service.items.length > 0 ? (
              service.items.map(item => (
                <tr
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={service.selectedRows.has(item.id) ? 'selected' : ''}
                >
                  {selectable && (
                    <td className="checkbox-column">
                      <input
                        type="checkbox"
                        checked={service.selectedRows.has(item.id)}
                        onChange={() => service.toggleRowSelection(item.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map(column => (
                    <td key={String(column.key)}>
                      {column.render
                        ? column.render((item as any)[column.key], item)
                        : (item as any)[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="empty">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控件 */}
      <div className="pagination">
        <div className="pagination-info">
          第 {service.pagination.page} / {service.totalPages} 页， 共 {service.pagination.total}{' '}
          条数据
        </div>
        <div className="pagination-controls">
          <button
            onClick={() => service.prevPage()}
            disabled={!service.hasPrevPage}
            className="btn btn-small"
          >
            上一页
          </button>
          <input
            type="number"
            min="1"
            max={service.totalPages}
            value={service.pagination.page}
            onChange={e => service.goToPage(parseInt(e.target.value))}
            className="page-input"
          />
          <button
            onClick={() => service.nextPage()}
            disabled={!service.hasNextPage}
            className="btn btn-small"
          >
            下一页
          </button>
          <select
            value={service.pagination.pageSize}
            onChange={e => service.changePageSize(parseInt(e.target.value))}
            className="page-size-select"
          >
            <option value="10">10 条/页</option>
            <option value="20">20 条/页</option>
            <option value="50">50 条/页</option>
            <option value="100">100 条/页</option>
          </select>
        </div>
      </div>
    </div>
  );
});
```

### 4. 创建高阶组件工厂函数

```typescript
// utils/createDataTableComponent.tsx
import React from 'react';
import { bindServices } from '@rabjs/react';
import { DataTable } from '../components/DataTable';
import { DataTableService, DataTableServiceConfig } from '../services/DataTableService';
import { DataTableColumn } from '../types/pagination';

/**
 * 创建一个完整的数据表格组件
 *
 * 使用方式：
 * const UserTable = createDataTableComponent({
 *   fetchData: async (page, pageSize) => {
 *     const response = await fetch(`/api/users?page=${page}&pageSize=${pageSize}`);
 *     return response.json();
 *   },
 *   columns: [
 *     { key: 'name', label: '姓名' },
 *     { key: 'email', label: '邮箱' },
 *   ],
 * });
 */
export function createDataTableComponent<T extends { id: string }>(options: {
  fetchData: (
    page: number,
    pageSize: number,
    sort?: any
  ) => Promise<{
    items: T[];
    total: number;
  }>;
  columns: DataTableColumn<T>[];
  pageSize?: number;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
}) {
  // 创建 Service 类
  class CustomDataTableService extends DataTableService<T> {
    constructor() {
      super({
        fetchData: options.fetchData,
        pageSize: options.pageSize,
      });
    }
  }

  // 创建组件
  const TableComponent = () => (
    <DataTable<T>
      service={new CustomDataTableService()}
      columns={options.columns}
      onRowClick={options.onRowClick}
      selectable={options.selectable}
    />
  );

  // 使用 bindServices 包装并导出
  return bindServices(TableComponent, [CustomDataTableService]);
}
```

### 5. 实际使用示例

```typescript
// pages/UserListPage.tsx
import React from 'react';
import { createDataTableComponent } from '../utils/createDataTableComponent';
import { DataTableColumn } from '../types/pagination';

interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

// 定义列配置
const userColumns: DataTableColumn<User>[] = [
  {
    key: 'name',
    label: '姓名',
    width: '150px',
    sortable: true,
  },
  {
    key: 'email',
    label: '邮箱',
    width: '200px',
    sortable: true,
  },
  {
    key: 'department',
    label: '部门',
    width: '120px',
  },
  {
    key: 'status',
    label: '状态',
    width: '100px',
    render: value => (
      <span className={`badge badge-${value}`}>{value === 'active' ? '活跃' : '非活跃'}</span>
    ),
  },
  {
    key: 'createdAt',
    label: '创建时间',
    width: '150px',
    render: value => new Date(value).toLocaleDateString(),
  },
];

// 创建用户表格组件
const UserTable = createDataTableComponent<User>({
  fetchData: async (page, pageSize, sort) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (sort?.field) {
      params.append('sortBy', sort.field);
      params.append('sortOrder', sort.order);
    }

    const response = await fetch(`/api/users?${params.toString()}`);
    const data = await response.json();
    return {
      items: data.data,
      total: data.total,
    };
  },
  columns: userColumns,
  pageSize: 20,
  selectable: true,
  onRowClick: user => {
    console.log('Selected user:', user);
  },
});

// 使用组件
export default function UserListPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>用户列表</h1>
      <UserTable />
    </div>
  );
}
```

### 6. 样式文件

```css
/* components/DataTable.css */
.data-table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table thead {
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
}

.data-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #333;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-size: 12px;
  padding: 0;
  transition: color 0.2s;
}

.sort-btn:hover {
  color: #333;
}

.data-table tbody tr {
  border-bottom: 1px solid #eee;
  transition: background-color 0.2s;
}

.data-table tbody tr:hover {
  background: #f9f9f9;
}

.data-table tbody tr.selected {
  background: #e7f3ff;
}

.data-table td {
  padding: 12px;
  color: #666;
}

.checkbox-column {
  width: 40px;
  text-align: center;
}

.data-table input[type='checkbox'] {
  cursor: pointer;
}

.loading,
.empty {
  text-align: center;
  padding: 40px !important;
  color: #999;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f9f9f9;
  border-top: 1px solid #eee;
}

.pagination-info {
  font-size: 14px;
  color: #666;
}

.pagination-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.page-input {
  width: 60px;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  text-align: center;
}

.page-size-select {
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: #f0f0f0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}

.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge-active {
  background: #d4edda;
  color: #155724;
}

.badge-inactive {
  background: #f8d7da;
  color: #721c24;
}
```

## 关键特性

✅ **高度可复用**：通过工厂函数快速创建新的表格组件  
✅ **开箱即用**：包含分页、排序、选择等常用功能  
✅ **灵活定制**：支持自定义列渲染、行点击等  
✅ **类型安全**：完整的 TypeScript 泛型支持  
✅ **清晰的 API**：使用者只需关心配置，不需要了解内部实现

## 新封装模式的优势

### 1. **简化使用**

```typescript
// 旧方式：需要创建 Service、组件、bindServices
// 新方式：一行代码创建完整的表格
const UserTable = createDataTableComponent({ ... });
```

### 2. **提高可维护性**

- 通用逻辑集中在 Service 和组件中
- 使用者只需关心配置
- 易于扩展和修改

### 3. **增强可复用性**

- 同一个 `DataTableService` 可以用于多个不同的表格
- 列配置可以复用
- 工厂函数可以生成多个表格组件

### 4. **更好的类型推导**

- 泛型支持确保类型安全
- IDE 智能提示更准确

## 扩展建议

1. **添加搜索功能**：在 Service 中添加搜索状态和方法
2. **添加导出功能**：支持导出为 CSV、Excel 等格式
3. **添加行编辑**：支持行内编辑功能
4. **添加高级筛选**：支持多条件筛选
5. **添加虚拟滚动**：优化大数据列表性能

## 总结

这个新的组件+Service 封装模式展示了如何：

- 创建高度可复用的组件+Service 组合
- 使用工厂函数简化 API
- 提供灵活的定制选项
- 保持代码的清晰和可维护性

这种模式特别适合构建企业级应用中的通用组件库。
