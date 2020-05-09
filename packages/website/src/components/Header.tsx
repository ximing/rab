import * as React from 'react';
import styled from '@emotion/styled';
import { transparentize } from 'polished';
import { Link } from 'gatsby';
import { css } from '@emotion/core';
import { heights, dimensions, colors } from '../styles/variables';
import Container from './Container';

const StyledHeader = styled.header`
  height: ${heights.header}px;
  padding: 0 ${dimensions.containerPadding}rem;
  background-color: ${colors.white};
  color: ${transparentize(0.5, colors.white)};
  position: relative;
  &:after {
    background-color: rgb(240, 240, 242);
    bottom: -1px;
    content: '';
    height: 1px;
    left: 0rem;
    position: absolute;
    right: 0rem;
    z-index: -1;
  }
`;

const HeaderInner = styled(Container)`
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100%;
  justify-content: space-between;
`;

const HomepageLink = styled(Link)`
  color: ${colors.black};
  font-size: 1.5rem;
  font-weight: 600;
  &:hover,
  &:focus {
    text-decoration: none;
  }
`;

const PageLink = styled(Link)`
  color: ${colors.navColor};
  font-size: 0.9rem;
  margin-left: 25px;
  height: ${heights.header}px;
  line-height: ${heights.header}px;
  border-bottom: 2px solid transparent;
  display: inline-block;
  &:hover,
  &:focus {
    color: ${colors.lilac};
    text-decoration: none;
  }
  &.active {
    border-bottom-color: ${colors.brand};
    color: ${colors.brand};
  }
`;

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => (
  <StyledHeader>
    <HeaderInner>
      <HomepageLink to="/">{title}</HomepageLink>
      <div
        css={css`
          height: ${heights.header}px;
          line-height: ${heights.header}px;
        `}
      >
        <PageLink activeClassName={'active'} to={'/guide'}>
          指南
        </PageLink>
        <PageLink activeClassName={'active'} to={'/api'}>
          API
        </PageLink>
        <PageLink
          activeClassName={'active'}
          to={'#'}
          onClick={(e) => {
            e.preventDefault();
            window.open('http://github.com/ximing/rab', '_blank');
          }}
        >
          <span>github</span>
          <svg
            style={{
              verticalAlign: 'text-bottom',
              marginLeft: 2
            }}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            x="0px"
            y="0px"
            viewBox="0 0 100 100"
            width="17"
            height="17"
            className="icon outbound"
          >
            <path
              fill="currentColor"
              d="M18.8,85.1h56l0,0c2.2,0,4-1.8,4-4v-32h-8v28h-48v-48h28v-8h-32l0,0c-2.2,0-4,1.8-4,4v56C14.8,83.3,16.6,85.1,18.8,85.1z"
            ></path>
            <polygon
              fill="currentColor"
              points="45.7,48.7 51.3,54.3 77.2,28.5 77.2,37.2 85.2,37.2 85.2,14.9 62.8,14.9 62.8,22.9 71.5,22.9"
            ></polygon>
          </svg>
        </PageLink>
      </div>
    </HeaderInner>
  </StyledHeader>
);

export default Header;
