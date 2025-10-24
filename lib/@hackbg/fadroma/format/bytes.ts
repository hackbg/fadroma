import type { Buffer } from '../deps.ts';
import { UTF8 } from './string.ts';

/** Alias for various buffer types. */
export type Bytes = Uint8Array|Buffer;

/** Output target, e.g. `process.stdout`. */
export type Write = { write (...data: unknown[]): unknown };

export const write = (output: Write, ...prefix: unknown[]) =>
  (...data: unknown[]) => output.write(...prefix, ...data);

export const parse = (b: Bytes, {
  u8   = (off = 0): number => b[off],
  buf = (n: number, off = 0): Uint8Array => b.subarray(off, off + n),
  str = (n: number, off = 0): string => UTF8.decode(buf(n, off)),

  view = () => new DataView(b.buffer),

  u16 = (off = 0): number => view().getUint16(off),
  u32 = (off = 0): number => view().getInt32(off),
  u64 = (off = 0): bigint => view().getBigInt64(off),

  i16 = (off = 0): number => view().getInt16(off),
  i32 = (off = 0): number => view().getUint32(off),
  i64 = (off = 0): bigint => view().getBigUint64(off),

} = {}) => ({ u8, u64, u32, u16, i64, i32, i16, buf, str });
