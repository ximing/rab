# 案例 5：商卡组件（SkuCard）- 组件内聚架构

这个案例展示了如何构建一个功能完整的商卡组件，采用**组件内聚架构**，所有相关的组件和 Service 都在同一个目录下，对外暴露统一的 PageService 接口。

## 场景描述

实现一个电商商卡组件系统，支持：

- 商品信息展示（图片、标题、价格、库存）
- 规格选择（尺寸、颜色等）
- 数量选择和加入购物车
- 收藏/取消收藏
- 价格计算和库存检查
- 多个商卡在同一页面中独立运作

## 架构设计

### 依赖关系

```
页面层 (ProductPage)
  ↓
  ├─ 埋点 Service (TrackingService) - 页面级别
  ├─ 全局购物车 Service (GlobalCartService) - 全局共享
  └─ 商卡模块 (SkuCard)
      ├─ SkuService (商品相关)
      ├─ FavoriteService (收藏相关)
      └─ PageService (商卡页面级协调)
```

### 关键原则

✅ **依赖方向**：只能下层依赖上层，不能反向依赖  
✅ **模块独立**：商卡模块内部自洽，不依赖外部 Service  
✅ **接口清晰**：通过 PageService 对外暴露统一接口  
✅ **职责分离**：全局 Service 和模块 Service 职责明确

## 目录结构

```
src/
├── services/
│   ├── GlobalCartService.ts         # 全局购物车 Service
│   └── TrackingService.ts           # 埋点 Service（页面级）
│
├── pages/
│   └── ProductPage.tsx              # 页面组件
│
└── modules/
    └── sku-card/                    # 商卡模块（内聚）
        ├── index.ts                 # 模块导出
        ├── PageService.ts           # 商卡页面级 Service（对外接口）
        │
        ├── services/
        │   ├── SkuService.ts        # 商品 Service
        │   └── FavoriteService.ts   # 收藏 Service
        │
        ├── components/
        │   ├── SkuCard.tsx          # 主商卡组件
        │   ├── SkuImage.tsx         # 商品图片组件
        │   ├── SkuInfo.tsx          # 商品信息组件
        │   ├── SkuSpecs.tsx         # 规格选择组件
        │   ├── SkuQuantity.tsx      # 数量选择组件
        │   └── SkuActions.tsx       # 操作按钮组件
        │
        └── types/
            └── sku.ts              # 类型定义
```

## 完整代码

### 1. 类型定义

```typescript
// modules/sku-card/types/sku.ts
export interface SkuSpec {
  id: string;
  name: string; // 规格名称（如"尺寸"、"颜色"）
  values: SkuSpecValue[];
}

export interface SkuSpecValue {
  id: string;
  label: string; // 显示标签（如"M"、"红色"）
  available: boolean; // 是否可选
}

export interface SkuProduct {
  id: string;
  title: string;
  description: string;
  image: string;
  originalPrice: number;
  currentPrice: number;
  stock: number;
  specs: SkuSpec[];
  isFavorite: boolean;
}

export interface SelectedSpecs {
  [specId: string]: string; // specId -> specValueId
}

export interface CartItem {
  productId: string;
  selectedSpecs: SelectedSpecs;
  quantity: number;
  price: number;
}
```

### 2. 全局购物车 Service

```typescript
// services/GlobalCartService.ts
import { Service, Memo } from '@rabjs/react';
import { CartItem } from '../modules/sku-card/types/sku';

/**
 * 全局购物车 Service
 * 在应用全局范围内共享，所有商卡都添加到同一个购物车
 */
export class GlobalCartService extends Service {
  // 状态
  items: CartItem[] = [];

  // 添加到购物车
  addItem(item: CartItem) {
    // 检查是否已存在相同规格的商品
    const existingIndex = this.items.findIndex(
      i =>
        i.productId === item.productId &&
        JSON.stringify(i.selectedSpecs) === JSON.stringify(item.selectedSpecs)
    );

    if (existingIndex >= 0) {
      // 更新数量
      this.items[existingIndex].quantity += item.quantity;
    } else {
      // 添加新商品
      this.items.push(item);
    }
  }

  // 移除商品
  removeItem(productId: string, selectedSpecs: Record<string, string>) {
    this.items = this.items.filter(
      item =>
        !(
          item.productId === productId &&
          JSON.stringify(item.selectedSpecs) === JSON.stringify(selectedSpecs)
        )
    );
  }

  // 更新数量
  updateQuantity(productId: string, selectedSpecs: Record<string, string>, quantity: number) {
    const item = this.items.find(
      i =>
        i.productId === productId &&
        JSON.stringify(i.selectedSpecs) === JSON.stringify(selectedSpecs)
    );
    if (item && quantity > 0) {
      item.quantity = quantity;
    }
  }

  // 计算总价
  @Memo()
  get totalPrice() {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  // 计算总数量
  @Memo()
  get totalQuantity() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // 购物车是否为空
  @Memo()
  get isEmpty() {
    return this.items.length === 0;
  }
}
```

