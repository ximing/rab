/**
 * @Inject 每实例缓存测试
 *
 * 缓存必须按实例隔离：装饰器闭包在类定义时只执行一次，
 * 闭包变量是类级共享的——第二个实例会拿到第一个实例从别的
 * 容器解析出的依赖（#219）。
 */
import { Service } from '../../service';
import { Inject } from '../../decorators';
import { Container, createContainer, ServiceScope } from '../../ioc';

class RepoA extends Service {
  tag = 'A';
}
class RepoB extends Service {
  tag = 'B';
}

class Svc extends Service {
  @Inject('repo')
  repo!: { tag: string };

  get repoTag(): string {
    return this.repo.tag;
  }
}

describe('@Inject 每实例缓存（#219）', () => {
  let c1: Container;
  let c2: Container;

  beforeEach(() => {
    c1 = createContainer('inject-c1');
    c2 = createContainer('inject-c2');
  });

  afterEach(async () => {
    await c1.destroy();
    await c2.destroy();
  });

  it('不同容器的实例各自从所属容器解析依赖', () => {
    c1.register('repo', RepoA);
    c1.register(Svc);
    c2.register('repo', RepoB);
    c2.register(Svc);

    const s1 = c1.resolve(Svc);
    expect(s1.repoTag).toBe('A');

    const s2 = c2.resolve(Svc);
    expect(s2.repoTag).toBe('B');
  });

  it('同标识符换绑后，新解析的实例拿到新绑定', () => {
    c1.register('repo', RepoA);
    c1.register(Svc, { scope: ServiceScope.Transient });

    const s1 = c1.resolve(Svc);
    expect(s1.repoTag).toBe('A');

    c1.register('repo', RepoB);
    const s2 = c1.resolve(Svc);
    expect(s2.repoTag).toBe('B');
    // s1 的缓存不受影响
    expect(s1.repoTag).toBe('A');
  });

  it('手动 set 只影响当前实例，不影响其他实例的注入', () => {
    c1.register('repo', RepoA);
    c1.register(Svc, { scope: ServiceScope.Transient });

    const s1 = c1.resolve(Svc);
    const s2 = c1.resolve(Svc);

    expect(s1.repoTag).toBe('A');
    expect(s2.repoTag).toBe('A');

    const manual = new RepoB();
    (s1 as any).repo = manual;

    expect(s1.repo).toBe(manual);
    expect(s2.repo).not.toBe(manual);
    expect(s2.repoTag).toBe('A');
  });
});
