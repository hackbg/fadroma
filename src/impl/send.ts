import type { Agent } from '../API'

export async function send (agent: Agent, ...args: Parameters<Agent["send"]>) {

  const [outputs, options] = args

  for (const [recipient, amounts] of Object.entries(outputs)) {
    agent.log.debug(`Sending to ${bold(recipient)}:`)
    for (const [token, amount] of Object.entries(amounts)) {
      agent.log.debug(`  ${amount} ${token}`)
    }
  }

  return await timed(
    ()=>agent.getConnection().sendImpl({
      ...options||{},
      outputs
    }),
    ({elapsed})=>`Sent in ${bold(elapsed)}`
  )

}

