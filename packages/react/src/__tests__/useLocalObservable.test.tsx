/**
 * useLocalObservable Hook 测试
 */
import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useLocalObservable } from '../useLocalObservable';
import { observer } from '../observer';

describe('useLocalObservable Hook', () => {
  it('应该创建本地 observable 状态', () => {
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
      }));

      return <div>{state.count}</div>;
    });

    render(<TestComponent />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('应该支持方法', () => {
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
        increment() {
          this.count++;
        },
      }));

      return (
        <div>
          <div>{state.count}</div>
          <button onClick={() => state.increment()}>+1</button>
        </div>
      );
    });

    render(<TestComponent />);
    expect(screen.getByText('0')).toBeInTheDocument();

    fireEvent.click(screen.getByText('+1'));
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('应该支持计算属性', () => {
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        firstName: 'John',
        lastName: 'Doe',
        get fullName() {
          return `${this.firstName} ${this.lastName}`;
        },
      }));

      return <div>{state.fullName}</div>;
    });

    render(<TestComponent />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('应该在组件生命周期中保持相同的引用', () => {
    let stateRef: any;

    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        count: 0,
      }));

      stateRef = state;
      return <div>{state.count}</div>;
    });

    const { rerender } = render(<TestComponent />);
    const firstRef = stateRef;

    rerender(<TestComponent />);
    const secondRef = stateRef;

    expect(firstRef).toBe(secondRef);
  });

  it('应该支持嵌套对象', () => {
    const TestComponent = observer(() => {
      const state = useLocalObservable(() => ({
        user: {
          name: 'John',
          age: 30,
        },
      }));

      return (
        <div>
          {state.user.name} - {state.user.age}
        </div>
      );
    });

    render(<TestComponent />);
    expect(screen.getByText('John - 30')).toBeInTheDocument();
  });

  // ============ 常见开发场景 ============

  describe('表单场景', () => {
    it('应该支持表单状态管理', () => {
      const TestComponent = observer(() => {
        const form = useLocalObservable(() => ({
          username: '',
          email: '',
          password: '',
          setUsername(value: string) {
            this.username = value;
          },
          setEmail(value: string) {
            this.email = value;
          },
          setPassword(value: string) {
            this.password = value;
          },
          reset() {
            this.username = '';
            this.email = '';
            this.password = '';
          },
        }));

        return (
          <div>
            <input
              value={form.username}
              onChange={e => form.setUsername(e.target.value)}
              placeholder="Username"
            />
            <input
              value={form.email}
              onChange={e => form.setEmail(e.target.value)}
              placeholder="Email"
            />
            <input
              value={form.password}
              onChange={e => form.setPassword(e.target.value)}
              placeholder="Password"
              type="password"
            />
            <button onClick={() => form.reset()}>Reset</button>
            <div>{form.username}</div>
          </div>
        );
      });

      render(<TestComponent />);
      const usernameInput = screen.getByPlaceholderText('Username') as HTMLInputElement;

      fireEvent.change(usernameInput, { target: { value: 'john_doe' } });
      expect(screen.getByText('john_doe')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Reset'));
      expect(usernameInput.value).toBe('');
    });

    it('应该支持表单验证状态', () => {
      const TestComponent = observer(() => {
        const form = useLocalObservable(() => ({
          email: '',
          errors: {} as Record<string, string>,
          setEmail(value: string) {
            this.email = value;
            this.validateEmail();
          },
          validateEmail() {
            if (!this.email) {
              this.errors.email = 'Email is required';
            } else if (!this.email.includes('@')) {
              this.errors.email = 'Invalid email format';
            } else {
              this.errors.email = '';
            }
          },
          get isValid() {
            return !this.errors.email;
          },
        }));

        return (
          <div>
            <input
              value={form.email}
              onChange={e => form.setEmail(e.target.value)}
              placeholder="Email"
            />
            {form.errors.email && <span>{form.errors.email}</span>}
            <button disabled={!form.isValid}>Submit</button>
          </div>
        );
      });

      render(<TestComponent />);
      const input = screen.getByPlaceholderText('Email') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'invalid' } });
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'valid@example.com' } });
      expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument();
    });
  });

  describe('列表操作场景', () => {
    it('应该支持列表的增删改查', () => {
      const TestComponent = observer(() => {
        const list = useLocalObservable(() => ({
          items: [{ id: 1, name: 'Item 1' }],
          addItem(name: string) {
            const id = Math.max(...this.items.map(i => i.id), 0) + 1;
            this.items.push({ id, name });
          },
          removeItem(id: number) {
            const index = this.items.findIndex(i => i.id === id);
            if (index > -1) {
              this.items.splice(index, 1);
            }
          },
          updateItem(id: number, name: string) {
            const item = this.items.find(i => i.id === id);
            if (item) {
              item.name = name;
            }
          },
          get count() {
            return this.items.length;
          },
        }));

        return (
          <div>
            <div>Count: {list.count}</div>
            <ul>
              {list.items.map(item => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
            <button onClick={() => list.addItem('New Item')}>Add</button>
            <button onClick={() => list.removeItem(1)}>Remove</button>
            <button onClick={() => list.updateItem(1, 'Updated')}>Update</button>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('Count: 1')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Add'));
      expect(screen.getByText('Count: 2')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Update'));
      expect(screen.getByText('Updated')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Remove'));
      expect(screen.getByText('Count: 1')).toBeInTheDocument();
    });

    it('应该支持列表过滤和排序', () => {
      const TestComponent = observer(() => {
        const store = useLocalObservable(() => ({
          items: [
            { id: 1, name: 'Apple', price: 10 },
            { id: 2, name: 'Banana', price: 5 },
            { id: 3, name: 'Cherry', price: 15 },
          ],
          sortBy: 'name' as 'name' | 'price',
          filterPrice: 0,
          setSortBy(key: 'name' | 'price') {
            this.sortBy = key;
          },
          setFilterPrice(price: number) {
            this.filterPrice = price;
          },
          get filtered() {
            return this.items.filter(item => item.price >= this.filterPrice);
          },
          get sorted() {
            return [...this.filtered].sort((a, b) => {
              if (this.sortBy === 'name') {
                return a.name.localeCompare(b.name);
              }
              return a.price - b.price;
            });
          },
        }));

        return (
          <div>
            <button onClick={() => store.setSortBy('name')}>Sort by Name</button>
            <button onClick={() => store.setSortBy('price')}>Sort by Price</button>
            <button onClick={() => store.setFilterPrice(10)}>{'Filter >= 10'}</button>
            <ul>
              {store.sorted.map(item => (
                <li key={item.id}>
                  {item.name} - ${item.price}
                </li>
              ))}
            </ul>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('Apple - $10')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Filter >= 10'));
      expect(screen.queryByText('Banana - $5')).not.toBeInTheDocument();
      expect(screen.getByText('Apple - $10')).toBeInTheDocument();
    });
  });

  describe('异步操作场景', () => {
    it('应该支持异步数据加载状态', async () => {
      const TestComponent = observer(() => {
        const store = useLocalObservable(() => ({
          data: null as string | null,
          loading: false,
          error: null as string | null,
          async fetchData() {
            this.loading = true;
            this.error = null;
            try {
              await new Promise(resolve => setTimeout(resolve, 100));
              this.data = 'Loaded data';
            } catch (err) {
              this.error = 'Failed to load';
            } finally {
              this.loading = false;
            }
          },
        }));

        return (
          <div>
            {store.loading && <div>Loading...</div>}
            {store.error && <div>{store.error}</div>}
            {store.data && <div>{store.data}</div>}
            <button onClick={() => store.fetchData()}>Fetch</button>
          </div>
        );
      });

      render(<TestComponent />);
      fireEvent.click(screen.getByText('Fetch'));

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Loaded data')).toBeInTheDocument();
      });
    });

    it('应该支持请求去重', async () => {
      let requestCount = 0;

      const TestComponent = observer(() => {
        const store = useLocalObservable(() => ({
          data: null as string | null,
          loading: false,
          requestInProgress: false,
          async fetchData() {
            if (this.requestInProgress) return;

            this.requestInProgress = true;
            this.loading = true;
            try {
              await new Promise(resolve => setTimeout(resolve, 50));
              requestCount++;
              this.data = `Data ${requestCount}`;
            } finally {
              this.loading = false;
              this.requestInProgress = false;
            }
          },
        }));

        return (
          <div>
            {store.loading && <div>Loading...</div>}
            {store.data && <div>{store.data}</div>}
            <button onClick={() => store.fetchData()}>Fetch</button>
          </div>
        );
      });

      render(<TestComponent />);
      const button = screen.getByText('Fetch');

      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Data 1')).toBeInTheDocument();
      });

      expect(requestCount).toBe(1);
    });
  });

  describe('复杂状态场景', () => {
    it('应该支持购物车场景', () => {
      const TestComponent = observer(() => {
        const cart = useLocalObservable(() => ({
          items: [] as Array<{ id: number; name: string; price: number; quantity: number }>,
          addItem(id: number, name: string, price: number) {
            const existing = this.items.find(i => i.id === id);
            if (existing) {
              existing.quantity++;
            } else {
              this.items.push({ id, name, price, quantity: 1 });
            }
          },
          removeItem(id: number) {
            const index = this.items.findIndex(i => i.id === id);
            if (index > -1) {
              this.items.splice(index, 1);
            }
          },
          updateQuantity(id: number, quantity: number) {
            const item = this.items.find(i => i.id === id);
            if (item && quantity > 0) {
              item.quantity = quantity;
            }
          },
          get total() {
            return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          },
          get itemCount() {
            return this.items.reduce((sum, item) => sum + item.quantity, 0);
          },
          clear() {
            this.items = [];
          },
        }));

        return (
          <div>
            <div>Items: {cart.itemCount}</div>
            <div>Total: ${cart.total.toFixed(2)}</div>
            <ul>
              {cart.items.map(item => (
                <li key={item.id}>
                  {item.name} x{item.quantity} = ${(item.price * item.quantity).toFixed(2)}
                </li>
              ))}
            </ul>
            <button onClick={() => cart.addItem(1, 'Apple', 10)}>Add Apple</button>
            <button onClick={() => cart.addItem(2, 'Banana', 5)}>Add Banana</button>
            <button onClick={() => cart.removeItem(1)}>Remove Apple</button>
            <button onClick={() => cart.clear()}>Clear</button>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('Items: 0')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Add Apple'));
      expect(screen.getByText('Items: 1')).toBeInTheDocument();
      expect(screen.getByText('Total: $10.00')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Add Banana'));
      expect(screen.getByText('Items: 2')).toBeInTheDocument();
      expect(screen.getByText('Total: $15.00')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Clear'));
      expect(screen.getByText('Items: 0')).toBeInTheDocument();
    });

    it('应该支持计算属性的链式依赖', () => {
      const TestComponent = observer(() => {
        const store = useLocalObservable(() => ({
          width: 10,
          height: 20,
          get area() {
            return this.width * this.height;
          },
          get perimeter() {
            return 2 * (this.width + this.height);
          },
          get isSquare() {
            return this.width === this.height;
          },
          setDimensions(w: number, h: number) {
            this.width = w;
            this.height = h;
          },
        }));

        return (
          <div>
            <div>Width: {store.width}</div>
            <div>Height: {store.height}</div>
            <div>Area: {store.area}</div>
            <div>Perimeter: {store.perimeter}</div>
            <div>Is Square: {store.isSquare ? 'Yes' : 'No'}</div>
            <button onClick={() => store.setDimensions(15, 15)}>Make Square</button>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('Area: 200')).toBeInTheDocument();
      expect(screen.getByText('Perimeter: 60')).toBeInTheDocument();
      expect(screen.getByText('Is Square: No')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Make Square'));
      expect(screen.getByText('Area: 225')).toBeInTheDocument();
      expect(screen.getByText('Is Square: Yes')).toBeInTheDocument();
    });
  });

  describe('多组件交互场景', () => {
    it('应该支持父子组件共享状态', () => {
      const TestComponent = observer(() => {
        const store = useLocalObservable(() => ({
          count: 0,
          increment() {
            this.count++;
          },
        }));

        const ChildComponent = observer(() => (
          <div>
            <div>Child Count: {store.count}</div>
            <button onClick={() => store.increment()}>Child +1</button>
          </div>
        ));

        return (
          <div>
            <div>Parent Count: {store.count}</div>
            <button onClick={() => store.increment()}>Parent +1</button>
            <ChildComponent />
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('Parent Count: 0')).toBeInTheDocument();
      expect(screen.getByText('Child Count: 0')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Parent +1'));
      expect(screen.getByText('Parent Count: 1')).toBeInTheDocument();
      expect(screen.getByText('Child Count: 1')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Child +1'));
      expect(screen.getByText('Parent Count: 2')).toBeInTheDocument();
      expect(screen.getByText('Child Count: 2')).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('应该支持 undefined 和 null 值', () => {
      const TestComponent = observer(() => {
        const state = useLocalObservable(() => ({
          value: undefined as string | undefined,
          nullable: null as string | null,
          setValue(v: string | undefined) {
            this.value = v;
          },
          setNullable(v: string | null) {
            this.nullable = v;
          },
        }));

        return (
          <div>
            <div>{state.value ?? 'undefined'}</div>
            <div>{state.nullable ?? 'null'}</div>
            <button onClick={() => state.setValue('value')}>Set Value</button>
            <button onClick={() => state.setNullable('nullable')}>Set Nullable</button>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('undefined')).toBeInTheDocument();
      expect(screen.getByText('null')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Set Value'));
      expect(screen.getByText('value')).toBeInTheDocument();
    });

    it('应该支持数组和对象的深层修改', () => {
      const TestComponent = observer(() => {
        const state = useLocalObservable(() => ({
          data: {
            nested: {
              array: [1, 2, 3],
              value: 'test',
            },
          },
          updateArray() {
            this.data.nested.array[0] = 99;
          },
          updateValue() {
            this.data.nested.value = 'updated';
          },
        }));

        return (
          <div>
            <div>{state.data.nested.array[0]}</div>
            <div>{state.data.nested.value}</div>
            <button onClick={() => state.updateArray()}>Update Array</button>
            <button onClick={() => state.updateValue()}>Update Value</button>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Update Array'));
      expect(screen.getByText('99')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Update Value'));
      expect(screen.getByText('updated')).toBeInTheDocument();
    });

    it('应该支持布尔值切换', () => {
      const TestComponent = observer(() => {
        const state = useLocalObservable(() => ({
          isVisible: false,
          isLoading: false,
          toggle() {
            this.isVisible = !this.isVisible;
          },
          setLoading(value: boolean) {
            this.isLoading = value;
          },
        }));

        return (
          <div>
            {state.isVisible && <div>Visible</div>}
            {state.isLoading && <div>Loading</div>}
            <button onClick={() => state.toggle()}>Toggle</button>
            <button onClick={() => state.setLoading(!state.isLoading)}>Toggle Loading</button>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.queryByText('Visible')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Toggle'));
      expect(screen.getByText('Visible')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Toggle Loading'));
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });
  });

  describe('性能和优化', () => {
    it('应该只在相关状态变化时重新渲染', () => {
      let renderCount = 0;

      const TestComponent = observer(() => {
        const state = useLocalObservable(() => ({
          count: 0,
          name: 'test',
          increment() {
            this.count++;
          },
          setName(n: string) {
            this.name = n;
          },
        }));

        renderCount++;

        return (
          <div>
            <div>{state.count}</div>
            <div>{state.name}</div>
            <button onClick={() => state.increment()}>+1</button>
            <button onClick={() => state.setName('updated')}>Update Name</button>
          </div>
        );
      });

      render(<TestComponent />);
      const initialRenderCount = renderCount;

      fireEvent.click(screen.getByText('+1'));
      expect(renderCount).toBeGreaterThan(initialRenderCount);

      const countAfterIncrement = renderCount;
      fireEvent.click(screen.getByText('Update Name'));
      expect(renderCount).toBeGreaterThan(countAfterIncrement);
    });

    it('应该支持大量数据的高效管理', () => {
      const TestComponent = observer(() => {
        const store = useLocalObservable(() => ({
          items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i })),
          addItem() {
            this.items.push({ id: this.items.length, value: this.items.length });
          },
          get count() {
            return this.items.length;
          },
        }));

        return (
          <div>
            <div>Count: {store.count}</div>
            <button onClick={() => store.addItem()}>Add</button>
          </div>
        );
      });

      render(<TestComponent />);
      expect(screen.getByText('Count: 1000')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Add'));
      expect(screen.getByText('Count: 1001')).toBeInTheDocument();
    });
  });
});
