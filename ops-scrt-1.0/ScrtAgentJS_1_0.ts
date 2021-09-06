import { SigningCosmWasmClient } from 'secretjs'
import { ScrtAgentJS } from '@fadroma/scrt'

export class ScrtAgentJS_1_0 extends ScrtAgentJS {
  APIConstructor = SigningCosmWasmClient
}
