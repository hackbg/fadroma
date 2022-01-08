# Fadroma Ops: ContractBuild
# or, automating the contract build procedure

This part can be done offline, but cannot be performed from a browser.

* A contract's source code is a Rust `crate` within a Cargo `workspace`.
* The code is compiled in a build container (TODO specify here?),
  which results in an `artifact` (WASM blob) with a particular `codeHash`.

```typescript
```

```typescript
import { resolve, existsSync, Docker, ensureDockerImage, Console, bold, relative } from '@fadroma/tools'

const console = Console(import.meta.url)

export type Buildable = {

  code:                BuildState
  readonly workspace?: string
  readonly crate?:     string

  build (workspace?: string, crate?: string): Promise<any>
  readonly artifact?:                         string
  readonly codeHash?:                         string

}

export type BuildState = {
  workspace?: string
  crate?:     string
  artifact?:  string
  codeHash?:  string
}

export type BuildOptions = BuildState

export abstract class ContractCode {

  abstract buildImage:      string|null
  abstract buildDockerfile: string|null
  abstract buildScript:     string|null

  code: BuildState = {}

  constructor (options: BuildOptions = {}) {
    if (options.workspace) this.code.workspace = options.workspace
    if (options.crate)     this.code.crate = options.crate
    if (options.artifact)  this.code.artifact = options.artifact
    if (options.codeHash)  this.code.codeHash = options.codeHash
  }

  /** Path to source workspace */
  get workspace () { return this.code.workspace }

  /** Name of source crate within workspace */
  get crate () { return this.code.crate }

  /** Name of compiled binary */
  get artifact () { return this.code.artifact }

  /** SHA256 hash of the uncompressed artifact */
  get codeHash () { return this.code.codeHash }

  private docker = new Docker({ socketPath: '/var/run/docker.sock' })

  /** Compile a contract from source */
  // TODO support clone & build contract from external repo+ref
  async build (workspace?: string, crate?: string, extraBinds?: string[]) {

    if (workspace) this.code.workspace = workspace
    if (crate)     this.code.crate = crate

    const ref       = 'HEAD'
    const outputDir = resolve(this.workspace, 'artifacts')
    const artifact  = resolve(outputDir, `${this.crate}@${ref}.wasm`)

    if (!existsSync(artifact)) {

      console.info(
        `Building crate ${bold(this.crate)} `           +
        `from working tree at ${bold(this.workspace)} ` +
        `into ${bold(outputDir)}...`
      )

      const buildImage = await ensureDockerImage(this.buildImage, this.buildDockerfile, this.docker)
      const buildCommand = `bash /entrypoint.sh ${this.crate} ${ref}`
      const buildArgs = this.getBuildArgs(ref, outputDir, extraBinds)

      console.debug(
        `Running ${bold(buildCommand)} in ${bold(buildImage)} with the following options:`,
        buildArgs
      )

      const [{ Error:err, StatusCode:code }, container] = await this.docker.run(
        buildImage, buildCommand, process.stdout, buildArgs
      )

      await container.remove()
      if (err) throw err
      if (code !== 0) throw new Error(`build exited with status ${code}`)

    } else {
      console.info(`${bold(relative(process.cwd(), artifact))} exists, delete to rebuild`)
    }

    return this.code.artifact = artifact

  }

  private getBuildArgs (ref: string, outputDir: string, extraBinds?: string[]) {

    const binds = [
      `${outputDir}:/output:rw`,
      `project_cache_${ref}:/code/target:rw`,
      `cargo_cache_${ref}:/usr/local/cargo:rw`,
      `${this.workspace}:/contract:rw`
    ]

    if (this.buildScript) {
      binds.push(`${this.buildScript}:/entrypoint.sh:ro`)
    }

    const buildArgs = {
      Tty:         true,
      AttachStdin: true,
      Entrypoint:  ['/bin/sh', '-c'],
      HostConfig:  { Binds: binds },
      Env: [
        'CARGO_NET_GIT_FETCH_WITH_CLI=true',
        'CARGO_TERM_VERBOSE=true',
        'CARGO_HTTP_TIMEOUT=240'
      ],
    }

    extraBinds?.forEach(bind=>buildArgs.HostConfig.Binds.push(bind))

    return buildArgs

  }

}
```
