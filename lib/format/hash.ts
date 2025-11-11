/** Names of known hash types. */
export type HashAlgo = 'sha256';

/** Hash. */
export type Hash<A extends HashAlgo> = string|Uint8Array & { __hash: A };

/** Hashed item. */
export type Hashed<A extends HashAlgo> = { /** The hash. */ hash: Hash<A> };

