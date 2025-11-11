import { Name } from './function.ts';
/** False, zero, empty string, null, undefined, zip, nada, zilch. */
export type Falsy = 0 | '' | false | null | undefined;
/** Null or undefined. */
export type Nullish = null | undefined;
/** Soft optional. */
export type Maybe<T> = T|Falsy;
/** A binary flag helper. */
export type Flag = ((_?: number|[number]|Uint8Array) => boolean) & {
  bit:  number,
  mask: number,
};
/** Specify a flag. */
export const Flag = (name: string, bit: number): Flag =>
  Name(`bit ${bit}: ${name}`, function testFlag (
    value: number|[number]|Uint8Array = null
  ): boolean {
    if (value === null) return value as null;
    if (value[0]) value = value[0] as number;
    const mask = 1 << bit;
    const masked = Number(value) & mask;
    return masked !== 0;
  } as Flag, { bit, mask: 1 << bit });
