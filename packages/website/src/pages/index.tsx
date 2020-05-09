import * as React from 'react';
import { graphql, useStaticQuery } from 'gatsby';
import { MDXRenderer } from 'gatsby-plugin-mdx';
import { MDXProvider } from '@mdx-js/react';
// import ExampleComponent from '@library';

import Page from '../components/Page';
import Container from '../components/Container';
import IndexLayout from '../layouts';
import { shortcodes } from '../shortcodes';

const IndexPage = () => {
  const data = useStaticQuery(graphql`
    query IndexPage {
      site {
        siteMetadata {
          title
        }
      }
      mdx(fields: { slug: { eq: "/content/readme/" } }) {
        body
        excerpt
        frontmatter {
          title
        }
      }
    }
  `);
  console.log(data);
  return (
    <IndexLayout>
      <MDXProvider components={shortcodes}>
        <Page>
          <Container>
            <MDXRenderer>{data.mdx.body}</MDXRenderer>
            {/* <ExampleComponent text={'xxx'} /> */}
            123
          </Container>
        </Page>
      </MDXProvider>
    </IndexLayout>
  );
};

export default IndexPage;
