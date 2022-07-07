import { fileURLToPath } from 'url'
import {
  Chain,
  ChainMode,
  ChainOps,
  DeployOps,
  Mocknet,
  Operation,
  Source,
  Template,
  UploadOps,
  runOperation,
  populateBuildContext
} from '@fadroma/ops'
import { runCommands } from '@hackbg/komandi'
import { Console, bold } from '@hackbg/konzola'
import { ScrtChain } from '@fadroma/client-scrt'
import { LegacyScrt } from '@fadroma/client-scrt-amino'
import { Scrt } from '@fadroma/client-scrt-grpc'
import { getScrtBuilder, getScrtDevnet } from '@fadroma/ops-scrt'
import currentConfig from './config'

const console = Console('Fadroma Ops')

type WrappedCommand<T> = (args: string[])=>Promise<T>
type Commands = Record<string, WrappedCommand<any>|Record<string, WrappedCommand<any>>>

interface EnableScrtBuilder {
  config: {
    build: {
      rebuild: boolean
    }
    scrt: {
      build: object
    }
  }
}

export class FadromaOps {

  static Build = {
    /** Add a Secret Network builder to the command context. */
    Scrt: function enableScrtBuilder ({ config }: EnableScrtBuilder) {
      const builder = getScrtBuilder({caching: !config.build.rebuild, ...config.scrt.build})
      return populateBuildContext(builder)
    }
  }
  static Chain  = ChainOps
  static Upload = UploadOps
  static Deploy = DeployOps

  // metastatic!
  Build  = FadromaOps.Build
  Chain  = FadromaOps.Chain
  Upload = FadromaOps.Upload
  Deploy = FadromaOps.Deploy

  /** Collection of registered commands. */
  commands: Commands = {}

  /** Register a command. */
  command (name: string, ...steps: Operation<any>[]) {
    // To each command, prepend a step that populates the global config.
    steps.unshift(async function loadConfiguration () {
      return { config: currentConfig, Chains }
    })

    const fragments = name.trim().split(' ')
    let commands: any = this.commands
    for (let i = 0; i < fragments.length; i++) {
      commands[fragments[i]] = commands[fragments[i]] || {}
      if (i === fragments.length-1) {
        commands[fragments[i]] = (...cmdArgs: string[]) => runOperation(name, steps, cmdArgs)
      } else {
        commands = commands[fragments[i]]
      }
    }
  }

  /** Run a command. */
  async run (...commands: string[]) {
    Error.stackTraceLimit = Math.max(1000, Error.stackTraceLimit)
    return await runCommands(this.commands, commands)
  }

  /** Call this method with `import.meta.url` at the end of a module that contains commands.
    * If that module is the execution, entrypoint, runs a command from the command line.
    * TODO get rid of this and just use "fadroma run" + default exports */
  module (url: string): this {
    // if main
    if (process.argv[1] === fileURLToPath(url)) {
      this.run(...process.argv.slice(2)).then(()=>{
        console.info('All done.')
        process.exit(0)
      })
    }
    return this
  }

}

export default new FadromaOps()

export { LegacyScrt, Scrt }

// Reexport the full vocabulary
export * from '@fadroma/client'
export * from '@fadroma/client-scrt-amino'
export * from '@fadroma/client-scrt-grpc'
export * from '@fadroma/ops'
export * from '@fadroma/ops-scrt'
export * from '@fadroma/tokens'
export * from '@hackbg/konzola'

/** Collection of supported chain backends.
  * Correspond to values supported by `FADROMA_CHAIN`. */
export const Chains = {
  async 'Mocknet'           (config = currentConfig) {
    return new Mocknet()
  },
  async 'LegacyScrtMainnet' (config = currentConfig) {
    return new LegacyScrt(config.scrt.mainnet.chainId, {
      url:  config.scrt.mainnet.apiUrl,
      mode: ChainMode.Mainnet
    })
  },
  async 'LegacyScrtTestnet' (config = currentConfig) {
    return new LegacyScrt(config.scrt.testnet.chainId, {
      url:  config.scrt.testnet.apiUrl,
      mode: ChainMode.Testnet
    })
  },
  async 'LegacyScrtDevnet'  (config = currentConfig) {
    const node = await getScrtDevnet('1.2').respawn()
    return new LegacyScrt(node.chainId, {
      url:  node.url.toString(),
      mode: ChainMode.Devnet,
      node
    })
  },
  async 'ScrtMainnet'       (config = currentConfig) {
    return new Scrt(config.scrt.mainnet.chainId, {
      url:  config.scrt.mainnet.apiUrl,
      mode: ChainMode.Mainnet
    })
  },
  async 'ScrtTestnet'       (config = currentConfig) {
    return new Scrt(config.scrt.testnet.chainId, {
      url:  config.scrt.testnet.apiUrl,
      mode: ChainMode.Testnet
    })
  },
  async 'ScrtDevnet'        (config = currentConfig) {
    const node = await getScrtDevnet('1.3').respawn()
    return new Scrt(node.chainId, {
      url:  node.url.toString(),
      mode: ChainMode.Devnet,
      node
    })
  },
}
