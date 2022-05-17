import { resolve, relative, dirname } from 'path'
import { Dokeres } from '@hackbg/dokeres'
import { RawBuilder, DockerodeBuilder } from '@fadroma/ops'

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
    return new ScrtDockerodeBuilder({ caching })
  }
}

export class ScrtDockerodeBuilder extends DockerodeBuilder {

  constructor ({ caching }) {
    const script = config.scrt.buildScript
    const image = new Dokeres().image(
      config.scrt.buildImage,
      config.scrt.buildDockerfile,
      [relative(
        dirname(config.scrt.buildDockerfile),
        config.scrt.buildScript
      )]
    )
    super({ caching, script, image })
  }

}
