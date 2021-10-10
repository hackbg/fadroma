import type {
  IChain, IAgent, IContract,
  ContractCodeOptions,
  ContractUploadOptions,
  ContractInitOptions,
  ContractAPIOptions
} from './Model'
import { BaseAgent, isAgent } from './Agent'
import { BaseChain, ChainInstancesDir } from './Chain'
import { getAjv, SchemaFactory } from './Schema'

import {
  resolve, existsSync, Docker, pulled, Console,
  readFile, bold, relative, basename, mkdir, writeFile,
} from '@fadroma/tools'

import { backOff } from 'exponential-backoff'

export const attachable =
  (Constructor: new (options: any) => IContract) =>
    (address: string, codeHash: string, agent: IAgent) => {
      const instance = new Constructor({})
      instance.init.agent = agent
      instance.init.address = address
      instance.blob.codeHash = codeHash
      return instance
    }

const console = Console(import.meta.url)

export abstract class ContractCode {

  abstract buildImage:  string
  abstract buildScript: string

  code: ContractCodeOptions = {}

  constructor (options: ContractCodeOptions = {}) {
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
        , outputDir = resolve(this.workspace, 'artifacts')
        , artifact  = resolve(outputDir, `${this.crate}@${ref}.wasm`)

    if (!existsSync(artifact)) {

      console.debug(`building working tree at ${this.workspace} into ${outputDir}...`)

      const [
        { Error:err, StatusCode:code },
        container
      ] = await this.docker.run(
        await pulled(this.buildImage, this.docker),
        `bash /entrypoint.sh ${this.crate} ${ref}`,
        process.stdout,
        this.getBuildArgs(ref, resolve(this.workspace, 'artifacts'), extraBinds)
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
    const buildArgs = {
      Tty:         true,
      AttachStdin: true,
      Entrypoint:  ['/bin/sh', '-c'],
      Env: [
        'CARGO_NET_GIT_FETCH_WITH_CLI=true',
        'CARGO_TERM_VERBOSE=true',
        'CARGO_HTTP_TIMEOUT=240'
      ],
      HostConfig: {
        Binds: [
          `${this.buildScript}:/entrypoint.sh:ro`,
          `${outputDir}:/output:rw`,
          `project_cache_${ref}:/code/target:rw`,
          `cargo_cache_${ref}:/usr/local/cargo:rw`,
          `${this.workspace}:/contract:rw`
        ]
      }
    }
    extraBinds?.forEach(bind=>buildArgs.HostConfig.Binds.push(bind))
  }
}

const {info} = Console(import.meta.url)

export abstract class ContractUpload extends ContractCode {

  blob: {
    agent?:    IAgent
    chain?:    IChain
    codeId?:   number
    codeHash?: string
    receipt?: {
      codeId:             number
      compressedChecksum: string
      compressedSize:     string
      logs:               any[]
      originalChecksum:   string
      originalSize:       number
      transactionHash:    string
    }
  } = {}

  constructor (options?: ContractUploadOptions) {
    super(options)
    this.blob.agent    = options?.agent
    this.blob.chain    = options?.chain || options?.agent?.chain
    this.blob.codeId   = options?.codeId
    this.blob.codeHash = options?.codeHash
  }

  /** The chain where the contract is deployed. */
  get chain () { return this.blob.chain }
  /** The agent that deployed the contract. */
  get uploader () { return this.blob.agent }
  /** The result of the upload transaction. */
  get uploadReceipt () { return this.blob.receipt }
  /** Path to where the result of the upload transaction is stored */
  get uploadReceiptPath () { return this.chain.uploads.resolve(`${basename(this.artifact)}.json`) }
  /** The auto-incrementing id of the uploaded code */
  get codeId () { return this.blob.codeId }
  /** The auto-incrementing id of the uploaded code */
  get codeHash () { return this.blob.codeHash||this.code.codeHash }
  /** Code ID + code hash pair in Sienna Swap Factory format */
  get template () { return { id: this.codeId, code_hash: this.codeHash } }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload (chainOrAgent?: IAgent|IChain) {
    // resolve chain/agent references
    if (chainOrAgent instanceof BaseChain) {
      this.blob.chain = chainOrAgent as IChain
      this.blob.agent = await this.blob.chain.getAgent()
    } else if (chainOrAgent instanceof BaseAgent) {
      this.blob.agent = chainOrAgent as IAgent
      this.blob.chain = this.blob.agent.chain
    } else if (!this.blob.agent) {
      throw new Error('You must provide a Chain or Agent to use for deployment')
    }

    // build if not already built
    if (!this.artifact) await this.build()

    // upload if not already uploaded
    // TODO: flag to force reupload
    if (existsSync(this.uploadReceiptPath)) {
      const receiptData = await readFile(this.uploadReceiptPath, 'utf8')
      info(`${bold(relative(process.cwd(), this.uploadReceiptPath))} exists, delete to reupload`)
      this.blob.receipt = JSON.parse(receiptData) }
    else {
      const uploadResult = await this.uploader.upload(this.artifact)
          , receiptData  = JSON.stringify(uploadResult, null, 2)
          , elements     = this.uploadReceiptPath.slice(1, this.uploadReceiptPath.length).split('/');
      let path = `/`
      for (const item of elements) {
        if (!existsSync(path)) mkdir(path)
        path += `/${item}` }
      await writeFile(this.uploadReceiptPath, receiptData, 'utf8')
      this.blob.receipt = uploadResult
      await this.uploader.nextBlock }

    // set code it and code hash to allow instantiation of uploaded code
    this.blob.codeId   = this.uploadReceipt.codeId
    this.blob.codeHash = this.uploadReceipt.originalChecksum
    return this.blob.receipt
  }
}

export abstract class ContractInit extends ContractUpload {
  init: {
    prefix?:  string
    agent?:   IAgent
    address?: string
    label?:   string
    msg?:     any
    tx?: {
      contractAddress: string
      data:            string
      logs:            any[]
      transactionHash: string
    }
  } = {}

  constructor (options: ContractInitOptions = {}) {
    super(options)
    if (options.prefix)  this.init.prefix  = options.prefix
    if (options.label)   this.init.label   = options.label
    if (options.agent)   this.init.agent   = options.agent
    if (options.address) this.init.address = options.address
    if (options.initMsg) this.init.msg     = options.initMsg
  }

  /** The agent that initialized this instance of the contract. */
  get instantiator () { return this.init.agent }

  /** The on-chain address of this contract instance */
  get address () { return this.init.address }

  /** A reference to the contract in the format that ICC callbacks expect. */
  get link () { return { address: this.address, code_hash: this.codeHash } }

  /** A reference to the contract as an array */
  get linkPair () { return [ this.address, this.codeHash ] as [string, string] }

  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is appended to the label. */
  get label () {
    return this.init.prefix
      ? `${this.init.prefix}/${this.init.label}`
      : this.init.label
  }

  /** The message that was used to initialize this instance. */
  get initMsg () { return this.init.msg }

  /** The response from the init transaction. */
  get initTx () { return this.init.tx }

  /** The full result of the init transaction. */
  get initReceipt () {
    return {
      label:    this.label,
      codeId:   this.codeId,
      codeHash: this.codeHash,
      initTx:   this.initTx
    }
  }

  private initBackoffOptions = {
    retry (error: any, attempt: number) {
      if (error.message.includes('500')) {
        console.warn(`Error 500, retry #${attempt}...`)
        console.error(error)
        return true
      } else {
        return false
      }
    }
  }

  private initBackoff (fn: ()=>Promise<any>) {
    return backOff(fn, this.initBackoffOptions)
  }

  async instantiate (agent?: IAgent) {
    if (!this.address) {
      if (agent) this.init.agent = agent
      if (!this.codeId) throw new Error('Contract must be uploaded before instantiating')
      this.init.tx = await this.initBackoff(()=>
        this.instantiator.instantiate(this.codeId, this.label, this.initMsg))
      this.init.address = this.initTx.contractAddress
      this.save()
    } else if (this.address) {
      throw new Error(`This contract has already been instantiated at ${this.address}`)
    }
    return this.initTx
  }

  async instantiateOrExisting (receipt: any, agent?: IAgent) {
    if (receipt) {
      this.blob.codeHash = receipt.codeHash
      this.init.address  = receipt.initTx.contractAddress
      this.init.label    = receipt.label.split('/')[1]
      if (agent) this.init.agent = agent
      console.info(`${this.label}: already exists at ${this.address}`)
      return receipt
    } else {
      return await this.instantiate(agent)
    }
  }

  /** Used by Ensemble to save multiple instantiation receipts in a subdir. */
  setPrefix (prefix: string) {
    this.init.prefix = prefix
    return this
  }

  /** Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  save () {
    let dir = this.init.agent.chain.instances
    if (this.init.prefix) dir = dir.subdir(this.init.prefix, ChainInstancesDir).make()
    dir.save(this.init.label, this.initReceipt)
    return this
  }
}

export abstract class ContractCaller extends ContractInit {

  private backoffOptions = {
    retry (error: any, attempt: number) {
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

  private backoff (fn: ()=>Promise<any>) {
    return backOff(fn, this.backoffOptions)
  }

  /** Query the contract. */
  query (method = "", args = null, agent = this.instantiator) {
    return this.backoff(() => agent.query(this, method, args))
  }

  /** Execute a contract transaction. */
  execute (
    method         = "",
    args           = null,
    memo:   string = '',
    amount: any[]  = [],
    fee:    any    = undefined,
    agent:  IAgent = this.instantiator
  ) {
    return this.backoff(() => agent.execute(this, method, args, memo, amount, fee))
  }

  /** Create a temporary copy of a contract with a different agent.
    * FIXME: Broken - see uploader/instantiator/admin */
  copy = (agent: IAgent) => {
    let addon = {};
    if (isAgent(agent)) {
      // @ts-ignore
      addon.init = {...this.init, agent};
    }
    return Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      addon
    );
  };

}

/** A contract with auto-generated methods for invoking
 *  queries and transactions */
export abstract class ContractAPI extends ContractCaller implements IContract {
  protected schema: {
    initMsg?:        any
    queryMsg?:       any
    queryResponse?:  any
    handleMsg?:      any
    handleResponse?: any
  } = {}

