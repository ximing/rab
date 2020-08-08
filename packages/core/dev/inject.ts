import { Service, Transient, Request, Injectable, container, Inject, Scope } from '../src';
import { LazyServiceIdentifer } from 'inversify';

@Injectable()
class OtherService extends Service {
  count = -1;

  subtract(n: number) {
    this.count -= n;
  }
}

@Injectable()
class CountService extends Service {
  count = 0;

  // type 1
  @Inject(OtherService) @Scope(Transient) other!: OtherService;

  // type 2
  constructor(
    public other1: OtherService,

    @Scope(Transient) public other2: OtherService,
    @Inject(OtherService) @Scope(Transient) public other3: OtherService,

    @Inject(new LazyServiceIdentifer(() => OtherService))
    @Scope(Transient)
    public other4: OtherService,

    @Scope(Request) public other5: OtherService,
    @Scope(Request) public other6: OtherService
  ) {
    super();
  }

  setCount(count: number) {
    this.count = count;
  }

  syncCount() {
    this.count = this.other.count;
  }

  proxySubtract(n: number) {
    return this.other2.subtract(n);
  }
}
const countModel = container.resolveInScope(CountService, Transient);
console.log(countModel);
