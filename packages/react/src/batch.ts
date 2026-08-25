import { configure } from '@rabjs/observer';

import { unstable_batchedUpdates } from './platforms/react-batched-updates';
configure({
  scheduler: unstable_batchedUpdates,
});
