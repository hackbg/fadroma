import { Error } from '@hackbg/oops'

export default class DevnetError extends Error {

  static PortMode = this.define('PortMode',
    ()=>"DockerDevnet#portMode must be either 'lcp' or 'grpcWeb'")

  static NoChainId = this.define('NoChainId',
    ()=>'Refusing to create directories for devnet with empty chain id')

  static NoContainerId = this.define('NoContainerId',
    ()=>'Missing container id in devnet state')

  static ContainerNotSet = this.define('ContainerNotSet',
    ()=>'DockerDevnet#container is not set')

  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>
      `Genesis account not found: ${name} (${error})`)

}