### 3. 埋点 Service（页面级）

```typescript
// services/TrackingService.ts
import { Service } from '@rabjs/react';

/**
 * 埋点 Service
 * 页面级别的埋点服务，用于记录用户行为
 */
export class TrackingService extends Service {
  // 记录商品浏览
  trackProductView(productId: string, productName: string) {
    console.log(`[埋点] 浏览商品: ${productId} - ${productName}`);
    // 实际项目中发送到埋点系统
  }

  // 记录规格选择
  trackSpecSelected(productId: string, specName: string, specValue: string) {
    console.log(`[埋点] 选择规格: ${specName} = ${specValue}`);
  }

  // 记录加入购物车
  trackAddToCart(productId: string, productName: string, quantity: number, price: number) {
    console.log(`[埋点] 加入购物车: ${productName} x${quantity} ¥${price}`);
  }

  // 记录收藏
  trackFavorite(productId: string, productName: string, isFavorite: boolean) {
    console.log(`[埋点] ${isFavorite ? '收藏' : '取消收藏'}: ${productName}`);
  }
}
```

### 4. 商品 Service（商卡内部）

```typescript
// modules/sku-card/services/SkuService.ts
import { Service, Memo } from '@rabjs/react';
import { SkuProduct, SelectedSpecs } from '../types/sku';

/**
 * 商品 Service
 * 商卡内部 Service，只处理商品相关的逻辑
 */
export class SkuService extends Service {
  // 状态
  product: SkuProduct | null = null;
  selectedSpecs: SelectedSpecs = {};
  quantity: number = 1;

  // 初始化商品
  setProduct(product: SkuProduct) {
    this.product = product;
    this.selectedSpecs = {};
    this.quantity = 1;
  }

  // 规格选择
  selectSpec(specId: string, specValueId: string) {
    this.selectedSpecs[specId] = specValueId;
  }

  // 检查规格是否完整
  @Memo()
  get isSpecsComplete() {
    if (!this.product) return false;
    return this.product.specs.every(spec => this.selectedSpecs[spec.id]);
  }

  // 获取选中的规格描述
  @Memo()
  get specsDescription() {
    if (!this.product) return '';
    return this.product.specs
      .map(spec => {
        const selectedValueId = this.selectedSpecs[spec.id];
        const selectedValue = spec.values.find(v => v.id === selectedValueId);
        return `${spec.name}:${selectedValue?.label || '未选择'}`;
      })
      .join(' ');
  }

  // 检查库存
  @Memo()
  get hasStock() {
    return this.product ? this.product.stock > 0 : false;
  }

  // 检查是否可以购买
  @Memo()
  get canBuy() {
    return this.isSpecsComplete && this.hasStock && this.quantity > 0;
  }

  // 设置数量
  setQuantity(quantity: number) {
    if (quantity > 0) {
      this.quantity = quantity;
    }
  }

  // 增加数量
  incrementQuantity() {
    this.quantity++;
  }

  // 减少数量
  decrementQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }
}
```

### 5. 收藏 Service（商卡内部）

```typescript
// modules/sku-card/services/FavoriteService.ts
import { Service, Memo } from '@rabjs/react';

/**
 * 收藏 Service
 * 商卡内部 Service，只处理收藏相关的逻辑
 */
export class FavoriteService extends Service {
  // 状态
  favoriteIds: Set<string> = new Set();

  // 切换收藏状态
  toggleFavorite(productId: string) {
    if (this.favoriteIds.has(productId)) {
      this.favoriteIds.delete(productId);
    } else {
      this.favoriteIds.add(productId);
    }
    // 触发响应式更新
    this.favoriteIds = new Set(this.favoriteIds);
  }

  // 检查是否已收藏
  isFavorite(productId: string) {
    return this.favoriteIds.has(productId);
  }

  // 收藏数量
  @Memo()
  get favoriteCount() {
    return this.favoriteIds.size;
  }
}
```

