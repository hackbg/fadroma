import { Error as BaseError } from '@fadroma/agent'

export default class OpsError extends BaseError {
  static Build:  typeof BuildError
  static Upload: typeof UploadError
  static Deploy: typeof DeployError
  static Devnet: typeof DevnetError
}

export class BuildError extends OpsError {
}

export class UploadError extends OpsError {
}

export class DeployError extends OpsError {
  static DeploymentAlreadyExists = this.define('DeploymentAlreadyExists',
    (name: string)=>`Deployment "${name}" already exists`
  )
  static DeploymentDoesNotExist = this.define('DeploymentDoesNotExist',
    (name: string)=>`Deployment "${name}" does not exist`
  )
}

export class DevnetError extends OpsError {
  static PortMode = this.define('PortMode',
    ()=>"DevnetContainer#portMode must be either 'lcp' or 'grpcWeb'")
  static NoChainId = this.define('NoChainId',
    ()=>'Refusing to create directories for devnet with empty chain id')
  static NoContainerId = this.define('NoContainerId',
    ()=>'Missing container id in devnet state')
  static ContainerNotSet = this.define('ContainerNotSet',
    ()=>'DevnetContainer#container is not set')
  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>
      `Genesis account not found: ${name} (${error})`)
}

Object.assign(OpsError, {
  Build:  BuildError,
  Upload: UploadError,
  Deploy: DeployError,
  Devnet: DevnetError
})
