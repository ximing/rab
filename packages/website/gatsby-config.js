'use strict';
module.exports = {
  pathPrefix: '/rabjs',
  siteMetadata: {
    title: `RSJS`,
    description: `rabjs demo website`,
    keywords: `rabjs, javascript, typescript`,
    siteUrl: 'https://ximing.github.io/rabjs',
    author: {
      name: 'ximing',
      url: ''
    }
  },
  plugins: [
    'gatsby-plugin-typescript',
    `gatsby-plugin-sharp`,
    `gatsby-transformer-sharp`,
    `gatsby-remark-images`,
    `gatsby-transformer-json`,
    `gatsby-plugin-react-helmet`,
    `gatsby-plugin-emotion`,
    {
      resolve: `gatsby-plugin-mdx`,
      options: {
        extensions: [`.mdx`, `.md`],
        gatsbyRemarkPlugins: [
          'gatsby-remark-normalize-paths',
          {
            resolve: `gatsby-remark-images`,
            options: {
              maxWidth: 980
            }
          },
          {
            resolve: `gatsby-remark-responsive-iframe`,
            options: {
              wrapperStyle: `margin-bottom: 1.0725rem`
            }
          },
          {
            resolve: `gatsby-remark-prismjs`,
            options: {
              showLineNumbers: true
            }
          },
          {
            resolve: 'gatsby-remark-external-links',
            options: {
              target: '_blank',
              rel: 'nofollow'
            }
          },
          `gatsby-remark-copy-linked-files`,
          `gatsby-remark-smartypants`,
          `gatsby-remark-emoji`
        ],
        remarkPlugins: []
      }
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/src/content`,
        name: `content`,
        ignore: [`**/~*`] // ignore files starting with a dot
      }
    },
    {
      resolve: 'gatsby-plugin-html-attributes',
      options: {
        lang: 'zh-Hans'
      }
    },
    {
      resolve: 'gatsby-plugin-canonical-urls',
      options: {
        siteUrl: 'http://github.sankuai.com/ximing/rab'
      }
    }
  ]
};
