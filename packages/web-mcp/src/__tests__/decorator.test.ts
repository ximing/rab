/**
 * decorator.ts 单元测试
 */

import { mcpTool } from '../decorator';
import { getMcpToolMetadataList, getMcpToolMetadata } from '../utils/reflect';

describe('mcpTool 装饰器', () => {
  it('标注方法后可读取元数据', () => {
    class TestService {
      @mcpTool({ description: '获取订单列表' })
      fetchOrders() {
        return [];
      }
    }

    const proto = TestService.prototype;
    const metaList = getMcpToolMetadataList(proto);

    expect(metaList).toHaveLength(1);
    expect(metaList[0]).toEqual({
      methodName: 'fetchOrders',
      options: { description: '获取订单列表' },
    });
  });

  it('多个方法都被标注时，全部可读取', () => {
    class CartService {
      @mcpTool({ description: '获取购物车' })
      getCart() {
        return {};
      }

      @mcpTool({ description: '添加商品' })
      addItem(_id: string) {
        return true;
      }

      @mcpTool({ description: '清空购物车' })
      clearCart() {
        return;
      }
    }

    const metaList = getMcpToolMetadataList(CartService.prototype);
    expect(metaList).toHaveLength(3);

    const names = metaList.map(m => m.methodName);
    expect(names).toContain('getCart');
    expect(names).toContain('addItem');
    expect(names).toContain('clearCart');
  });

  it('自定义 name 选项', () => {
    class OrderService {
      @mcpTool({ description: '获取订单', name: 'custom_tool_name' })
      fetchOrders() {
        return [];
      }
    }

    const meta = getMcpToolMetadata(OrderService.prototype, 'fetchOrders');
    expect(meta?.options.name).toBe('custom_tool_name');
  });

  it('传入 params 配置', () => {
    class ProductService {
      @mcpTool({
        description: '搜索商品',
        params: [
          { type: 'string', description: '关键词', required: true },
          { type: 'number', description: '页码' },
        ],
      })
      searchProducts(_keyword: string, _page: number) {
        return [];
      }
    }

    const meta = getMcpToolMetadata(ProductService.prototype, 'searchProducts');
    expect(meta?.options.params).toHaveLength(2);
    expect(meta?.options.params?.[0]?.description).toBe('关键词');
    expect(meta?.options.params?.[0]?.required).toBe(true);
  });

  it('未被标注的方法不在元数据中', () => {
    class MixedService {
      @mcpTool({ description: '标注方法' })
      annotatedMethod() {
        return;
      }

      normalMethod() {
        return;
      }
    }

    const metaList = getMcpToolMetadataList(MixedService.prototype);
    expect(metaList).toHaveLength(1);

    const names = metaList.map(m => m.methodName);
    expect(names).not.toContain('normalMethod');
  });

  it('子类和父类的元数据相互隔离', () => {
    class BaseService {
      @mcpTool({ description: '父类方法' })
      parentMethod() {
        return;
      }
    }

    class ChildService extends BaseService {
      @mcpTool({ description: '子类方法' })
      childMethod() {
        return;
      }
    }

    // 子类自身 metadata 只包含 childMethod
    const childMeta = getMcpToolMetadataList(ChildService.prototype);
    const childNames = childMeta.map(m => m.methodName);
    expect(childNames).toContain('childMethod');
    expect(childNames).not.toContain('parentMethod'); // 不包含父类的

    // 父类自身只包含 parentMethod
    const parentMeta = getMcpToolMetadataList(BaseService.prototype);
    const parentNames = parentMeta.map(m => m.methodName);
    expect(parentNames).toContain('parentMethod');
    expect(parentNames).not.toContain('childMethod');
  });
});
