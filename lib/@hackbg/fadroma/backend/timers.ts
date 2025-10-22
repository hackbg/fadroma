import type { Step } from '../index.ts';
import { reflect, pipe } from '../call.ts';

export const interval =
  (msec: number, ...steps: Step[]) =>
    reflect(null, async function interval (..._: unknown[]) {
      return setInterval(() => {
        pipe(...steps)(performance.now())
      }, msec);
    }, { msec });