  #ajv = getAjv()

  private validate: {
    initMsg?:        Function
    queryMsg?:       Function
    queryResponse?:  Function
    handleMsg?:      Function
    handleResponse?: Function
  } = {}

  q:  Record<string, Function>
  tx: Record<string, Function>

  constructor (options: ContractAPIOptions = {}) {
    super(options)
    if (options.schema) this.schema = options.schema
    this.q  = new SchemaFactory(this, this.schema?.queryMsg).create()
    this.tx = new SchemaFactory(this, this.schema?.handleMsg).create()
    for (const msg of ['initMsg', 'queryMsg', 'queryResponse', 'handleMsg', 'handleResponse']) {
      if (this.schema[msg]) this.validate[msg] = this.#ajv.compile(this.schema[msg])
    }
  }
}

//export class ContractWithSchema extends BaseContractAPI {
  //q:  Record<string, Function>
  //tx: Record<string, Function>
  //constructor(agent: Agent, options: any = {}, schema: any) {
    //if (schema && schema.initMsg) {
      //const ajv = getAjv();
      //const validate = ajv.compile(schema.initMsg);
      //if (!validate(options.initMsg)) {
        //const err = JSON.stringify(validate.errors, null, 2)
        //throw new Error(`Schema validation for initMsg returned an error: \n${err}`); } }
    //super(agent)
    //this.q  = new SchemaFactory(schema.queryMsg,  this).create()
    //this.tx = new SchemaFactory(schema.handleMsg, this).create() } }
