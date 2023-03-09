import { BuilderConfig } from '@fadroma/build'
import { DeployConfig } from '@fadroma/deploy'

/** Configuration for the Fadroma environment. */
export default class Config extends DeployConfig {
  build = new BuilderConfig({ project: this.project }, this.env, this.cwd)
}