### 6. 商卡页面级 Service（对外接口）

```typescript
// modules/sku-card/PageService.ts
import { Service, Inject } from '@rabjs/react';
import { SkuService } from './services/SkuService';
import { FavoriteService } from './services/FavoriteService';
import { GlobalCartService } from '../../services/GlobalCartService';
import { TrackingService } from '../../services/TrackingService';
import { SkuProduct, CartItem, SelectedSpecs } from './types/sku';

/**
 * 商卡页面级 Service
 *
 * 职责：
 * 1. 协调商卡内部的 Service（SkuService, FavoriteService）
 * 2. 与全局 Service 交互（GlobalCartService, TrackingService）
 * 3. 对外暴露统一的接口
 *
 * 依赖关系：
 * - 依赖商卡内部 Service（SkuService, FavoriteService）
 * - 依赖全局 Service（GlobalCartService, TrackingService）
 * - 不被任何其他 Service 依赖
 */
export class SkuCardPageService extends Service {
  @Inject() skuService!: SkuService;
  @Inject() favoriteService!: FavoriteService;
  @Inject() globalCartService!: GlobalCartService;
  @Inject() trackingService!: TrackingService;

  // ============ 商品相关 ============

  setProduct(product: SkuProduct) {
    this.skuService.setProduct(product);
    this.trackingService.trackProductView(product.id, product.title);
  }

  selectSpec(specId: string, specValueId: string) {
    this.skuService.selectSpec(specId, specValueId);

    // 获取规格名称和值用于埋点
    const spec = this.skuService.product?.specs.find(s => s.id === specId);
    const specValue = spec?.values.find(v => v.id === specValueId);
    if (spec && specValue) {
      this.trackingService.trackSpecSelected(
        this.skuService.product!.id,
        spec.name,
        specValue.label
      );
    }
  }

  get product() {
    return this.skuService.product;
  }

  get selectedSpecs() {
    return this.skuService.selectedSpecs;
  }

  get isSpecsComplete() {
    return this.skuService.isSpecsComplete;
  }

  get specsDescription() {
    return this.skuService.specsDescription;
  }

  get hasStock() {
    return this.skuService.hasStock;
  }

  get canBuy() {
    return this.skuService.canBuy;
  }

  // ============ 数量相关 ============

  setQuantity(quantity: number) {
    this.skuService.setQuantity(quantity);
  }

  get quantity() {
    return this.skuService.quantity;
  }

  incrementQuantity() {
    this.skuService.incrementQuantity();
  }

  decrementQuantity() {
    this.skuService.decrementQuantity();
  }

  // ============ 购物车相关 ============

  addToCart() {
    if (!this.canBuy || !this.product) return;

    const cartItem: CartItem = {
      productId: this.product.id,
      selectedSpecs: { ...this.selectedSpecs },
      quantity: this.quantity,
      price: this.product.currentPrice,
    };

    // 添加到全局购物车
    this.globalCartService.addItem(cartItem);

    // 埋点记录
    this.trackingService.trackAddToCart(
      this.product.id,
      this.product.title,
      this.quantity,
      this.product.currentPrice
    );

    // 重置数量
    this.skuService.quantity = 1;
  }

  // ============ 收藏相关 ============

  toggleFavorite(productId: string) {
    this.favoriteService.toggleFavorite(productId);

    // 埋点记录
    const isFavorite = this.favoriteService.isFavorite(productId);
    this.trackingService.trackFavorite(productId, this.product?.title || '', isFavorite);
  }

  isFavorite(productId: string) {
    return this.favoriteService.isFavorite(productId);
  }

  get favoriteCount() {
    return this.favoriteService.favoriteCount;
  }
}
```

### 7. 商卡组件

```typescript
// modules/sku-card/components/SkuCard.tsx
import React from 'react';
import { observer, useService } from '@rabjs/react';
import { SkuCardPageService } from '../PageService';
import SkuImage from './SkuImage';
import SkuInfo from './SkuInfo';
import SkuSpecs from './SkuSpecs';
import SkuQuantity from './SkuQuantity';
import SkuActions from './SkuActions';
import './SkuCard.css';

const SkuCardContent = observer(() => {
  const service = useService(SkuCardPageService);

  if (!service.product) {
    return <div className="sku-card-empty">商品加载中...</div>;
  }

  return (
    <div className="sku-card">
      <div className="sku-card-container">
        {/* 商品图片 */}
        <SkuImage />

        {/* 商品信息 */}
        <div className="sku-card-right">
          <SkuInfo />

          {/* 规格选择 */}
          <SkuSpecs />

          {/* 数量选择 */}
          <SkuQuantity />

          {/* 操作按钮 */}
          <SkuActions />
        </div>
      </div>
    </div>
  );
});

export default SkuCardContent;
```

