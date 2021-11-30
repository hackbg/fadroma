import type { Agent, Ensemble, EnsembleOptions, Chain } from '@fadroma/ops'
import { BaseEnsemble, ContractAPI } from '@fadroma/ops'
import { resolve, dirname, fileURLToPath } from '@fadroma/tools'
import { Scrt, on } from './ScrtChainAPI'

type EnsembleConstructor = new (args: EnsembleOptions) => Ensemble

export class ScrtEnsemble extends BaseEnsemble {
  /* Plugs into the CLI command parser to select the chain
   * onto which an ensemble is deployed */
  static chainSelector (E: EnsembleConstructor) {
    // TODO make this independent of Ensemble - or better yet, move it into Ensemble
    return [
      ["secret_2",     "Run on secret_2",
        on['secret_2'],     new E({chain: Scrt.secret_2()      as Chain}).remoteCommands()],
      ["secret_3",     "Run on secret_3",
        on['secret_3'],     new E({chain: Scrt.secret_3()      as Chain}).remoteCommands()],
      ["holodeck-2",   "Run on holodeck2",
        on['holodeck-2'],   new E({chain: Scrt.holodeck_2()   as Chain}).remoteCommands()],
      ["supernova-1",  "Run on supernova1",
        on['supernova-1'],  new E({chain: Scrt.supernova_1()  as Chain}).remoteCommands()],
      ["pulsar-1",  "Run on pulsar1",
        on['pulsar-1'],  new E({chain: Scrt.pulsar_1()  as Chain}).remoteCommands()],
      ["localnet-1.0", "Run on localnet v1.0",
        on['localnet-1.0'], new E({chain: Scrt.localnet_1_0() as Chain}).remoteCommands()],
      ["localnet-1.2", "Run on localnet v1.2",
        on['localnet-1.2'], new E({chain: Scrt.localnet_1_2() as Chain}).remoteCommands()] ] } }

const __dirname = dirname(fileURLToPath(import.meta.url))

export class ScrtContract extends ContractAPI {
  buildImage  = 'enigmampc/secret-contract-optimizer:1.0.5'
  buildScript = resolve(__dirname, 'ScrtBuild.sh') }
