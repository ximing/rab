import { defineConfig } from 'dumi';

export default defineConfig({
  title: 'RabJS',
  mode: 'site',
  hash: process.env.NODE_ENV !== 'development',
  logo: 'https://raw.githubusercontent.com/ximing/static/master/R.svg',
  locales: [['zh-CN', '中文']],
  base: '/rab',
  publicPath: '/rab/',
  navs: [
    null, // null 值代表保留约定式生成的导航，只做增量配置
    {
      title: '代码仓库',
      path: 'https://github.com/ximing/rab',
    },
  ],
  resolve: {
    includes: ['../docs'],
    previewLangs: [],
  },
  favicon: 'https://raw.githubusercontent.com/ximing/static/master/R.png',
  exportStatic: {},
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
  scripts: [],
});
