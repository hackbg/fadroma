import { Error } from '@hackbg/oops'
import { ClientConsole as Console } from '@fadroma/core'

export class DevnetError extends Error {

  static PortMode = this.define('PortMode',
    ()=>"DockerDevnet#portMode must be either 'lcp' or 'grpcWeb'")

  static NoChainId = this.define('NoChainId',
    ()=>'refusing to create directories for devnet with empty chain id')

  static NoContainerId = this.define('NoContainerId',
    ()=>'Missing container id in devnet state')

  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>
      `Genesis account not found: ${name} (${error})`)

}

export class DevnetConsole extends Console {

  loadingState = (chainId1: string, chainId2: string) =>
    this.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`)

  loadingFailed = (path: string) =>
    this.warn(`Failed to load devnet state from ${path}. Deleting it.`)

  loadingRejected = (path: string) =>
    this.info(`${path} does not exist.`)

}
