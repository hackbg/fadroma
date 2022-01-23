import { Scrt, ScrtCLIAgent, ScrtAgentJS } from '@fadroma/scrt'

import { URL } from 'url'

const {
  SCRT_API_URL,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC
} = process.env

import type { IChainConnectOptions } from '@fadroma/ops'
import Scrt_1_0 from '@fadroma/scrt-1.0'
import Scrt_1_2 from '@fadroma/scrt-1.2'
export const CHAINS: Record<string, (options: IChainConnectOptions)=>IChain> = {
  ...Scrt_1_0.Chains,
  ...Scrt_1_2.Chains
}
export { Scrt_1_0, Scrt_1_2 }

import type { IChain, IAgent } from '@fadroma/ops'
import { init as _init, MigrationOptions } from '@fadroma/ops'
export type Context = { chain: IChain, admin: IAgent }
export async function init (chainName: string, options?: MigrationOptions): Promise<Context> {
  return _init(CHAINS, chainName, options)
}

//import runCommands from '@hackbg/komandi'

//type Command  = fn(Migration)=>Promise<T>
//type Commands = Record<string, Command>

/*export class Fadroma {

  commands: Commands = {}

  command (name: string, command: Command) {
    commands[name] = () => this.run(command)
  }

  chains = {

    'mocknet': () => Mocknet,

    'scrt-localnet': () => new Scrt({
      isLocalnet:       true,
      node:             new Scrt_1_2.DockerizedScrtNode_1_2(options),
      chainId:         'scrt-localnet',
      apiURL:           new URL('http://localhost:1337'),
      Agent:            Scrt_1_2.ScrtAgentJS_1_2,
      defaultIdentity: 'ADMIN'
    }),

  }

  chainId = process.env.CHAIN_NAME || 'scrt-localnet'

  async run <T> (command: Command): Promise<T> {
    const { chain, admin } = await init(this.chains, this.chainId)
    return await migration({ chain, admin })
  }

  module (url: string): Commands {
    if (process.argv[1] === fileURLToPath(url)) {
      runCommands.default(
        this.commands,
        process.argv.slice(2)
      )
    }
    return commands
  }

 }*/

import { fileURLToPath } from 'url'
import runCommands from '@hackbg/komandi'
export class Fadroma {

  commands: Commands = {}

  command (name: string, command: Command) {
    this.commands[name] = () => this.run(command)
  }

  async run <T> (command: Command): Promise<T> {
    const { chain, admin } = await init(this.chains, this.chainId)
    return await command({ chain, admin })
  }

  module (url: string): Commands {
    if (process.argv[1] === fileURLToPath(url)) {
      runCommands.default(
        this.commands,
        process.argv.slice(2)
      )
    }
    return commands
  }

}

export default new Fadroma()
