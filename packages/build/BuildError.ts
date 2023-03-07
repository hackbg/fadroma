import { ClientError } from '@fadroma/core'

export default class DeployError extends ClientError {

  static DeploymentAlreadyExists = this.define(
    'DeploymentAlreadyExists',
    (name: string)=>`Deployment "${name}" already exists`
  )

  static DeploymentDoesNotExist = this.define(
    'DeploymentDoesNotExist',
    (name: string)=>`Deployment "${name}" does not exist`
  )

}

