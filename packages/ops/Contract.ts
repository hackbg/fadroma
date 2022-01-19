import type {
  IChain, IAgent, IContract,
  ContractConstructor,
  ContractConstructorArguments,
  ContractBuild, ContractBuildState,
  ContractUpload, ContractUploadState, UploadReceipt,
  ContractClient, ContractClientState, InitTX, InitReceipt, ContractMessage,
} from './Model'
import { BaseAgent, isAgent } from './Agent'
import { BaseChain, DeploymentsDir } from './Chain'
import { loadSchemas } from './Schema'

import {
  Console, bold,
  resolve, relative, basename,
  existsSync, readFile, writeFile, mkdir,
  homedir, tmp, copy,
  Docker, ensureDockerImage,
  rimraf, spawnSync,
  backOff
} from '@hackbg/tools'

const console = Console(import.meta.url)

export abstract class DockerizedContractBuild implements ContractBuild {

  // build environment
  abstract buildImage:      string|null
  abstract buildDockerfile: string|null
  abstract buildScript:     string|null

  // build inputs
  repo?:          string
  ref?:           string
  workspace?:     string
  crate?:         string

  // build outputs
  artifact?:      string
  codeHash?:      string

  constructor (options: ContractBuildState = {}) {
    for (const key of Object.keys(options)) {
      this[key] = options[key]
    }
  }

  dockerSocket = '/var/run/docker.sock'

  /** Compile a contract from source */
  // TODO support clone & build contract from external repo+ref
  async build (): Promise<string> {
    this.artifact = await buildInDocker(new Docker({ socketPath: this.dockerSocket }), this)
    return this.artifact
  }

}

export abstract class FSContractUpload extends DockerizedContractBuild implements ContractUpload {

  // upload inputs
  artifact?:      string
  codeHash?:      string
  chain?:         IChain
  uploader?:      IAgent

  // upload outputs
  uploadReceipt?: UploadReceipt
  codeId?:        number

  constructor (options: ContractBuildState & ContractUploadState = {}) {
    super(options)
  }

  /** Path to where the result of the upload transaction is stored */
  get uploadReceiptPath () { return this.chain.uploads.resolve(`${basename(this.artifact)}.json`) }

  /** Code ID + code hash pair in Sienna Swap Factory format */
  get template () { return { id: this.codeId, code_hash: this.codeHash } }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload () {
    // upload if not already uploaded
    this.uploadReceipt = await uploadFromFS(
      this.uploader,
      this.artifact,
      this.uploadReceiptPath
    )
    // set code it and code hash to allow instantiation of uploaded code
    this.codeId   = this.uploadReceipt?.codeId
    this.codeHash = this.uploadReceipt?.originalChecksum
    return this.uploadReceipt
  }
}

export abstract class BaseContractClient extends FSContractUpload implements ContractClient {

  static loadSchemas = loadSchemas

  // init inputs
  chain?:        IChain
  codeId?:       number
  codeHash?:     string
  name?:         string
  prefix?:       string
  suffix?:       string
  instantiator?: IAgent
  initMsg?:      Record<string, any> = {}

  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is prepended to the label. */
  get label () {
    let label = this.name
    if (this.prefix) label = `${this.prefix}/${this.name}`
    if (this.suffix) label = `${this.name}${this.suffix}`
    return label
  }

  // init outputs
  address?:      string
  initTx?:       InitTX
  initReceipt?:  InitReceipt

  /** A reference to the contract in the format that ICC callbacks expect. */
  get link () { return { address: this.address, code_hash: this.codeHash } }

  /** A reference to the contract as an array */
  get linkPair () { return [ this.address, this.codeHash ] as [string, string] }

  constructor (
    options: ContractBuildState & ContractUploadState & ContractClientState = {}
  ) {
    super(options)
  }

  async instantiate (): Promise<InitReceipt> {
    this.initTx = await instantiateContract(this)
    this.initReceipt = {
      label:    this.label,
      codeId:   this.codeId,
      codeHash: this.codeHash,
      initTx:   this.initTx
    }
    this.address = this.initTx.contractAddress
    this.save()
    return this.initReceipt
  }

