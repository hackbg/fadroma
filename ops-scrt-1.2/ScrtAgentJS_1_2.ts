import { SigningCosmWasmClient } from 'secretjs'
import { ScrtAgentJS } from '@fadroma/scrt'

export class ScrtAgentJS_1_2 extends ScrtAgentJS {
  APIConstructor = SigningCosmWasmClient
}
