import type {
  IChain, IAgent, IContract,
  ContractConstructor,
  ContractConstructorArguments,
  ContractBuild, ContractBuildState,
  ContractUpload, ContractUploadState, UploadReceipt,
  ContractClient, ContractClientState, InitTX, InitReceipt, ContractMessage,
} from './Model'
import { BaseAgent, isAgent } from './Agent'
import { BaseChain } from './Chain'
import { Deployment, DeploymentDir } from './Deployment'
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

const console = Console('@fadroma/ops/Contract')

export abstract class DockerizedContractBuild implements ContractBuild {

  constructor (options: ContractBuildState = {}) {
    for (const key of Object.keys(options)) {
      this[key] = options[key]
    }
  }

  // build environment
  abstract buildImage:      string|null
  abstract buildDockerfile: string|null
  abstract buildScript:     string|null

  // build inputs
  repo?:      string
  ref?:       string
  workspace?: string
  crate?:     string

  // build outputs
  artifact?: string
  codeHash?: string

  /** Build the contract in the default dockerized build environment for its chain.
    * Need access to Docker daemon. */
  async buildInDocker (socketPath = '/var/run/docker.sock'): Promise<string> {
    this.artifact = await buildInDocker(new Docker({ socketPath }), this)
    return this.artifact
  }

  /** Build the contract outside Docker.
    * Assume a standard toolchain is present in the script's environment. */
  async buildRaw (): Promise<string> {

    if (this.ref && this.ref !== 'HEAD') {
      throw new Error('[@fadroma/ops/Contract] non-HEAD builds unsupported outside Docker')
    }

    const run = (cmd: string, ...args: string[]) =>
      spawnSync(cmd, args, {
      cwd: this.workspace,
      stdio: 'inherit',
      env: { RUSTFLAGS: '-C link-arg=-s' }
    })

    run('cargo',
        'build', '-p', this.crate,
        '--target', 'wasm32-unknown-unknown',
        '--release',
        '--locked',
        '--verbose')

    run('wasm-opt',
        '-Oz', './target/wasm32-unknown-unknown/release/$Output.wasm',
        '-o', '/output/$FinalOutput')

    run('sh', '-c',
        "sha256sum -b $FinalOutput > $FinalOutput.sha256")

    return this.artifact

  }

}

export abstract class FSContractUpload extends DockerizedContractBuild implements ContractUpload {

  constructor (options: ContractBuildState & ContractUploadState = {}) {
    super(options)
  }

  // upload inputs
  artifact?:      string
  codeHash?:      string
  chain?:         IChain
  uploader?:      IAgent

  // upload outputs
  codeId?:        number
  uploadReceipt?: UploadReceipt

  /** Code ID + code hash pair in Sienna Swap Factory format */
  get template () {
    return {
      id: this.codeId,
      code_hash: this.codeHash
    }
  }

  /** Path to where the result of the upload transaction is stored */
  get uploadReceiptPath () {
    const name = `${basename(this.artifact)}.json`
    return this.chain.uploads.resolve(name)
  }

  async uploadAs (agent: IAgent): Promise<this> {
    this.uploader = agent
    return this.uploadTo(agent.chain)
  }

  async uploadTo (chain: IChain): Promise<this> {
    this.chain = chain
    await this.upload()
    return this
  }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload () {
    // if no uploader, bail
    if (!this.uploader) {
      throw new Error(
        `[@fadroma/ops/Contract] contract.upload() requires contract.uploader to be set`
      )
    }
    // if not built, build
    if (!this.artifact) {
      await this.buildInDocker()
    }
    // upload if not already uploaded
    const uploadReceipt = await uploadFromFS(
      this.uploader,
      this.artifact,
      this.uploadReceiptPath
    )
    this.uploadReceipt = uploadReceipt
    // set code it and code hash to allow instantiation of uploaded code
    this.codeId   = uploadReceipt.codeId
    this.codeHash = uploadReceipt.originalChecksum
    return this.uploadReceipt
  }
}

export abstract class BaseContractClient extends FSContractUpload implements ContractClient {

  constructor (
    options: ContractBuildState & ContractUploadState & ContractClientState & {
      admin?: IAgent
    } = {}
  ) {
    super(options)
    if (options.admin) {
      this.agent        = options.admin
      this.uploader     = options.admin
      this.instantiator = options.admin
    }
  }

  // init inputs
  chain?:        IChain
  codeId?:       number
  codeHash?:     string
  name?:         string
  prefix?:       string
  suffix?:       string
  instantiator?: IAgent

  /** The contents of the init message that creates a contract. */
  initMsg?: Record<string, any> = {}

  /** The default agent for queries/transactions. */
  agent?: IAgent

  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is prepended to the label. */
  get label (): string {
    if (!this.name) {
      throw new Error(
        '[@fadroma/contract] Tried to get label of contract with missing name.'
      )
    }
    let label = this.name
    if (this.prefix) label = `${this.prefix}/${this.name}`
    if (this.suffix) label = `${label}${this.suffix}`
    return label
  }