  async instantiateOrExisting (receipt?: InitReceipt, agent?: IAgent): Promise<InitReceipt> {
    if (!receipt) {
      return await this.instantiate()
    } else {
      this.codeHash = receipt.codeHash
      this.address  = receipt.initTx.contractAddress
      this.name     = receipt.label.split('/')[1]
      if (agent) this.instantiator = agent
      console.info(`${this.label}: already exists at ${this.address}`)
      return receipt
    }
  }

  /** Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  save () {
    let dir = this.chain.deployments
    if (this.prefix) {
      dir = dir.subdir(this.prefix, DeploymentsDir).make() as DeploymentsDir
    }
    dir.save(this.name, this.initReceipt)
    return this
  }

  /** Execute a contract transaction. */
  execute (
    msg:    ContractMessage = "",
    memo:   string          = "",
    amount: unknown[]       = [],
    fee:    unknown         = undefined,
    agent:  IAgent          = this.instantiator
  ) {
    return backOff(
      () => agent.execute(this, msg, amount, memo, fee),
      txBackOffOptions
    )
  }

  /** Query the contract. */
  query (
    msg:   ContractMessage = "",
    agent: IAgent          = this.instantiator
  ) {
    return backOff(
      () => agent.query(this, msg),
      txBackOffOptions
    )
  }

}

export abstract class AugmentedContractClient<
  Executor extends TransactionExecutor,
  Querier  extends QueryExecutor
> extends BaseContractClient {

  /** Class implementing transaction methods. */
  Transactions?: new (contract: IContract, agent: IAgent) => Executor

  /** Get a Transactions instance bound to the current contract and agent */
  tx (agent: IAgent = this.instantiator) {
    if (!this.Transactions) {
      throw new Error('@fadroma/ops: define the Transactions property to use this method')
    }
    return new (this.Transactions)(this, agent)
  }

  /** Class implementing query methods. */
  Queries?: new (contract: IContract, agent: IAgent) => Querier

  /** Get a Queries instance bound to the current contract and agent */
  q (agent: IAgent = this.instantiator) {
    if (!this.Queries) {
      throw new Error('@fadroma/ops: define the Queries property to use this method')
    }
    return new (this.Queries)(this, agent)
  }

}

export class TransactionExecutor {
  constructor (
    readonly contract: IContract,
    readonly agent:    IAgent
  ) {}

  protected execute (msg: ContractMessage) {
    return this.agent.execute(this.contract, msg)
  }
}

export class QueryExecutor {
  constructor (
    readonly contract: IContract,
    readonly agent:    IAgent
  ) {}

  protected query (msg: ContractMessage) {
    return this.agent.query(this.contract, msg)
  }
}

