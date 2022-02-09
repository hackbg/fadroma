import { toBase64 } from '@fadroma/ops'

import { ScrtAgent } from './ScrtAgent'
import { ScrtBundle } from './ScrtBundle'
import type { ScrtAgentJS } from './ScrtAgentJS'

/** This agent just collects unsigned txs and dumps them in the end
  * to be performed by manual multisig (via Motika). */
export class ScrtAgentTX extends ScrtAgent {

  Bundle = ScrtBundle

  constructor (readonly agent: ScrtAgentJS) {
    super({
      name:    `${agent.name}+Generate`,
      address: agent.address,
      chain:   agent.chain,
    })
  }

  upload (...args) {
    throw new Error('ScrtAgentTX#upload: not implemented')
  }

  instantiate (...args) {
    console.info('init', ...args)
  }

  execute (contract, msg, ...args) {
    console.info(
      'execute',
      contract.name||contract.constructor.name,
      msg,
      args
    )
  }

  query (...args) {
    console.info('query', args[0].constructor.name, args[1])
    return super.query(...args)
  }

  get nextBlock () { return this.agent.nextBlock }
  async send () { throw new Error('not implemented') }
  async sendMany () { throw new Error('not implemented') }
  async encrypt (codeHash, msg) {
    if (!codeHash) throw new Error('@fadroma/scrt: missing codehash')
    const encrypted = await this.agent.api.restClient.enigmautils.encrypt(codeHash, msg)
    return toBase64(encrypted)
  }

  getLabel (...args)  { return this.agent.getLabel(...args) }
  getCodeId (...args) { return this.agent.getCodeId(...args) }

}
