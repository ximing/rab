import useBaseUrl from '@docusaurus/useBaseUrl';
import Heading from '@theme/Heading';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  image: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '🎯 简单易用',
    image: '/img/easy.jpeg',
    description: (
      <>
        无需手动订阅和取消订阅，自动追踪依赖关系。直观的 API 设计让你快速上手，5 分钟即可开始使用。
      </>
    ),
  },
  {
    title: '⚡ 高性能',
    image: '/img/perf.jpeg',
    description: (
      <>
        细粒度追踪，只追踪实际访问的属性。自动批量更新，避免不必要的重新渲染。完全支持 React 18+
        并发模式。
      </>
    ),
  },
  {
    title: '🔒 类型安全',
    image: '/img/ts.jpeg',
    description: (
      <>完整的 TypeScript 类型推导，编译时类型检查，智能代码提示。让你的代码更加健壮和可维护。</>
    ),
  },
  {
    title: '📦 功能完整',
    image: '/img/function.jpeg',
    description: (
      <>自动的 loading 和 error 状态管理，内置依赖注入容器，支持装饰器，完整的 SSR 支持。</>
    ),
  },
  {
    title: '🏗️ 架构灵活',
    image: '/img/service.jpeg',
    description: (
      <>Service 层框架提供了清晰的架构模式，支持 Service 之间的依赖注入，适合构建大型应用。</>
    ),
  },
  {
    title: '🚀 开箱即用',
    image: '/img/box.jpeg',
    description: (
      <>提供了完整的 React 集成，包括 observer HOC、useService Hook、bindServices 等实用工具。</>
    ),
  },
];

function Feature({ title, image, description }: FeatureItem) {
  const imageUrl = useBaseUrl(image);
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className="text--center">
          <img src={imageUrl} alt={title} className={styles.featureSvg} />
        </div>
        <div className="text--center">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
