# Service Decorator

The `@Service` decorator is a utility that simplifies service class creation by combining the `@Injectable()` decorator and extending the base `Service` class.

## Usage

Instead of:

```typescript
@Injectable()
export class MyService extends Service {
  // Service implementation
}
```

You can now use:

```typescript
@Service()
export class MyService {
  // Service implementation
}
```

## Benefits

- Cleaner syntax
- Less boilerplate code
- Maintains all functionality of the original implementation

## Example

```typescript
import { Service } from '../decorator/service';

@Service()
export class MemoService {
  private memos: string[] = [];

  async addMemo(memo: string): Promise<void> {
    this.memos.push(memo);
  }

  getMemos(): string[] {
    return this.memos;
  }
}
```

## How it works

The `@Service` decorator:

1. Applies the `@Injectable()` decorator to the class
2. Extends the base `Service` class
3. Preserves the constructor and prototype chain

## $model Property

When using a service with the `useService` or `useViewService` hooks, the service instance will have a `$model` property that tracks the loading and error states of async methods:

```typescript
// The $model property has the following structure:
$model: {
  [methodName: string]: {
    loading: boolean;
    error: Error | null;
  }
}
```

For example, if you have an async method called `addMemo` in your service, you can access its loading and error states like this:

```typescript
const memoService = useService(MemoService);

// Check if addMemo is loading
if (memoService.$model.addMemo.loading) {
  // Show loading indicator
}

// Check if addMemo has an error
if (memoService.$model.addMemo.error) {
  // Show error message
}
```

This property is automatically populated for all async methods in the service, and it's updated whenever the method is called.

## Service Lifecycles

The `useService` hook supports different service lifecycles through the `scope` option:

### Singleton (Default)

The service is a singleton, shared across the entire application. This is the default behavior.

```typescript
const service = useService(MyService);
// or
const service = useService(MyService, { scope: 'singleton' });
```

### Transient

Each component gets its own service instance, unique within the component's lifecycle. When the component unmounts, the service instance is destroyed.

```typescript
const service = useService(MyService, { scope: 'transient' });
```

### Request

The service is unique within a specific scope (e.g., a component tree). All components within the same scope share the same service instance.

There are two ways to define a request scope:

1. Using the `RequestScopeProvider` component:

```typescript
<RequestScopeProvider scopeId="myScope">
  <ComponentA />
  <ComponentB />
</RequestScopeProvider>
```

2. Manually specifying a `requestScopeId`:

```typescript
const service = useService(MyService, {
  scope: 'request',
  requestScopeId: 'myScope',
});
```

Components with the same `requestScopeId` will share the same service instance.

## Service Instance Destruction

Service instances are automatically destroyed in the following scenarios:

1. **Transient Scope**: When the component using the service unmounts.
2. **Request Scope**:
   - When all components using the service with the same `requestScopeId` unmount.
   - When the `RequestScopeProvider` unmounts (for all services within that scope).
   - When a component using the service unmounts (if no `requestScopeId` is provided).

The system uses a reference counting mechanism to track how many components are using a service instance within a Request scope. The service instance is only destroyed when the reference count reaches zero, ensuring that the instance is shared correctly among all components in the same scope.

The destruction process includes:

1. Calling the service's `destroy` method (if it exists).
2. Unbinding the service from the container.

You can implement a `destroy` method in your service to perform cleanup:

```typescript
@Service()
export class MyService {
  // ... other methods

  destroy() {
    // Clean up resources, cancel subscriptions, etc.
  }
}
```
