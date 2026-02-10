import { CosmWasm, Tendermint } from '../deps.ts'
/** Client to an individual SNIP-721 non-fungible token contract. */
export type Snip721 = CosmWasm.Contract & Tendermint.NonFungible
