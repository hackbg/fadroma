import Docker from 'dockerode'
import {
  resolve, basename, dirname, existsSync, fileURLToPath, 
  readFile, writeFile, mkdir,
  Console
} from '@fadroma/utilities'
import { pulled } from '../netutil.js'

/** I wonder, what does the documentation generator do
 *  when I document a dual defintition? */
const {debug, info} = Console(import.meta.url)

/** Why did they kill __dirname of all things.
 *  Part of the 'extinguish' phase? */
const __dirname = dirname(fileURLToPath(import.meta.url))

/** Builds contracts and optionally uploads them as an agent on the Secret Network.
 *  Stores upload results as receipts. Not really worthy of more than a function
 *  but that's how it ended up, conjoined with the uploader below. */
export class ScrtBuilder {

  docker = new Docker({
    socketPath: '/var/run/docker.sock' })

  constructor (options={}) {
    const { docker } = options
    if (docker) this.docker = docker
  }

  /** Build from source in a Docker container. */
  async build (options = {}) {
    const { buildAs   = 'root'
          , origin
          , ref       = 'HEAD'
          , workspace
          , crate
          , outputDir = resolve(workspace, 'artifacts') } = options
        , buildImage    = await pulled('enigmampc/secret-contract-optimizer:latest', this.docker)
        , buildCommand  = this.getBuildCommand({buildAs, origin, ref, crate})
        , entrypoint    = resolve(__dirname, 'build.sh')
        , buildOptions  =
          { Env:         [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
                         , 'CARGO_TERM_VERBOSE=true'
                         , 'CARGO_HTTP_TIMEOUT=240' ]
          , Tty:         true
          , AttachStdin: true
          , Entrypoint:  ['/bin/sh', '-c']
          , HostConfig:  { Binds: [ `${entrypoint}:/entrypoint.sh:ro`
                                  , `${outputDir}:/output:rw`
                                  , `sienna_cache_${ref}:/code/target:rw`
                                  , `cargo_cache_${ref}:/usr/local/cargo:rw` ] } }

    if (ref === 'HEAD') { // when building working tree
      // TODO is there any other option supported anymore? maybe the parameter is reduntant
      debug(`building working tree at ${workspace} into ${outputDir}...`)
      buildOptions.HostConfig.Binds.push(`${workspace}:/contract:rw`)
    }

    if (Array.isArray(options.additionalBinds)) {
      for (const bind of options.additionalBinds) {
        buildOptions.HostConfig.Binds.push(bind)
      }
    }

    const [{Error:err, StatusCode:code}, container] = await this.docker.run(
      buildImage, buildCommand, process.stdout, buildOptions
    )

    await container.remove()

    if (err) throw err

    if (code !== 0) throw new Error(`build exited with status ${code}`)

    return resolve(outputDir, `${crate}@${ref}.wasm`)
  }

  /** Generate the command line for the container. */
  getBuildCommand ({ origin, ref, crate }) {
    const commands = []
    if (ref !== 'HEAD') {
      assert(origin && ref, 'to build a ref from origin, specify both')
      debug('building ref from origin...')
      commands.push('mkdir -p /contract')
      commands.push('cd /contract')
      commands.push(`git clone --recursive -n ${origin} .`) // clone the repo with submodules
      commands.push(`git checkout ${ref}`) // check out the interesting ref
      commands.push(`git submodule update`) // update submodules for the new checkout
      //commands.push(`chown -R ${buildAs} /contract`)
    }
    commands.push(`bash /entrypoint.sh ${crate} ${ref||''}`)
    //commands.push(`pwd && ls -al && mv ${crate}.wasm /output/${crate}@${ref}.wasm`)
    return commands.join(' && ')
  }
    
}

/** I am starting to think that the builder and uploader phases
 *  should be accessed primarily via the Contract object and not as currently,
 *  and be separate features of it (dynamically loaded if not using fadroma.js in a browser
 *  which currently noone does anyway). */
export default class ScrtBuilderWithUploader extends ScrtBuilder {

  constructor (options={}) {
    super(options)
    // some puny dependency auto negotiation so you can pass partial objects
    let { network, agent } = options
    if (!network && agent) {
      network = agent.network
    } else if (!agent && network) {
      agent = network.defaultAgent
    }
    Object.assign(this, { network, agent })
  }

  /* Contracts will be deployed from this address. */
  get address () {
    return this.agent ? this.agent.address : undefined
  }

  /** Try to upload a binary to the network but return a pre-existing receipt if one exists.
   *  TODO also code checksums should be validated */
  async uploadCached (artifact) {
    const receiptPath = this.getReceiptPath(artifact)
    if (existsSync(receiptPath)) {
      const receiptData = await readFile(receiptPath, 'utf8')
      info(`${receiptPath} exists. Delete it to reupload that contract.`)
      return JSON.parse(receiptData)
    } else {
      return this.upload(artifact)
    }
  }

  getReceiptPath = path =>
    resolve(this.network.receipts, `${basename(path)}.upload.json`)

  /** Upload a binary to the network. */
  async upload (artifact) {
    const uploadResult = await this.agent.upload(artifact)
    const receiptData = JSON.stringify(uploadResult, null, 2)
    const receiptPath = this.getReceiptPath(artifact);

    const elements = receiptPath.slice(1, receiptPath.length).split('/');
    
    let path = `/`;
    for (const item of elements) {
      if (!existsSync(path)) {
        mkdir(path);
      }

      path += `/${item}`;
    }

    await writeFile(receiptPath, receiptData, 'utf8')
    return uploadResult
  }
}
