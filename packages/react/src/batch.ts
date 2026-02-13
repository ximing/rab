import { configure } from '@rabjs/observer';

import { unstable_batchedUpdates } from './platforms/reactBatchedUpdates';
configure({
  scheduler: unstable_batchedUpdates,
});
