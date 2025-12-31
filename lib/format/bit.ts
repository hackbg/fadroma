import Fn from './function.ts';
/** Null, undefined, or false. */
export type Nil = null | undefined | false;
/** Soft optional. */
export type Maybe<T> = T|Nil;
/** A binary flag helper. */
export type Bit = ((_?: number|[number]|Uint8Array) => boolean) & {
  bit:  number,
  mask: number,
};
/** Specify a flag. */
export const Bit = (name: string, bit: number): Bit =>
  Fn.Name(`bit ${bit}: ${name}`, function testFlag (
    value: number|[number]|Uint8Array = null
  ): boolean {
    if (value === null) return value as null;
    if (value[0]) value = value[0] as number;
    const mask = 1 << bit;
    const masked = Number(value) & mask;
    return masked !== 0;
  } as Bit, { bit, mask: 1 << bit });
