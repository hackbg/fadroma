export type {
  Hash, Uint128, ToApi, //TryToParse,
} from '@hackbg/fadroma';

export {
  timed, optionallyParallel, camelize, randomId, //tryToParse
} from '@hackbg/fadroma';

export type {
  Address,
  Height,
  Api         as BaseApi,
  Batch       as BaseBatch,
  Block       as BaseBlock,
  Chain       as BaseChain,
  ChainId     as BaseChainId,
  Connection  as BaseConnection,
  Transaction as BaseTransaction,
  Context     as ChainContext,
} from '@fadroma/chain';

export { chain as baseChain, } from '@fadroma/chain';

export { Case, base16, base64, } from '@hackbg/4mat';

export { uint32 } from 'protobuf-varint';

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
