import { Name } from './function.ts';

/** False, zero, empty string, null, undefined, zip, nada, zilch. */
export type Falsy = 0 | '' | false | null | undefined;

/** Null or undefined. */
export type Nullish = null | undefined;

/** Soft optional. */
export type Maybe<T> = T|Falsy;

/** A binary flag helper. */
export type Flag = ReturnType<typeof flag>;

/** Specify a flag. */
export const flag = (name: string, bit: number) =>
  Name(`bit ${bit}: ${name}`, function testFlag (
    value: number|[number]|Uint8Array = null
  ) {
    if (value === null) return value;
    if (value[0]) value = value[0] as number;
    const mask = 1 << bit;
    const masked = Number(value) & mask;
    return masked !== 0;
  }, { bit, mask: 1 << bit });