### 8. 子组件示例

```typescript
// modules/sku-card/components/SkuImage.tsx
import React from 'react';
import { observer, useService } from '@rabjs/react';
import { SkuCardPageService } from '../PageService';

const SkuImage = observer(() => {
  const service = useService(SkuCardPageService);

  if (!service.product) return null;

  return (
    <div className="sku-image">
      <img src={service.product.image} alt={service.product.title} />
      {!service.hasStock && <div className="stock-badge">缺货</div>}
    </div>
  );
});

export default SkuImage;
```

```typescript
// modules/sku-card/components/SkuSpecs.tsx
import React from 'react';
import { observer, useService } from '@rabjs/react';
import { SkuCardPageService } from '../PageService';

const SkuSpecs = observer(() => {
  const service = useService(SkuCardPageService);

  if (!service.product) return null;

  return (
    <div className="sku-specs">
      {service.product.specs.map(spec => (
        <div key={spec.id} className="spec-group">
          <label className="spec-label">{spec.name}</label>
          <div className="spec-values">
            {spec.values.map(value => (
              <button
                key={value.id}
                className={`spec-value ${
                  service.selectedSpecs[spec.id] === value.id ? 'selected' : ''
                } ${!value.available ? 'disabled' : ''}`}
                onClick={() => value.available && service.selectSpec(spec.id, value.id)}
                disabled={!value.available}
              >
                {value.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

export default SkuSpecs;
```

```typescript
// modules/sku-card/components/SkuQuantity.tsx
import React from 'react';
import { observer, useService } from '@rabjs/react';
import { SkuCardPageService } from '../PageService';

const SkuQuantity = observer(() => {
  const service = useService(SkuCardPageService);

  return (
    <div className="sku-quantity">
      <label>数量</label>
      <div className="quantity-control">
        <button
          onClick={() => service.decrementQuantity()}
          disabled={service.quantity <= 1}
          className="quantity-btn"
        >
          −
        </button>
        <input
          type="number"
          value={service.quantity}
          onChange={e => service.setQuantity(parseInt(e.target.value) || 1)}
          className="quantity-input"
          min="1"
        />
        <button onClick={() => service.incrementQuantity()} className="quantity-btn">
          +
        </button>
      </div>
    </div>
  );
});

export default SkuQuantity;
```

```typescript
// modules/sku-card/components/SkuActions.tsx
import React from 'react';
import { observer, useService } from '@rabjs/react';
import { SkuCardPageService } from '../PageService';

const SkuActions = observer(() => {
  const service = useService(SkuCardPageService);

  if (!service.product) return null;

  return (
    <div className="sku-actions">
      <button
        className="btn btn-favorite"
        onClick={() => service.toggleFavorite(service.product!.id)}
      >
        {service.isFavorite(service.product.id) ? '❤️ 已收藏' : '🤍 收藏'}
      </button>

      <button
        className={`btn btn-add-cart ${!service.canBuy ? 'disabled' : ''}`}
        onClick={() => service.addToCart()}
        disabled={!service.canBuy}
      >
        {!service.isSpecsComplete ? '请选择规格' : !service.hasStock ? '缺货' : '加入购物车'}
      </button>
    </div>
  );
});

export default SkuActions;
```

### 9. 模块导出

```typescript
// modules/sku-card/index.ts
export { SkuCardPageService } from './PageService';
export { SkuService } from './services/SkuService';
export { FavoriteService } from './services/FavoriteService';
export type { SkuProduct, SkuSpec, SkuSpecValue, SelectedSpecs, CartItem } from './types/sku';

// 导出组件
export { default as SkuCard } from './components/SkuCard';
```

### 10. 页面使用

