import { yellow } from './color.ts';

export function timestamp (d = new Date()) {
  return d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)
}

export const msec = (t: number) =>
  yellow((t.toFixed(0)+'ms').padEnd(10));