export async function buildInDocker (
  docker:       Docker,
  buildOptions: DockerizedContractBuild
) {

  const {
    crate,
    ref = 'HEAD',
    buildScript,
    buildDockerfile
  } = buildOptions

  let {
    workspace,
    buildImage
  } = buildOptions

  if (!workspace) {
    throw new Error(`Missing workspace path (crate ${crate} at ${ref})`)
  }

  const run = (cmd: string, ...args: string[]) =>
    spawnSync(cmd, args, { cwd: workspace, stdio: 'inherit' })

  let tmpDir

  try {
    const outputDir = resolve(workspace, 'artifacts')
    const artifact  = resolve(outputDir, `${crate}@${ref}.wasm`)
    if (existsSync(artifact)) {
      console.info(`${bold(relative(process.cwd(), artifact))} exists, delete to rebuild`)
      return artifact
    }

    if (!ref || ref === 'HEAD') {
      // Build working tree
      console.info(
        `Building crate ${bold(crate)} ` +
        `from working tree at ${bold(workspace)} ` +
        `into ${bold(outputDir)}...`
      )
    } else {
      // Copy working tree into /tmp and checkout the commit to build

      console.info(
        `Building crate ${bold(crate)} ` +
        `from commit ${bold(ref)} ` +
        `into ${bold(outputDir)}...`
      )
      tmpDir = tmp.dirSync({ prefix: 'fadroma_build', tmpdir: '/tmp' })

      console.info(
        `Copying source code from ${bold(workspace)} ` +
        `into ${bold(tmpDir.name)}`
      )
      run('cp', '-rT', workspace, tmpDir.name)
      workspace = tmpDir.name

      console.info(`Cleaning untracked files from ${bold(workspace)}...`)
      run('git', 'stash', '-u')
      run('git', 'reset', '--hard', '--recurse-submodules')
      run('git', 'clean', '-f', '-d', '-x')

      console.info(`Checking out ${bold(ref)} in ${bold(workspace)}...`)
      run('git', 'checkout', ref)

      console.info(`Preparing submodules...`)
      run('git', 'submodule', 'update', '--init', '--recursive')
    }

    run('git', 'log', '-1')

    buildImage = await ensureDockerImage(buildImage, buildDockerfile, docker)
    const buildCommand = `bash /entrypoint.sh ${crate} ${ref}`
    const buildArgs = {
      Tty:         true,
      AttachStdin: true,
      Entrypoint:  ['/bin/sh', '-c'],
      HostConfig:  {
        Binds: [
          // Input
          `${workspace}:/contract:rw`,

          // Build command
          ...(buildScript ? [`${buildScript}:/entrypoint.sh:ro`] : []),

          // Output
          `${outputDir}:/output:rw`,

          // Caches
          `project_cache_${ref}:/code/target:rw`,
          `cargo_cache_${ref}:/usr/local/cargo:rw`,
        ]
      },
      Env: [
        'CARGO_NET_GIT_FETCH_WITH_CLI=true',
        'CARGO_TERM_VERBOSE=true',
        'CARGO_HTTP_TIMEOUT=240'
      ]
    }

    console.debug(
      `Running ${bold(buildCommand)} in ${bold(buildImage)} with the following options:`,
      buildArgs
    )

    const [{ Error:err, StatusCode:code }, container] = await docker.run(
      buildImage,
      buildCommand,
      process.stdout,
      buildArgs
    )

    await container.remove()
    if (err) throw err
    if (code !== 0) throw new Error(`build of ${crate} exited with status ${code}`)

    return artifact

  } finally {

    if (tmpDir) rimraf(tmpDir.name)

  }

}

async function uploadFromFS (
  uploader:          IAgent,
  artifact:          string,
  uploadReceiptPath: string,
  forceReupload = false
  // TODO: flag to force reupload
) {

  if (existsSync(uploadReceiptPath) && !forceReupload) {

    const receiptData = await readFile(uploadReceiptPath, 'utf8')
    console.info(`${bold(relative(process.cwd(), uploadReceiptPath))} exists, delete to reupload`)
    return JSON.parse(receiptData)

  } else {

    console.info(`Uploading ${bold(artifact)}`)
    const uploadResult = await uploader.upload(artifact)
    const receiptData  = JSON.stringify(uploadResult, null, 2)
    const elements     = uploadReceiptPath.slice(1, uploadReceiptPath.length).split('/');

    let path = `/`
    for (const item of elements) {
      if (!existsSync(path)) mkdir(path)
      path += `/${item}`
    }

    await writeFile(uploadReceiptPath, receiptData, 'utf8')

    await uploader.nextBlock
    return uploadResult

  }

}

export async function instantiateContract (contract: ContractClient): Promise<InitTX> {
  const { address, codeId, instantiator, initMsg } = contract

  if (address) {
    throw new Error(`This contract has already been instantiated at ${address}`)
  } else {

    if (!codeId) {
      throw new Error('Contract must be uploaded before instantiating')
    }

    return await backOff(
      ()=>instantiator.instantiate(contract, initMsg),
      initBackOffOptions
    )

  }

}

export const initBackOffOptions = {
  retry (error: Error, attempt: number) {
    if (error.message.includes('500')) {
      console.warn(`Error 500, retry #${attempt}...`)
      console.error(error)
      return true
    } else {
      return false
    }
  }
}

export const txBackOffOptions = {
  retry (error: Error, attempt: number) {
    if (error.message.includes('500')) {
      console.warn(`Error 500, retry #${attempt}...`)
      console.warn(error)
      return false
    }
    if (error.message.includes('502')) {
      console.warn(`Error 502, retry #${attempt}...`)
      console.warn(error)
      return true
    }
    return false
  }
}
