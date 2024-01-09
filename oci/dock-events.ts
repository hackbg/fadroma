import { Error } from '@hackbg/oops'
import { Console, bold } from '@hackbg/logs'

export { bold }

export class DockError extends Error {

  static NoDockerode = this.define(
    'NoDockerode',
    ()=>'Dockerode API handle not set'
  )

  static NotDockerode = this.define(
    'NotDockerode',
    ()=>'DockerImage: pass a Dock.DockerEngine instance'
  )

  static NoNameNorDockerfile = this.define(
    'NoNameNorDockerfile',
    ()=>'DockerImage: specify at least one of: name, dockerfile'
  )

  static NoDockerfile = this.define(
    'NoDockerfile',
    ()=>'No dockerfile specified'
  )

  static NoImage = this.define(
    'NoImage',
    ()=>'No image specified'
  )

  static NoContainer = this.define(
    'NoContainer',
    ()=>'No container'
  )

  static ContainerAlreadyCreated = this.define(
    'ContainerAlreadyCreated',
    ()=>'Container already created'
  )

  static NoName = this.define(
    'NoName',
    (action: string) => `Can't ${action} image with no name`
  )

  static PullFailed = this.define(
    'PullFailed',
    (name: string) => `Pulling ${name} failed.`
  )

  static BuildFailed = this.define(
    'BuildFailed',
    (name: string, dockerfile: string, context: string) => (
      `Building ${name} from ${dockerfile} in ${context} failed.`
    )
  )

}

export class DockConsole extends Console {

  ensuring = () =>
    this //this.info('Ensuring that the image exists')

  imageExists = () =>
    this // this.info('Image exists')

  notCachedPulling = () =>
    this.log('Not cached, pulling')

  notFoundBuilding = (msg: string) =>
    this.log(`Not found in registry, building (${msg})`)

  buildingFromDockerfile = (file: string) =>
    this.log(`Using dockerfile:`, bold(file))

  creatingContainer (name?: string) {
    return this.log(`Creating container`, bold(name))
  }

  boundPort (containerPort: any, hostPort: any) {
    return this.debug(`port localhost:${bold(hostPort)} => :${bold(containerPort)}`)
  }

  boundVolumes (binds: any[]) {
    return this.debug('Mount volumes:\n ', binds
      .map(bind=>{
        const [ host, mount, mode = 'rw' ] = bind.split(':')
        return [ mode, bold(mount), '=\n    ', host ].join(' ')
      })
      .join('\n  ')
    )
  }

  createdWithWarnings = (id: string, warnings?: any) => {
    this.warn(`Warnings when creating ${bold(id)}`)
    if (warnings) {
      this.warn(warnings)
    }
    return this
  }

}
