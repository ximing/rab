import { configure } from 'mobx';
import './middleware';
configure({
  enforceActions: 'never',
});
export * from 'mobx';
export * from 'mobx-react';
export * from '@rabjs/ioc';
export * from './react';
export * from './symbols';
export * from './types';
export * from './instance';
export * from './decorator/service';
