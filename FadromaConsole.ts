import { DeployConsole } from '@fadroma/deploy'

export default class Console extends DeployConsole {
  constructor (name = 'Fadroma') {
    super(name)
  }
}
