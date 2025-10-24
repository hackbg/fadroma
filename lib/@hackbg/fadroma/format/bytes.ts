import type { Buffer } from '../deps.ts';
import { UTF8 } from './string.ts';

/** Alias for various buffer types. */
export type Bytes = Uint8Array|Buffer;

/** Output target, e.g. `process.stdout`. */
export type Write = { write (...data: unknown[]): unknown };

export const write = (output: Write, ...prefix: unknown[]) =>
  (...data: unknown[]) => output.write(...prefix, ...data);

export const parse = (b: Bytes, {
  buf = (n: number, off = 0): Uint8Array => b.subarray(off, off + n),
  str = (n: number, off = 0): string => UTF8.decode(buf(n, off)),

  view = () => new DataView(b.buffer),

  u8  = (off = 0): number => b[off],
  u16 = (off = 0): number => view().getUint16(off),
  u32 = (off = 0): number => view().getInt32(off),
  u64 = (off = 0): bigint => view().getBigInt64(off),

  i16 = (off = 0): number => view().getInt16(off),
  i32 = (off = 0): number => view().getUint32(off),
  i64 = (off = 0): bigint => view().getBigUint64(off),

} = {}) => ({ u8, u64, u32, u16, i64, i32, i16, buf, str });

export function writeAdvance (bytes: Bytes, {
  cursor = 0,
  done = () => (cursor === bytes.length) ? bytes : bytes.subarray(0, cursor),
  u8  = (value: number) => { bytes[cursor++] = value & 0xFF },
  u16 = (value: number) => { new DataView(bytes.buffer).setUint16(cursor, value);    cursor += 2; },
  u32 = (value: number) => { new DataView(bytes.buffer).setUint32(cursor, value);    cursor += 4; },
  u64 = (value: bigint) => { new DataView(bytes.buffer).setBigUint64(cursor, value); cursor += 8; },
  i16 = (value: number) => { new DataView(bytes.buffer).setInt16(cursor, value);     cursor += 2; },
  i32 = (value: number) => { new DataView(bytes.buffer).setInt32(cursor, value);     cursor += 4; },
  i64 = (value: bigint) => { new DataView(bytes.buffer).setBigInt64(cursor, value);  cursor += 8; },
  str = (value: string) => { if (!value) return; cursor += UTF8.encodeInto(value, bytes, cursor); },
  buf = (value: Uint8Array) => { bytes.set(value, cursor); cursor += value.length; },
} = {}) {
  return {
    get cursor () { return cursor }, set cursor (x: number) { cursor = x },
    done, u8, u16, u32, u64, i16, i32, i64, str, buf,
  }
}
