import { BuilderConfig, DeployConfig } from '@fadroma/ops'

/** Configuration for the Fadroma environment. */
export default class Config extends DeployConfig {

  build = new BuilderConfig({ project: this.project })

}