```typescript
// pages/ProductPage.tsx
import React, { useEffect } from 'react';
import { observer, useService, bindServices } from '@rabjs/react';
import { SkuCard, SkuCardPageService, SkuService, FavoriteService } from '../modules/sku-card';
import { GlobalCartService } from '../services/GlobalCartService';
import { TrackingService } from '../services/TrackingService';

const ProductPageContent = observer(() => {
  const pageService = useService(SkuCardPageService);
  const cartService = useService(GlobalCartService);

  useEffect(() => {
    // 初始化商品数据
    pageService.setProduct({
      id: '1',
      title: '高级运动T恤',
      description: '舒适透气，适合日常穿着',
      image: 'https://via.placeholder.com/300x400',
      originalPrice: 199,
      currentPrice: 99,
      stock: 50,
      specs: [
        {
          id: 'size',
          name: '尺寸',
          values: [
            { id: 's', label: 'S', available: true },
            { id: 'm', label: 'M', available: true },
            { id: 'l', label: 'L', available: true },
            { id: 'xl', label: 'XL', available: false },
          ],
        },
        {
          id: 'color',
          name: '颜色',
          values: [
            { id: 'red', label: '红色', available: true },
            { id: 'blue', label: '蓝色', available: true },
            { id: 'black', label: '黑色', available: true },
          ],
        },
      ],
      isFavorite: false,
    });
  }, [pageService]);

  return (
    <div className="product-page">
      <div className="product-container">
        <SkuCard />

        {/* 购物车信息 */}
        <div className="cart-info">
          <h3>购物车</h3>
          {cartService.isEmpty ? (
            <p>购物车为空</p>
          ) : (
            <>
              <p>商品数量: {cartService.totalQuantity}</p>
              <p>总价: ¥{cartService.totalPrice}</p>
            </>
          )}
        </div>

        {/* 收藏信息 */}
        <div className="favorite-info">
          <h3>收藏</h3>
          <p>已收藏: {pageService.favoriteCount} 件</p>
        </div>
      </div>
    </div>
  );
});

/**
 * 页面注册所有依赖的 Service
 *
 * 依赖关系：
 * - GlobalCartService: 全局购物车（可被多个页面共享）
 * - TrackingService: 埋点服务（页面级别）
 * - SkuCardPageService: 商卡页面级服务
 * - SkuService: 商卡内部服务
 * - FavoriteService: 商卡内部服务
 */
export default bindServices(ProductPageContent, [
  GlobalCartService,
  TrackingService,
  SkuCardPageService,
  SkuService,
  FavoriteService,
]);
```

## 架构优势

### 1. **清晰的依赖关系**

- 全局 Service（GlobalCartService, TrackingService）在最上层
- 商卡模块 Service 在中间层
- 页面级 Service 协调各层
- 依赖方向单向，易于维护

### 2. **模块独立性强**

- 商卡模块只依赖自己的 Service
- 不依赖全局 Service，通过 PageService 间接使用
- 可以轻松复用到其他项目

### 3. **职责分离清晰**

- `SkuService`: 商品相关逻辑
- `FavoriteService`: 收藏相关逻辑
- `SkuCardPageService`: 商卡内部协调
- `GlobalCartService`: 全局购物车管理
- `TrackingService`: 埋点记录

### 4. **易于测试**

- 每个 Service 职责单一
- 可以独立测试各个 Service
- 模块化设计便于集成测试

### 5. **性能优化**

- 使用 `@Memo()` 装饰器缓存计算属性
- 细粒度更新，只有相关组件重新渲染
- 避免不必要的计算和重新渲染

## 使用场景

这种架构特别适合：

✅ **可复用组件库** - 商卡可以在多个页面中使用  
✅ **复杂业务逻辑** - 多个 Service 协作处理复杂业务  
✅ **大型应用** - 模块化设计便于团队协作  
✅ **性能敏感** - 细粒度更新和缓存优化  
✅ **埋点需求** - 页面级埋点 Service 统一管理

## 关键设计原则

### 1. 依赖方向

```
✅ 正确：下层依赖上层
SkuCardPageService → GlobalCartService
SkuCardPageService → TrackingService

❌ 错误：上层依赖下层
GlobalCartService → SkuCardPageService
```

### 2. 模块边界

```
✅ 商卡模块内部
- SkuService
- FavoriteService
- SkuCardPageService
- 所有组件

❌ 商卡模块外部
- GlobalCartService（全局共享）
- TrackingService（页面级别）
```

### 3. 接口暴露

```typescript
// ✅ 只暴露 PageService
export { SkuCardPageService } from './PageService';

// ❌ 不暴露内部 Service
// export { SkuService } from './services/SkuService';
```
