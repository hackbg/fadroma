import { ConnectError } from '@fadroma/connect'

export default class DeployError extends ConnectError {

  static DeploymentAlreadyExists = this.define(
    'DeploymentAlreadyExists',
    (name: string)=>`Deployment "${name}" already exists`
  )

  static DeploymentDoesNotExist = this.define(
    'DeploymentDoesNotExist',
    (name: string)=>`Deployment "${name}" does not exist`
  )

}
