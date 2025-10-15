import { TryToParse } from '../types.ts';

export const tryToParse = <T, U>(src: T): TryToParse<T, U> => {
  try {
    const json = JSON.parse(src as string)
    return [src, json, undefined]
  } catch (e) {
    return [src, undefined, e]
  }
};
