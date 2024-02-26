import { defineConfig } from 'dumi';

export default defineConfig({
  base: '/rab',
  locales: [{ id: 'zh-CN', name: '中文' }],
  publicPath: '/rab/',
  resolve: {
    docDirs: ['../docs'],
  },
  favicons: ['https://raw.githubusercontent.com/ximing/static/master/R.png'],
  exportStatic: {},
  themeConfig: {
    name: 'RabJS',
    logo: 'https://raw.githubusercontent.com/ximing/static/master/R.svg',
    nav: {
      // mode可选值有：override、append、prepend
      // - override: 直接覆盖约定导航，与 nav: [{ title: 'Blog', link: '/blog' }] 配置相同
      // - append: 将 value 中的导航追加到约定路由后面
      // - prepend: 将 value 中的导航添加到约定路由前面
      mode: 'append',
      value: [{ title: '代码仓库', link: 'https://github.com/ximing/rab' }],
    },
  },
  styles: [
    `.markdown.markdown blockquote {
      background-color: rgba(255, 229, 100, 0.3);
      color: #454d64;
      border-left-color: #ffe564;
      border-left-width: 9px;
      border-left-style: solid;
      padding: 20px 45px 20px 26px;
      margin-bottom: 30px;
      margin-top: 20px;
      margin-left: -30px;
      margin-right: -30px;
    }

    .markdown.markdown blockquote p:first-of-type {
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 0;
    }`,
  ],
});
