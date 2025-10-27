import type { Buffer } from '../deps.ts';
import { UTF8 } from './string.ts';
/** Alias for various buffer types. */
export type Bytes = Uint8Array|Buffer;
/** Concatenate byte arrays. */
export function concatBytes (chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((l, c)=>l+(c?.length??0), 0);
  const output = new Uint8Array(length || 0);
  let cursor = 0;
  for (const chunk of chunks) {
    console.log({chunk});
    if (!chunk) continue;
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output
}
/** Read values from offsets in a buffer. */
export const parse = (b: Bytes, {
  view = () => new DataView(b.buffer),
  buf = (n: number, off = 0): Uint8Array => b.subarray(off, off + n),
  str = (n: number, off = 0): string => UTF8.decode(buf(n, off)),
  u8  = (off = 0): number => b[off],
  u16 = (off = 0): number => view().getUint16(off),
  u32 = (off = 0): number => view().getInt32(off),
  u64 = (off = 0): bigint => view().getBigInt64(off),
  i16 = (off = 0): number => view().getInt16(off),
  i32 = (off = 0): number => view().getUint32(off),
  i64 = (off = 0): bigint => view().getBigUint64(off),
} = {}) => ({ u8, u64, u32, u16, i64, i32, i16, buf, str });
/** Concatenate values of various types into a buffer. */
export function writeAdvance (bytes: Bytes, {
  cursor = 0,
  done = () => (cursor === bytes.length) ? bytes : bytes.subarray(0, cursor),
  buf = (value: Uint8Array) => { bytes.set(value, cursor); cursor += value.length; },
  str = (value: string) => { if (!value) return; cursor += UTF8.encodeInto(value, bytes, cursor); },
  u8  = (value: number) => { bytes[cursor++] = value & 0xFF },
  u16 = (value: number) => { new DataView(bytes.buffer).setUint16(cursor, value);    cursor += 2; },
  u32 = (value: number) => { new DataView(bytes.buffer).setUint32(cursor, value);    cursor += 4; },
  u64 = (value: bigint) => { new DataView(bytes.buffer).setBigUint64(cursor, value); cursor += 8; },
  i16 = (value: number) => { new DataView(bytes.buffer).setInt16(cursor, value);     cursor += 2; },
  i32 = (value: number) => { new DataView(bytes.buffer).setInt32(cursor, value);     cursor += 4; },
  i64 = (value: bigint) => { new DataView(bytes.buffer).setBigInt64(cursor, value);  cursor += 8; },
} = {}) {
  return {
    get cursor () { return cursor }, set cursor (x: number) { cursor = x },
    done, u8, u16, u32, u64, i16, i32, i64, str, buf,
  }
}
export const toU8A = x => (x instanceof Uint8Array) ? x : new Uint8Array(x);
