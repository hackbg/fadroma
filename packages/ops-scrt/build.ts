import { relative, dirname } from 'path'
import { Dokeres } from '@hackbg/dokeres'
import { DockerBuilder, RawBuilder, populateBuildContext } from '@fadroma/ops'

interface EnableScrtBuilder {
  config: {
    build: {
      rebuild: boolean
    }
    scrt: {
      build: object
    }
  }
}

export const ScrtBuildOps = {
  Scrt: function enableScrtBuilder ({ config }: EnableScrtBuilder) {
    const builder = getScrtBuilder({ ...config.build, ...config.scrt.build })
    return populateBuildContext(builder)
  }
}

interface GetScrtBuilder {
  rebuild?:    boolean
  raw?:        boolean
  managerUrl?: string|URL
  image?:      string
  dockerfile?: string
  script?:     string
  service?:    string
}

export function getScrtBuilder (context: GetScrtBuilder) {
  const {
    rebuild,
    raw,
    managerUrl,
    image,
    dockerfile,
    script,
    service
  } = context
  const caching = !rebuild
  if (raw) {
    return new ScrtRawBuilder({ caching, script })
  } else if (managerUrl) {
    throw new Error('unimplemented: managed builder will be available in a future version of Fadroma')
    //return new ManagedBuilder({ managerURL })
  } else {
    return new ScrtDockerBuilder({ caching, image, dockerfile, script, service })
  }
}

export class ScrtDockerBuilder extends DockerBuilder {

  constructor ({
    caching,
    image,
    dockerfile,
    script,
    service
  }) {
    super({
      caching,
      script,
      image: new Dokeres().image(
        image,
        dockerfile,
        [script, service].map(x=>relative(dirname(dockerfile), x))
      )
    })
  }

}

export class ScrtRawBuilder extends RawBuilder {}
