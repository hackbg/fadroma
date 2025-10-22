/** Output target, e.g. `process.stdout`. */
export type Write = { write (...data: unknown[]): unknown };

export const write = (output: Write, ...prefix: unknown[]) =>
  (...data: unknown[]) => output.write(...prefix, ...data);

/** TODO: Alias for various buffer types. */
export type Bytes = Uint8Array;

/** A parse that may fail but the source and error must still be preserved. */
export type TryToParse<T, U> =
  | [T, U,         undefined]
  | [T, undefined, unknown];

/** Show a stringified object. */
export const tryToParse = <T, U>(src: T): TryToParse<T, U> => {
  try {
    const json = JSON.parse(src as string)
    return [src, json, undefined]
  } catch (e) {
    return [src, undefined, e]
  }
};
