import { Chain, Token } from '@fadroma/agent'

/** Client to a specific SNIP-721 non-fungible token contract. */
export class Snip721 extends Chain.Contract implements Token.NonFungible {

  isFungible = () => false

  get id () {
    return this.instance!.address!
  }

}
