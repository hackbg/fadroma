import type { Agent, Address, CodeHash } from '../API'
import { bold } from '../util'

export async function execute (agent: Agent, ...args: Parameters<Agent["execute"]>) {

  let [contract, message, options] = args

  if (typeof contract === 'string') {
    contract = new Contract({ address: contract })
  }

  if (!contract.address) {
    throw new Error("agent.execute: no contract address")
  }

  const { address } = contract

  let method = (typeof message === 'string') ? message : Object.keys(message||{})[0]

  return timed(function doExecute () {
    return agent.getConnection().executeImpl({
      ...contract as { address: Address, codeHash: CodeHash },
      message,
      ...options
    })
  }, function afterExecute ({ elapsed }) {
    agent.log.debug(
      `Executed in ${bold(elapsed)}:`,
      `tx ${bold(method||'(???)')} of ${bold(address)}`
    )
  })

}
