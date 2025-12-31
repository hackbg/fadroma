import type { Step } from '../index.ts';
import { Fn, Pipe } from './function.ts';

export function timestamp (d = new Date()) {
  return d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)
}

export const msec = (t: number) => (t/1000).toFixed(3)+'s'

export const dT = (t0: number) =>
  performance.now() - t0;

/** Start time and duration. */
export type Timed = {
  /** Starting time in milliseconds. */
  t0?: number,
  /** Duration in milliseconds. */
  tD?: number,
};

export const interval = (msec: number, ...steps: Step[]) =>
  Fn.Name(null, async function interval (..._: unknown[]) {
    return setInterval(() => { Pipe(...steps)(performance.now()); }, msec);
  }, { msec });
