import Docker from 'dockerode'
import { pulled } from '@fadroma/net'
import { Console } from '@fadroma/cli'
import { resolve, relative, basename, dirname, fileURLToPath, 
         existsSync, readFile, writeFile, mkdir } from '@fadroma/sys'
import colors from 'colors'
const {bold} = colors

/** I wonder, what does the documentation generator do
 *  when I document a dual defintition? */
const {debug, info} = Console(import.meta.url)

/** Why did they kill __dirname of all things.
 *  Part of the 'extinguish' phase? */
const __dirname = dirname(fileURLToPath(import.meta.url))

export type CtorArgs = {
  docker?: Docker
}

export type Path = string

export type BuildArgs = {
  /* Set this to build a remote commit instead of the working tree. */
  clone?:           { origin: string, ref: string },
  /* Path to root Cargo workspace of project. */
  workspace:        Path
  /* Name of contract crate to build. */
  crate:            string
  /* Path where the build artifacts will be produced. */
  outputDir?:       string
  /* Allows additional directories to be bound to the build container. */
  additionalBinds?: Array<any>
}

/** Builds contracts and optionally uploads them as an agent on the Secret Network.
 *  Stores upload results as receipts. Not really worthy of more than a function
 *  but that's how it ended up, conjoined with the uploader below. */
export class Builder {

  docker = new Docker({
    socketPath: '/var/run/docker.sock' })

  constructor (options: CtorArgs = {}) {
    if (options.docker) this.docker = options.docker }

  /** Build from source in a Docker container. */
  async build (options: BuildArgs) {
    const { clone
          , workspace
          , crate
          , outputDir = resolve(workspace, 'artifacts') } = options

    const ref          = clone?.ref || 'HEAD'
        , buildImage   = await pulled('enigmampc/secret-contract-optimizer:latest', this.docker)
        , buildCommand = this.getBuildCommand({clone, crate})
        , entrypoint   = resolve(__dirname, 'scrt_build.sh')

    const buildArgs =
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

    if (!clone) { // when building working tree
      // TODO is there any other option supported anymore? maybe the parameter is reduntant
      debug(`building working tree at ${workspace} into ${outputDir}...`)
      buildArgs.HostConfig.Binds.push(`${workspace}:/contract:rw`) }

    if (Array.isArray(options.additionalBinds)) {
      for (const bind of options.additionalBinds) {
        buildArgs.HostConfig.Binds.push(bind) } }

    const [{Error:err, StatusCode:code}, container] = await this.docker.run(
      buildImage, buildCommand, process.stdout, buildArgs )

    await container.remove()

    if (err) throw err

    if (code !== 0) throw new Error(`build exited with status ${code}`)

    return resolve(outputDir, `${crate}@${clone?.ref||'HEAD'}.wasm`) }

  /** Generate the command line for the container. */
  getBuildCommand ({ clone: {origin, ref}, crate }) {
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

type Network = any
type Agent   = any

/** I am starting to think that the builder and uploader phases
 *  should be accessed primarily via the Contract object and not as currently,
 *  and be separate features of it (dynamically loaded if not using fadroma.js in a browser
 *  which currently noone does anyway). */
export class BuilderWithUploader extends Builder {

  network: Network
  agent:   Agent

  constructor (options={}) {
    super(options)
    // some puny dependency auto negotiation so you can pass partial objects
    let { network, agent } = options as any
    if (!network && agent) {
      network = agent.network }
    else if (!agent && network) {
      agent = network.defaultAgent }
    this.network = network
    this.agent   = agent }

  /* Contracts will be deployed from this address. */
  get address () {
    return this.agent ? this.agent.address : undefined }

  /** Try to upload a binary to the network but return a pre-existing receipt if one exists.
   *  TODO also code checksums should be validated */
  async uploadCached (artifact: any) {
    const receiptPath = this.getReceiptPath(artifact)
    if (existsSync(receiptPath)) {
      const receiptData = await readFile(receiptPath, 'utf8')
      info(`${bold(relative(process.cwd(), receiptPath))} exists, delete to reupload`)
      return JSON.parse(receiptData) }
    else {
      return this.upload(artifact) } }

  getReceiptPath = (path: string) =>
    resolve(this.network.receipts, `${basename(path)}.upload.json`)

  /** Upload a binary to the network. */
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
