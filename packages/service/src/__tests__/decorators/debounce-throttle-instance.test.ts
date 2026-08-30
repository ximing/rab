/**
 * @Debounce / @Throttle 每实例状态测试
 *
 * 定时器与 pending 参数必须按实例隔离：装饰器闭包在类定义时只执行
 * 一次，闭包变量是类级共享的——一个实例的调用会被另一个实例覆盖
 * 吞掉，一个实例 destroy 会取消其他实例的 pending 调用（#220）。
 */
import { Service } from '../../service';
import { Debounce, Throttle } from '../../decorators';

describe('@Debounce / @Throttle 每实例状态（#220）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('@Debounce', () => {
    class SearchService extends Service {
      hits: string[] = [];

      @Debounce(50)
      search(keyword: string) {
        this.hits.push(keyword);
      }
    }

    it('两个实例各自防抖，互不吞掉对方的调用', () => {
      const s1 = new SearchService();
      const s2 = new SearchService();

      s1.search('one');
      s2.search('two');

      jest.advanceTimersByTime(100);

      expect(s1.hits).toEqual(['one']);
      expect(s2.hits).toEqual(['two']);
    });

    it('一个实例 destroy 不取消其他实例的 pending 调用', () => {
      const s3 = new SearchService();
      const s4 = new SearchService();

      s3.search('three');
      s4.search('four');
      s4.destroy();

      jest.advanceTimersByTime(100);

      expect(s3.hits).toEqual(['three']);
      expect(s4.hits).toEqual([]);
    });

    it('destroy 只取消自己的 pending 调用', () => {
      const s5 = new SearchService();

      s5.search('five');
      s5.destroy();

      jest.advanceTimersByTime(100);

      expect(s5.hits).toEqual([]);
    });
  });

  describe('@Throttle', () => {
    class ScrollService extends Service {
      hits: string[] = [];

      @Throttle(50, { leading: false, trailing: true })
      handleScroll(tag: string) {
        this.hits.push(tag);
      }
    }

    it('两个实例各自节流，trailing 调用互不覆盖', () => {
      const s1 = new ScrollService();
      const s2 = new ScrollService();

      s1.handleScroll('one');
      s2.handleScroll('two');

      jest.advanceTimersByTime(100);

      expect(s1.hits).toEqual(['one']);
      expect(s2.hits).toEqual(['two']);
    });

    it('一个实例 destroy 不取消其他实例的 pending 调用', () => {
      const s3 = new ScrollService();
      const s4 = new ScrollService();

      s3.handleScroll('three');
      s4.handleScroll('four');
      s4.destroy();

      jest.advanceTimersByTime(100);

      expect(s3.hits).toEqual(['three']);
      expect(s4.hits).toEqual([]);
    });
  });
});
