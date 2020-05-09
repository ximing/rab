import * as React from 'react';
import { graphql } from 'gatsby';

import Page from '../components/Page';
import Container from '../components/Container';
import IndexLayout from '../layouts';
import { MDXRenderer } from 'gatsby-plugin-mdx';
import { MDXProvider } from '@mdx-js/react';
import { shortcodes } from '../shortcodes';

interface PageTemplateProps {
  data: {
    site: {
      siteMetadata: {
        title: string;
        description: string;
      };
    };
    mdx: {
      body: any;
      excerpt: string;
      frontmatter: {
        title: string;
      };
    };
  };
}

const PageTemplate: React.FC<PageTemplateProps> = ({ data }) => (
  <IndexLayout>
    <MDXProvider components={shortcodes}>
      <Page>
        <Container>
          <h1>{data.mdx.frontmatter.title}</h1>
          {/* eslint-disable-next-line react/no-danger */}
          <MDXRenderer>{data.mdx.body}</MDXRenderer>
        </Container>
      </Page>
    </MDXProvider>
  </IndexLayout>
);

export default PageTemplate;

export const query = graphql`
  query PageTemplateQuery($slug: String!) {
    site {
      siteMetadata {
        title
        description
      }
    }
    mdx(fields: { slug: { eq: $slug } }) {
      body
      excerpt
      frontmatter {
        title
      }
    }
  }
`;
