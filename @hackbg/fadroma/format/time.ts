export function timestamp (d = new Date()) {
  return d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)
}

export const msec = (t: number) =>
  (t/1000).toFixed(0)+'.'+((t%1000).toFixed(0).padStart(3, '0')+'s')

export const dT = (t0: number) =>
  performance.now() - t0;

/** Start time and duration. */
export type Timed = {
  /** Starting time in milliseconds. */
  t0?: number,
  /** Duration in milliseconds. */
  tD?: number,
};
