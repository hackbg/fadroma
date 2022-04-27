import {
  resolve, relative, dirname,
  RawBuilder,
  DockerodeBuilder, DockerImage,
  scrtConfig as config
} from '@fadroma/scrt'

export function getScrt_1_3_Builder ({
  caching = !config.rebuild
}: {
  caching?: boolean
} = {}) {
  return new Scrt_1_3_DockerodeBuilder({ caching })
}

export class Scrt_1_3_DockerodeBuilder extends DockerodeBuilder {

  buildEntryPoint = relative(
    dirname(config.scrt.buildDockerfile),
    config.scrt.buildScript
  )

  image = new DockerImage(
    undefined,
    config.scrt.buildImage,
    config.scrt.buildDockerfile,
    [ this.buildEntryPoint ]
  )

  constructor ({ caching }) {
    const script = config.scrt.buildScript
    super({ script, caching })
  }

}
