import { toBase64 } from '@fadroma/ops'

import { ScrtAgent } from './ScrtAgent'
import { MultisigScrtBundle } from './ScrtBundle'
import type { ScrtAgentJS } from './ScrtAgentJS'

/** This agent just collects unsigned txs and dumps them in the end
  * to be performed by manual multisig (via Motika). */
export class ScrtAgentTX extends ScrtAgent {

  Bundle = MultisigScrtBundle

  signTx (msgs, gas, memo?): Promise<any> {
    throw new Error('not implemented')
  }

  constructor (readonly agent: ScrtAgentJS) {
    super({
      name:    `${agent.name}+Generate`,
      address: agent.address,
      chain:   agent.chain,
    })
  }

  upload (...args): Promise<any> {
    throw new Error('ScrtAgentTX#upload: not implemented')
  }

  instantiate (...args): Promise<any> {
    console.info('init', ...args)
    return
  }

  execute (contract, msg, ...args): Promise<any> {
    console.info(
      'execute',
      contract.name||contract.constructor.name,
      msg,
      args
    )
    return
  }

  query (
    contract: { address: string, label: string }, msg: any
  ) {
    console.info('query', contract.label, msg)
    return super.query(contract, msg)
  }

  get nextBlock () { return this.agent.nextBlock }

  async send () { throw new Error('not implemented') }

  async sendMany () { throw new Error('not implemented') }

  async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error('@fadroma/scrt: missing codehash')
    const encrypted = await this.agent.api.restClient.enigmautils.encrypt(codeHash, msg)
    return toBase64(encrypted)
  }

  getLabel (address) {
    return this.agent.getLabel(address)
  }

  getCodeId (address) {
    return this.agent.getCodeId(address)
  }

  getCodeHash (idOrAddr) {
    return this.agent.getCodeHash(idOrAddr)
  }

}
