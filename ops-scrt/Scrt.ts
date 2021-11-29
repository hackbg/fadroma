import {
  Identity, DefaultIdentity, IAgent, Fees,
  IChain, IChainNode, IChainState, IChainConnectOptions,
  BaseChain, ChainInstancesDir, prefund,
  Ensemble, EnsembleOptions,
  BaseEnsemble,
  ContractAPI,
  DockerizedChainNode, ChainNodeOptions,
  BaseGas
} from '@fadroma/ops'

import { ScrtAgentJS_1_0 } from '@fadroma/scrt-1.0'
import { ScrtAgentJS_1_2 } from '@fadroma/scrt-1.2'
import { ScrtCLIAgent } from './ScrtAgentCLI'

import {
  open, defaultStateBase, resolve, table, noBorders,
  Commands, Console, bold, Path, Directory, TextFile,
  JSONFile, JSONDirectory, dirname, fileURLToPath
} from '@fadroma/tools'

import { URL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const console = Console('@fadroma/ops-scrt/ScrtAgentJS')

export class ScrtContract extends ContractAPI {
  buildImage  = 'enigmampc/secret-contract-optimizer:latest'
  buildScript = resolve(__dirname, 'ScrtBuild.sh')
}

type EnsembleConstructor = new (args: EnsembleOptions) => Ensemble

export class ScrtEnsemble extends BaseEnsemble {
  /* Plugs into the CLI command parser to select the chain
   * onto which an ensemble is deployed */
  static chainSelector (E: EnsembleConstructor) {
    // TODO make this independent of Ensemble - or better yet, move it into Ensemble
    return [
      [ "secret_2",    "Run on secret_2",      on['secret_2']
      , new E({chain: Scrt.secret_2()}).remoteCommands() ],

      [ "secret_3",    "Run on secret_3",      on['secret_3']
      , new E({chain: Scrt.secret_3()}).remoteCommands()],

      ["holodeck-2",   "Run on holodeck2",     on['holodeck-2']
      , new E({chain: Scrt.holodeck_2()}).remoteCommands()],

      ["supernova-1",  "Run on supernova1",    on['supernova-1']
      , new E({chain: Scrt.supernova_1()}).remoteCommands()],

      ["localnet-1.0", "Run on localnet v1.0", on['localnet-1.0']
      , new E({chain: Scrt.localnet_1_0()}).remoteCommands()],

      ["localnet-1.2", "Run on localnet v1.2", on['localnet-1.2']
      , new E({chain: Scrt.localnet_1_2()}).remoteCommands()]
    ]
  }
}

export class ScrtGas extends BaseGas {
  static denom = 'uscrt'
  denom = ScrtGas.denom
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: this.denom})
  }
}

export const defaultFees: Fees = {
  upload: new ScrtGas(3000000),
  init:   new ScrtGas(1000000),
  exec:   new ScrtGas(1000000),
  send:   new ScrtGas( 500000),
}

export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url)
}
