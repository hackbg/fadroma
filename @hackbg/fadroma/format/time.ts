import { yellow } from './ansi.ts';

export function timestamp (d = new Date()) {
  return d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)
}

export const msec = (t: number) =>
  yellow((t.toFixed(0)+'ms').padEnd(10));

export const dT = (t0: number) =>
  performance.now() - t0;

/** Start time and duration. */
export type Timed = {
  /** Starting time in milliseconds. */
  t0?: number,
  /** Duration in milliseconds. */
  tD?: number,
};
