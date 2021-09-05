import { SigningCosmWasmClient } from 'secretjs'
import { ScrtJSAgent } from '@fadroma/scrt'

export class ScrtJSAgent_1_2 extends ScrtJSAgent {
  APIConstructor = SigningCosmWasmClient
}
