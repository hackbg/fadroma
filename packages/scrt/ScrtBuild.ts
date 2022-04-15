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
    return new DockerodeBuilder_Scrt_1_2({ caching })
  }
}

export class DockerodeBuilder_Scrt_1_2 extends DockerodeBuilder {

  //buildManager = "Scrt_1_2_Build.js"

  buildEntryPoint = relative(
    dirname(config.scrt.buildDockerfile),
    config.scrt.buildScript
  )

  buildHelpers = [ "Scrt_1_2_BuildCheckout.sh", "Scrt_1_2_BuildCommand.sh" ]

  image = new DockerImage(
    undefined,
    config.scrt.buildImage,
    config.scrt.buildDockerfile,
    [
      this.buildEntryPoint,
      //this.buildManager,
      ...this.buildHelpers
    ]
  )

  constructor ({ caching }) {
    super({
      script: config.scrt.buildScript,
      caching
    })
  }

  protected getBuildContainerArgs (source, output): [string, any] {
    const [cmd, args] = super.getBuildContainerArgs(source, output)
    for (const helper of this.buildHelpers) {
      args.HostConfig.Binds.push(
        `${resolve(dirname(config.scrt.buildScript), helper)}:/${helper}:ro`
      )
    }
    return [cmd, args]
  }
}
