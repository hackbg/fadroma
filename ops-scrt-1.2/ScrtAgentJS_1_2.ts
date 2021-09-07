import { SigningCosmWasmClient } from 'secretjs'
import { ScrtAgentJS, Identity } from '@fadroma/scrt'

export class ScrtAgentJS_1_2 extends ScrtAgentJS {
  static create = (options: Identity) => ScrtAgentJS.createSub(ScrtAgentJS_1_2, options)
  constructor (options: Identity) { super(SigningCosmWasmClient, options) }
}
