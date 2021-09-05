import {
  resolve, dirname, fileURLToPath, relative, existsSync, Docker, pulled, Console, bold, Path
} from '@fadroma/tools'

export interface BuildUploader {
  build          (options: BuildOptions): Promise<Path>
  buildOrCached  (options: BuildOptions): Promise<Path>
  upload         (artifact: any): Promise<any>
  uploadOrCached (artifact: any): Promise<any>
}
 
export type BuilderOptions = {
  docker?: Docker
}

export type BuildOptions = {
  /* Set this to build a remote commit instead of the working tree. */
  repo?:           { origin: string, ref: string },
  /* Path to root Cargo workspace of project. */
  workspace:        Path
  /* Name of contract crate to build. */
  crate:            string
  /* Path where the build artifacts will be produced. */
  outputDir?:       string
  /* Allows additional directories to be bound to the build container. */
  additionalBinds?: Array<any>
  /* Allow user to specify that the contracts shouldn't be built in parallel. */
  sequential?:      boolean
}

export class ContractCode {
  buildImage = 'enigmampc/secret-contract-optimizer:latest'

  protected code: {
    workspace?: string
    crate?:     string
    artifact?:  string
    codeHash?:  string
  } = {}

  /** Path to source workspace */
  get workspace () { return this.code.workspace }
  /** Name of source crate within workspace */
  get crate () { return this.code.crate }
  /** Name of compiled binary */
  get artifact () { return this.code.artifact }
  /** SHA256 hash of the uncompressed artifact */
  get codeHash () { return this.code.codeHash }

  /** Compile a contract from source */
  async build (workspace?: string, crate?: string) {
    if (workspace) this.code.workspace = workspace
    if (crate) this.code.crate = crate
    return this.code.artifact = await new ScrtBuilder().buildOrCached({
      workspace: this.workspace,
      crate:     this.crate }) } }

const {debug} = Console(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Builds contracts and optionally uploads them as an agent on the chain.
 *  Stores upload results as receipts. Not really worthy of more than a function
 *  but that's how it ended up, conjoined with the uploader below. */
export abstract class Builder {

  docker = new Docker({
    socketPath: '/var/run/docker.sock' })

  constructor (options: BuilderOptions = {}) {
    if (options.docker) this.docker = options.docker }

  abstract readonly buildImage: string

  /** Build from source in a Docker container. */
  async build ({
    repo,
    workspace,
    crate,
    outputDir = resolve(workspace, 'artifacts'),
    additionalBinds = []
  }: BuildOptions) {

    const ref          = repo?.ref || 'HEAD'
        , buildImage   = await pulled(this.buildImage, this.docker)
        , buildCommand = this.getBuildCommand({repo, crate})
        , entrypoint   = resolve(__dirname, 'scrt_build.sh')
        , buildArgs =
          { Env: [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
                 , 'CARGO_TERM_VERBOSE=true'
                 , 'CARGO_HTTP_TIMEOUT=240' ]
          , Tty: true
          , AttachStdin: true
          , Entrypoint: ['/bin/sh', '-c']
          , HostConfig: { Binds: [ `${entrypoint}:/entrypoint.sh:ro`
                                 , `${outputDir}:/output:rw`
                                 , `project_cache_${ref}:/code/target:rw`
                                 , `cargo_cache_${ref}:/usr/local/cargo:rw` ] } }

    if (!repo) { // when building working tree
      // TODO is there any other option supported anymore? maybe the parameter is reduntant
      debug(`building working tree at ${workspace} into ${outputDir}...`)
      buildArgs.HostConfig.Binds.push(`${workspace}:/contract:rw`) }

    additionalBinds.forEach(bind=>buildArgs.HostConfig.Binds.push(bind))

    const [{Error:err, StatusCode:code}, container] = await this.docker.run(
      buildImage, buildCommand, process.stdout, buildArgs )

    await container.remove()

    if (err) throw err

    if (code !== 0) throw new Error(`build exited with status ${code}`)

    return resolve(outputDir, `${crate}@${repo?.ref||'HEAD'}.wasm`) }

  async buildOrCached (options: BuildOptions) {
    const {
      workspace,
      outputDir = resolve(workspace, 'artifacts'),
      crate,
      repo
    } = options
    const output = resolve(outputDir, `${crate}@${repo?.ref||'HEAD'}.wasm`)
    if (existsSync(output)) {
      console.info(`${bold(relative(process.cwd(), output))} exists, delete to rebuild`)
      return output }
    return this.build(options) }

  /** Generate the command line for the container. */
  getBuildCommand ({ repo: { origin='', ref='HEAD' }={}, crate }) {
    const commands = []
    if (ref !== 'HEAD') {
      if (!(origin && ref)) {
        throw new Error('to build a ref from an origin, specify both') }
      debug('building ref from origin...')
      commands.push('mkdir -p /contract')
      commands.push('cd /contract')
      commands.push(`git clone --recursive -n ${origin} .`) // clone the repo with submodules
      commands.push(`git checkout ${ref}`) // check out the interesting ref
      commands.push(`git submodule update`) // update submodules for the new checkout
      /*commands.push(`chown -R ${buildUser} /contract`)*/ }
    commands.push(`bash /entrypoint.sh ${crate} ${ref||''}`)
    //commands.push(`pwd && ls -al && mv ${crate}.wasm /output/${crate}@${ref}.wasm`)
    return commands.join(' && ') } }
