'use strict';

const path = require('path');
// const _ = require('lodash');
const { createFilePath } = require(`gatsby-source-filesystem`);

exports.sourceNodes = ({ actions }) => {
  const { createTypes } = actions;
  createTypes(`
    type MarkdownRemarkFrontmatter {
      description: String
      tags: [String]
    }
    type Mdx implements Node {
      frontmatter: MarkdownRemarkFrontmatter
    }
  `);
};

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions;

  const page = path.resolve(`./src/templates/page.tsx`);
  // const tagTemplate = path.resolve('src/templates/tags.js');

  return graphql(
    `
      {
        allMdx {
          edges {
            node {
              id
              frontmatter {
                title
                tags
                description
              }
              fields {
                slug
              }
            }
          }
        }
      }
    `
  ).then((result) => {
    if (result.errors) {
      throw result.errors;
    }
    // Create blog posts pages.
    const contents = result.data.allMdx.edges;

    contents.forEach((post, index) => {
      const previous = index === contents.length - 1 ? null : contents[index + 1].node;
      const next = index === 0 ? null : contents[index - 1].node;

      // Create post detail pages
      createPage({
        path: post.node.fields.slug,
        component: page,
        context: {
          slug: post.node.fields.slug,
          previous,
          next
        }
      });

      // // Tag pages:
      // let tags = [];
      // // Iterate through each post, putting all found tags into `tags`
      // _.each(contents, (edge) => {
      //   if (_.get(edge, 'node.frontmatter.tags')) {
      //     tags = tags.concat(edge.node.frontmatter.tags);
      //   }
      // });
      // // Eliminate duplicate tags
      // tags = _.uniq(tags);

      // // Make tag pages
      // tags.forEach((tag) => {
      //   createPage({
      //     path: `/tags/${_.kebabCase(tag)}/`,
      //     component: tagTemplate,
      //     context: {
      //       tag,
      //     },
      //   });
      // });
    });
  });
};

exports.onCreateNode = ({ node, actions, getNode }) => {
  const { createNodeField, layout } = actions;

  // Sometimes, optional fields tend to get not picked up by the GraphQL
  // interpreter if not a single content uses it. Therefore, we're putting them
  // through `createNodeField` so that the fields still exist and GraphQL won't
  // trip up. An empty string is still required in replacement to `null`.

  switch (node.internal.type) {
    case 'Mdx': {
      const relativeFilePath = createFilePath({ node, getNode });
      createNodeField({
        name: 'slug',
        node,
        value: `/content${relativeFilePath}`
      });
      // Used to determine a page layout.
      createNodeField({
        node,
        name: 'layout',
        value: layout || ''
      });
      break;
    }
  }
};

exports.onCreateBabelConfig = ({ actions }) => {
  actions.setBabelPlugin({
    name: `babel-plugin-import`,
    options: {
      libraryName: 'antd',
      libraryDirectory: 'es',
      style: true
    }
  });
};
