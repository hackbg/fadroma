export * from './format/bits.ts';
export * from './format/bytes.ts';
export * from './format/color.ts';
export * from './format/error.ts';
export * from './format/hash.ts';
export * from './format/number.ts';
export * from './format/string.ts';
/** False, zero, empty string, null, undefined, zip, nada, zilch. */
export type Falsy = 0 | '' | false | null | undefined;
/** Soft optional. */
export type Maybe<T> = T|Falsy;
/** Human-readable info interface. */
export type Info = { summary (): string, details (): string };
