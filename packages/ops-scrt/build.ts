import { resolve, relative, dirname } from 'path'
import { Dokeres } from '@hackbg/dokeres'
import { RawBuilder, DockerBuilder } from '@fadroma/ops'

import { scrtConfig as config } from './config'

export function getScrtBuilder ({
  raw        = config.buildRaw,
  managerURL = config.buildManager,
  caching    = !config.rebuild
}: {
  raw?:        boolean,
  managerURL?: string,
  caching?:    boolean
} = {}) {
  if (raw) {
    return new RawBuilder(
      resolve(dirname(config.scrt.buildScript), 'Scrt_1_2_BuildCommand.sh'),
      resolve(dirname(config.scrt.buildScript), 'Scrt_1_2_BuildCheckout.sh')
    )
  } else if (managerURL) {
    throw new Error('unimplemented: managed builder will be available in a future version of Fadroma')
    //return new ManagedBuilder({ managerURL })
  } else {
    return new ScrtDockerBuilder({ caching })
  }
}

export class ScrtDockerBuilder extends DockerBuilder {

  constructor ({ caching }) {
    const script     = config.scrt.buildScript
    const extraFiles = [config.scrt.buildScript, config.scrt.buildServer]
    const image = new Dokeres().image(
      config.scrt.buildImage,
      config.scrt.buildDockerfile,
      extraFiles.map(x=>relative(dirname(config.scrt.buildDockerfile), x))
    )
    super({ caching, script, image })
  }

}
