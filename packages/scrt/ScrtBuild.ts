import {
  config, resolve, relative, dirname,
  RawBuilder,
  DockerodeBuilder, DockerImage
} from '@fadroma/ops'

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

  buildEntryPoint = relative(
    dirname(config.scrt.buildDockerfile),
    config.scrt.buildScript
  )

  image = new DockerImage(
    undefined,
    config.scrt.buildImage,
    config.scrt.buildDockerfile,
    [this.buildEntryPoint]
  )

  constructor ({ caching }) {
    super({
      script: config.scrt.buildScript,
      caching
    })
  }
}
