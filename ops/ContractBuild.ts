import {
  resolve, dirname, fileURLToPath, relative, existsSync, Docker, pulled, Console, bold, Path
} from '@fadroma/tools'

const {debug} = Console(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))

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

  private docker = new Docker({ socketPath: '/var/run/docker.sock' })

  /** Compile a contract from source */
  // TODO support clone & build contract from external repo+ref
  async build (workspace?: string, crate?: string, additionalBinds?: Array<string>) {
    if (workspace) this.code.workspace = workspace
    if (crate) this.code.crate = crate

    const ref       = 'HEAD'
        , outputDir = resolve(this.workspace, 'artifacts')
        , output    = resolve(outputDir, `${crate}@${ref}.wasm`)

    if (existsSync(output)) {
      console.info(`${bold(relative(process.cwd(), output))} exists, delete to rebuild`) }
    else {
      const image   = await pulled(this.buildImage, this.docker)
          , command = this.getBuildCommand({repo, crate})
          , entry   = resolve(__dirname, 'ScrtBuild.sh')
          , buildArgs =
            { Env:
                [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
                , 'CARGO_TERM_VERBOSE=true'
                , 'CARGO_HTTP_TIMEOUT=240' ]
            , Tty:
                true
            , AttachStdin:
                true
            , Entrypoint:
                ['/bin/sh', '-c']
            , HostConfig:
                { Binds: [ `${entry}:/entrypoint.sh:ro`
                         , `${outputDir}:/output:rw`
                         , `project_cache_${ref}:/code/target:rw`
                         , `cargo_cache_${ref}:/usr/local/cargo:rw` ] } }
      debug(`building working tree at ${workspace} into ${outputDir}...`)
      buildArgs.HostConfig.Binds.push(`${workspace}:/contract:rw`)
      additionalBinds.forEach(bind=>buildArgs.HostConfig.Binds.push(bind))
      const [{Error:err, StatusCode:code}, container] =
        await this.docker.run(image, command, process.stdout, buildArgs )
      await container.remove()

      if (err) throw err
      if (code !== 0) throw new Error(`build exited with status ${code}`) }

    return this.code.artifact = output }

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
