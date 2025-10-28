export { Console bold } from '@hackbg/fadroma';
export { Case, base16, base64 } from '@hackbg/fadroma';
export type { Uint128, Address, Hash, ChainId } from '@hackbg/fadroma';
import { Borsh } from '@hackbg/fadroma';
export const { decode, u64, u256 } = Borsh
export * as Tendermint from '@fadroma/tm';
export class BaseConsole { /*FIXME*/ };
export class BaseError extends Error {};
