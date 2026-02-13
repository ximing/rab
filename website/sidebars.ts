import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'React + Service 集成',
      collapsed: false,
      items: [
        'react-service/quick-start',
        'react-service/basic-usage',
        'react-service/service-deep-dive',
        'react-service/decorators',
        'react-service/service-domain',
        'react-service/strict-context',
        'react-service/hooks',
        'react-service/ssr',
        'react-service/observer-vs-view',
      ],
    },
    {
      type: 'category',
      label: '响应式状态',
      collapsed: false,
      items: [
        'observer/introduction',
        'observer/observable',
        'observer/observe',
        'observer/advanced',
      ],
    },
  ],
  exampleSidebar: [
    {
      type: 'category',
      label: '📚 完整案例集合',
      collapsed: false,
      items: [
        'example/index',
        'example/simple-counter',
        'example/todo-list',
        'example/user-management',
        'example/component-service-wrapper',
        'example/sku-card-component',
      ],
    },
  ],
  apiSidebar: [
    {
      type: 'category',
      label: 'API 文档',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: '@rabjs/observer',
          collapsed: false,
          items: ['api/observer-api'],
        },
        {
          type: 'category',
          label: '@rabjs/service',
          collapsed: false,
          items: ['api/service-api'],
        },
        {
          type: 'category',
          label: '@rabjs/react',
          collapsed: false,
          items: ['api/react-api'],
        },
      ],
    },
  ],
};

export default sidebars;
