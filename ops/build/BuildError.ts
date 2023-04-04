import { Error } from '@fadroma/agent'

export default class DeployError extends Error {

  static DeploymentAlreadyExists = this.define(
    'DeploymentAlreadyExists',
    (name: string)=>`Deployment "${name}" already exists`
  )

  static DeploymentDoesNotExist = this.define(
    'DeploymentDoesNotExist',
    (name: string)=>`Deployment "${name}" does not exist`
  )

}

