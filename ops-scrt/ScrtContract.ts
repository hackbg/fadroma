import type { Ensemble, EnsembleOptions, Chain } from '@fadroma/ops'
import { BaseEnsemble } from '@fadroma/ops'
import { Scrt, on } from './ScrtChainAPI'

type EnsembleConstructor = new (args: EnsembleOptions) => Ensemble

export class ScrtEnsemble extends BaseEnsemble {
  /* Plugs into the CLI command parser to select the chain
   * onto which an ensemble is deployed */
  static chainSelector (E: EnsembleConstructor) {
    // TODO make this independent of Ensemble - or better yet, move it into Ensemble
    return [
      ["mainnet",     "Run on mainnet",
        on['mainnet'],      new E({chain: Scrt.mainnet()      as Chain}).remoteCommands()],
      ["holodeck-2",  "Run on holodeck2",
        on['holodeck-2'],   new E({chain: Scrt.holodeck_2()   as Chain}).remoteCommands()],
      ["supernova-1", "Run on supernova1",
        on['supernova-1'],  new E({chain: Scrt.supernova_1()  as Chain}).remoteCommands()],
      ["localnet",    "Run on localnet v1.0",
        on['localnet-1.0'], new E({chain: Scrt.localnet_1_0() as Chain}).remoteCommands()],
      ["localnet",    "Run on localnet v1.2",
        on['localnet-1.2'], new E({chain: Scrt.localnet_1_2() as Chain}).remoteCommands()] ] } }

//export class ScrtBuilder extends Builder {
  //buildImage = 'enigmampc/secret-contract-optimizer:latest'
//}
