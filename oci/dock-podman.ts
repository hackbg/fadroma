import { Engine, Image, Container } from './dock-base'
import type { ContainerOpts, ContainerCommand } from './dock-base'
import { DockError as Error, DockConsole as Console, bold } from './dock-events'

import { Readable, Writable, Transform } from 'node:stream'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'

import $, { JSONFile } from '@hackbg/file'

const log = new Console('podman')

class PodmanEngine extends Engine {

  constructor (...podmanCommand: string[]) {
    super('podman')
    this.podmanCommand = (podmanCommand.length > 0) ? podmanCommand : ['/usr/bin/env', 'podman']
  }

  podmanCommand: string[]

  podman (...command: string[]): Promise<string> {
    command = [...this.podmanCommand, ...command]
    let stdout = ''
    return new Promise((resolve, reject)=>{
      const run = spawn(command[0], command.slice(1))
      run.stdout.on("data", chunk => stdout = stdout + chunk.toString())
      run.stderr.on("data", chunk => process.stderr.write(chunk.toString()))
      run.on("exit", (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(Object.assign(
            new Error(`Process ${run.pid} (${command.join(' ')}) exited with code ${code}`),
            { code, pid: run.pid, command }
          ))
        }
      })
    })
  }

  ensurePolicy (transport: string, scope: string, policies: any[]) {
    const policyPath = $(homedir(), '.config', 'containers', 'policy.json')
    const policyFile = policyPath.as(JSONFile).touch()
    let policy: any
    try {
      policy = policyFile.load()
    } catch (e) {
      if (e.message === 'Unexpected end of JSON input') {
        policy = {}
      } else {
        throw e
      }
    }
    policy['default'] ??= [{"type": "reject"}]
    policy.transports ??= {}
    policy.transports[transport] ??= {}
    policy.transports[transport][scope] ??= policies
    this.log.info(`Updating container policy at`, policyPath.path)
    policyFile.save(policy)
  }

  image (
    name:        string|null,
    dockerfile?: string|null,
    extraFiles?: string[]
  ): PodmanImage {
    return new PodmanImage(this, name, dockerfile, extraFiles)
  }

  async container (id: string): Promise<PodmanContainer> {
    const image = this.image(null /* FIXME */)
    return new PodmanContainer(image)
  }

}

class PodmanImage extends Image {

  declare engine:
    PodmanEngine

  async run (
    name?:         string,
    options?:      Partial<ContainerOpts>,
    command?:      ContainerCommand,
    entrypoint?:   ContainerCommand,
    outputStream?: Writable
  ) {
    return await Container.run(
      this,
      name,
      options,
      command,
      entrypoint,
      outputStream
    )
  }

  async check () {
    if (!this.name) throw new Error.NoName('inspect')
  }

  async pull () {
    const { name } = this
    if (!name) throw new Error.NoName('pull')
    await this.engine.podman('pull', name)
  }

  async build () {
    if (!this.dockerfile) throw new Error.NoDockerfile()
    await this.engine.podman('build')
  }

  container (
    name?:       string,
    options?:    Partial<ContainerOpts>,
    command?:    ContainerCommand,
    entrypoint?: ContainerCommand,
  ) {
    return new PodmanContainer(
      this,
      name,
      options,
      command,
      entrypoint
    )
  }

}

class PodmanContainer extends Container {

  declare image:
    PodmanImage

  get id () { return '' }

  get warnings () { return [] }

  get shortId () { return '' }

  get isRunning () { return Promise.resolve(false) }

  get ip () { return Promise.resolve('') }

  async create () {
    if (!this.image || !this.image.name) throw new Error.NoImage()
    let options: string[] = []

    if (this.name) {
      options = [...options, '--name', this.name]
    }

    if (this.entrypoint) {
      options = [...options, '--entrypoint', ...this.entrypoint]
    }

    if (this.options.env) {
      const env = Object.entries(this.options.env).map(([key, val])=>`${key}=${val}`).join(',')
      options = [...options, '--env', env]
    }

    if (this.options.cwd) {
      options = [...options, '--workdir', this.options.cwd]
    }

    //this.options.exposed
      //?.forEach(containerPort=>
        //config.ExposedPorts[containerPort] = {})

    //Object.entries(this.options.mapped)
      //?.forEach(([containerPort, hostPort])=>
        //config.HostConfig.PortBindings[containerPort] = [{ HostPort: hostPort }])

    //Object.entries(this.options.readonly)
      //?.forEach(([hostPath, containerPath])=>
        //config.HostConfig.Binds.push(`${hostPath}:${containerPath}:ro`))

    //Object.entries(this.options.writable)
      //?.forEach(([hostPath, containerPath])=>
        //config.HostConfig.Binds.push(`${hostPath}:${containerPath}:rw`))

    await this.image.engine.podman('create', ...options, this.image.name, ...this.command??[])
    return this
  }

  async remove () {
    if (!this.id) throw new Error.NoContainer()
    await this.image.engine.podman('remove', this.id)
    return this
  }

  async start () {
    if (!this.id) throw new Error.NoContainer()
    await this.image.engine.podman('start', this.id)
    return this
  }

  async wait () {
    if (!this.id) throw new Error.NoContainer()
    await this.image.engine.podman('wait', this.id)
    return { code: 1 } // FIXME
  }

  async waitLog () {
  }

  async kill () {
    if (!this.id) throw new Error.NoContainer()
    await this.image.engine.podman('kill', this.id)
    return this
  }

  async inspect () {
    if (!this.id) throw new Error.NoContainer()
    const data = JSON.parse(await this.image.engine.podman('inspect', this.id))
    return data
  }

  async exec (...command: string[]): Promise<[string, string]> {
    throw new Error('not implemented')
    return ['', '']
  }

  async export (repository?: string, tag?: string) {
    throw new Error('not implemented')
    return ''
  }

}

export {
  PodmanEngine    as Engine,
  PodmanImage     as Image,
  PodmanContainer as Container,
}
