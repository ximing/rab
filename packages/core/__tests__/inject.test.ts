import { Service, Transient, Injectable, container, Inject, Scope, ServiceResult } from '../src';
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
    public other4: OtherService
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

describe('Inject specs:', () => {
  let countModel: ServiceResult<CountService>;

  beforeEach(() => {
    countModel = container.resolveServiceInScope(CountService, Transient);
  });

  it('getState', () => {
    expect(countModel.count).toEqual(0);
    countModel.setCount(10);
    expect(countModel.count).toEqual(10);
  });

  it('should property inject work', () => {
    expect(countModel.other.count).toEqual(-1);
  });

  it('should constructor inject work', () => {
    ['other1', 'other2', 'other3', 'other4'].forEach((key: any) => {
      expect((countModel as any)[key].count).toEqual(-1);
    });
  });

  it('should scope decorator default to Singleton', () => {
    countModel.other1.subtract(1);
    container.unbind(CountService);
    countModel = container.resolveServiceInScope(CountService, Transient);
    expect(countModel.other1.count).toEqual(-2);
  });

  it('should effect take effect asyncly', () => {
    countModel.proxySubtract(1);
    expect(countModel.other2.count).toEqual(-2);
  });
});
