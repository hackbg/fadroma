import { Bundle, ContractInstance, ClientConsole } from '@fadroma/core'
import type { MocknetAgent } from './mocknet-agent'

export class MocknetBundle extends Bundle {

  declare agent: MocknetAgent

  log = new ClientConsole('Fadroma Mocknet')

  async submit (memo = "") {
    this.log.info('Submitting mocknet bundle...')
    const results = []
    for (const { init, exec } of this.msgs) {
      if (!!init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate(new ContractInstance({
          codeId: String(codeId), initMsg: msg, codeHash, label,
        })))
      } else if (!!exec) {
        const { sender, contract: address, codeHash, msg, funds: send } = exec
        results.push(await this.agent.execute({ address, codeHash }, msg, { send }))
      } else {
        this.log.warn('MocknetBundle#submit: found unknown message in bundle, ignoring')
        results.push(null)
      }
    }
    return results
  }

  save (name: string): Promise<unknown> {
    throw new Error('MocknetBundle#save: not implemented')
  }

}
