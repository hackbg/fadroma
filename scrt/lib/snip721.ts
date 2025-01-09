import { CosmWasm, Token } from '../deps.ts'
/** Client to an individual SNIP-721 non-fungible token contract. */
export type Snip721 = CosmWasm.Contract & Token.NonFungible
