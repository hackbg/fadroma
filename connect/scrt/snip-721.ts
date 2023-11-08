import { ContractClient, Token } from '@fadroma/agent'

/** Client to a specific SNIP-721 non-fungible token contract. */
export class Snip721 extends ContractClient implements Token.NonFungible {
  get id () { return this.contract.address! }
  isFungible = () => false
}
