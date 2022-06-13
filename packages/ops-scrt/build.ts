import { relative, dirname } from 'path'
import { Dokeres } from '@hackbg/dokeres'
import { DockerBuilder } from '@fadroma/ops'

export function getScrtBuilder ({
  raw,
  managerUrl,
  caching = true,
}: {
  raw?:        boolean
  managerUrl?: string|URL
  caching?:    boolean
}) {
  if (raw) {
    throw 'TODO'
  } else if (managerUrl) {
    throw new Error('unimplemented: managed builder will be available in a future version of Fadroma')
    //return new ManagedBuilder({ managerURL })
  } else {
    return new ScrtDockerBuilder({ caching })
  }
}

export class ScrtDockerBuilder extends DockerBuilder {

  constructor ({ caching }) {
    const script     = config.buildScript
    const extraFiles = [config.buildScript, config.buildServer]
    const image = new Dokeres().image(
      config.buildImage,
      config.buildDockerfile,
      extraFiles.map(x=>relative(dirname(config.buildDockerfile), x))
    )
    super({ caching, script, image })
  }

}
