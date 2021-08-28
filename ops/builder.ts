import { resolve, dirname, fileURLToPath, relative, basename,
         mkdir, existsSync, readFile, writeFile } from './system'
import { Docker, pulled } from './network'
import { Console, bold } from './command'

import type { Chain, Agent, BuildUploader, BuilderOptions, BuildOptions } from './types'

/** I wonder, what does the documentation generator do
 *  when I document a dual defintition? */
const {debug} = Console(import.meta.url)

/** Why did they kill __dirname of all things.
 *  Part of the 'extinguish' phase? */
const __dirname = dirname(fileURLToPath(import.meta.url))

/** Builds contracts and optionally uploads them as an agent on the Secret Chain.
 *  Stores upload results as receipts. Not really worthy of more than a function
 *  but that's how it ended up, conjoined with the uploader below. */
export class ScrtBuilder {

  docker = new Docker({
    socketPath: '/var/run/docker.sock' })

  constructor (options: BuilderOptions = {}) {
    if (options.docker) this.docker = options.docker }

  /** Build from source in a Docker container. */
  async build ({
    repo,
    workspace,
    crate,
    outputDir = resolve(workspace, 'artifacts'),
    additionalBinds = []
  }: BuildOptions) {

    const ref          = repo?.ref || 'HEAD'
        , buildImage   = await pulled('enigmampc/secret-contract-optimizer:latest', this.docker)
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
                                 , `sienna_cache_${ref}:/code/target:rw`
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

// I'm starting to think that the builder and uploader phases should be accessed
// primarily via the Contract object and not as currently; and be separate features
// (dynamically loaded unless using fadroma.js in a browser) */

const {info} = Console(import.meta.url)

export class ScrtUploader extends ScrtBuilder implements BuildUploader {

  constructor (
    readonly chain: Chain,
    readonly agent: Agent
  ) {
    super()
  }

  /* Contracts will be deployed from this address. */
  get address () {
    return this.agent ? this.agent.address : undefined }

  /** Try to upload a binary to the chain but return a pre-existing receipt if one exists.
   *  TODO also code checksums should be validated */
  async uploadOrCached (artifact: any) {
    const receiptPath = this.getReceiptPath(artifact)
    if (existsSync(receiptPath)) {
      const receiptData = await readFile(receiptPath, 'utf8')
      info(`${bold(relative(process.cwd(), receiptPath))} exists, delete to reupload`)
      return JSON.parse(receiptData) }
    else {
      return this.upload(artifact) } }

  getReceiptPath = (path: string) =>
    this.chain.uploads.resolve(`${basename(path)}.json`)

  /** Upload a binary to the chain. */
  async upload (artifact: any) {
    const uploadResult = await this.agent.upload(artifact)
        , receiptData  = JSON.stringify(uploadResult, null, 2)
        , receiptPath  = this.getReceiptPath(artifact)
        , elements     = receiptPath.slice(1, receiptPath.length).split('/');
    let path = `/`
    for (const item of elements) {
      if (!existsSync(path)) mkdir(path)
      path += `/${item}` }
    await writeFile(receiptPath, receiptData, 'utf8')
    return uploadResult } }