  /** Manually setting the label is disallowed.
    * Instead, impose prefix-name-suffix scheme. */
  set label (label: string) {
    throw new Error(
      "[@fadroma/contract] Tried to overwrite `contract.label`. "+
      "Don't - use the `prefix`, `name`, and `suffix`. properties instead"
    )
  }

  // init outputs
  address?:     string
  initTx?:      InitTX
  initReceipt?: InitReceipt

  /** A reference to the contract in the format that ICC callbacks expect. */
  get link () { return { address: this.address, code_hash: this.codeHash } }

  /** A reference to the contract as an array */
  get linkPair () { return [ this.address, this.codeHash ] as [string, string] }

  /** Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  save () {
    let dir = this.chain.deployments
    if (this.prefix) {
      dir = dir.subdir(this.prefix, DeploymentDir).make() as DeploymentDir
    }
    dir.save(`${this.name}${this.suffix||''}`, this.initReceipt)
    return this
  }

  async instantiateOrExisting (
    receipt?: InitReceipt,
    agent?:   IAgent
  ): Promise<InitReceipt> {
    if (!receipt) {
      return await this.instantiate()
    } else {
      if (agent) this.instantiator = agent
      console.info(bold(`Contract already exists:`), this.label)
      console.info(`- On-chain address:`,      bold(receipt.initTx.contractAddress))
      console.info(`- On-chain code hash:`,    bold(receipt.codeHash))
      this.setFromReceipt(receipt)
      return receipt
    }
  }

  async instantiate (): Promise<InitReceipt> {
    this.setFromReceipt(this.initReceipt = {
      label:    this.label,
      codeId:   this.codeId,
      codeHash: this.codeHash,
      initTx:   this.initTx = await instantiateContract(this)
    })
    this.save()
    return this.initReceipt
  }

  private setFromReceipt (receipt: InitReceipt) {
    this.name     = receipt.label.split('/')[1]
    this.codeId   = receipt.codeId
    if (this.codeHash && this.codeHash !== receipt.codeHash) {
      console.warn(
        `Receipt contained code hash: ${bold(receipt.codeHash)}, `+
        `while contract class contained: ${bold(this.codeHash)}. `+
        `Will use the one from the receipt from now on.`
      )
    }
    this.codeHash = receipt.codeHash
    this.initTx   = receipt.initTx
    this.address  = receipt.initTx.contractAddress
    return receipt
  }

  from (deployment: Deployment) {
    const receipt = deployment.contracts[this.name]
    if (!receipt) {
      throw new Error(
        `[@fadroma/ops/Contract] no contract ${this.name} in ${deployment.prefix}`
      )
    }
    this.setFromReceipt(receipt)
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
      throw new Error('[@fadroma/ops] define the Transactions property to use this method')
    }
    return new (this.Transactions)(this, agent)
  }

  /** Class implementing query methods. */
  Queries?: new (contract: IContract, agent: IAgent) => Querier

  /** Get a Queries instance bound to the current contract and agent */
  q (agent: IAgent = this.instantiator) {
    if (!this.Queries) {
      throw new Error('[@fadroma/ops] define the Queries property to use this method')
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

/** Compile a contract from source */
// TODO support clone & build contract from external repo+ref
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
    throw new Error(`[@fadroma/ops] Missing workspace path (crate ${crate} at ${ref})`)
  }

  const run = (cmd: string, ...args: string[]) =>
    spawnSync(cmd, args, { cwd: workspace, stdio: 'inherit' })

  let tmpDir

  try {
    const outputDir = resolve(workspace, 'artifacts')
    const artifact  = resolve(outputDir, `${crate}@${ref}.wasm`)
    if (existsSync(artifact)) {
      console.info(bold(`Build artifact exists (delete it to rebuild):`), relative(process.cwd(), artifact))
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
    if (code !== 0) throw new Error(`[@fadroma/ops] Build of ${crate} exited with status ${code}`)

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

    console.info(
      bold(`Upload receipt exists (delete it to reupload):`),
      relative(process.cwd(), uploadReceiptPath)
    )

    return JSON.parse(receiptData)

  } else {

    console.info(bold(`Uploading`), artifact)

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

  if (contract.address) {
    throw new Error(`[@fadroma/ops] This contract has already been instantiated at ${address}`)
  } else {

    const {
      label,
      codeId,
      instantiator = contract.admin || contract.agent,
      initMsg
    } = contract

    console.info(`Creating ${bold(label)} from ${bold(`code id ${codeId}`)}...`)

    if (!codeId) {
      throw new Error('[@fadroma/ops] Contract must be uploaded before instantiating (missing `codeId` property)')
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
