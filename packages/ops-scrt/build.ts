import { relative, dirname } from 'path'
import { Dokeres } from '@hackbg/dokeres'
import { DockerBuilder } from '@fadroma/ops'

export function getScrtBuilder ({
  raw,
  managerUrl,
  caching = true,
  image,
  dockerfile,
  script,
  service
}: {
  raw?:        boolean
  managerUrl?: string|URL
  caching?:    boolean
  image?:      string
  dockerfile?: string
  script?:     string
  service?:    string
}) {
  if (raw) {
    throw 'TODO'
  } else if (managerUrl) {
    throw new Error('unimplemented: managed builder will be available in a future version of Fadroma')
    //return new ManagedBuilder({ managerURL })
  } else {
    return new ScrtDockerBuilder({
      caching,
      image,
      dockerfile,
      script,
      service
    })
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
