import {
  Console, colors, bold,
  Identity, Agent, AgentConstructor
} from '@fadroma/ops'
import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen } from 'secretjs'
import type { ScrtBundle } from './ScrtBundle'

const console = Console('@fadroma/scrt/ScrtAgent')

export abstract class ScrtAgent extends Agent {

  abstract Bundle: ScrtBundle

  /** Get the code hash for a code id or address */
  abstract getCodeHash (idOrAddr: number|string): Promise<string>

  abstract signTx (msgs, gas, memo?): Promise<any>

  /** Create a new v1.0 or v1.2 agent with its signing pen,
    * from a mnemonic or a keyPair.*/
  static async createSub (
    AgentClass: AgentConstructor,
    options:    Identity
  ): Promise<Agent> {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    let info = ''
    if (mnemonic) {
      info = bold(`Creating SecretJS agent from mnemonic:`) + ` ${name} `
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`ScrtAgentJS: Keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      info = `ScrtAgentJS: generating mnemonic from keypair for agent ${bold(name)}`
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    } else {
      info = `ScrtAgentJS: creating new SecretJS agent: ${bold(name)}`
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }
    const pen  = await Secp256k1Pen.fromMnemonic(mnemonic)
    const agent = new AgentClass({name, mnemonic, keyPair, pen, ...args})
    return agent
  }

}
