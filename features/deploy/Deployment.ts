/** A collection of contracts. */
import {
  CompiledCode,
  Console,
  Contract,
  Logged,
  RustSourceCode,
  SourceCode,
  UploadStore,
  UploadedCode,
  assign,
  bold,
  hideProperties,
  timestamp,
} from '@hackbg/fadroma'
import type {
  Address,
  Agent,
  ChainId,
  CodeHash,
  CodeId,
  Compiler,
  Into,
  Label,
  Message,
  Name,
  Token,
  TxHash,
} from '@hackbg/fadroma'
import {
  ContractLifecycle,
  Unit,
  UploadUnit,
  InstantiateUnit,
} from './DeploymentUnits'

export type DeploymentState = Partial<ReturnType<Deployment["serialize"]>>

export class Deployment extends Map<Name, Unit> {
  log = new Console('Deployment')

  name: string = timestamp()

  static fromSnapshot ({ name, units = {} }: DeploymentState) {
    const deployment = new this({ name })
    for (const [key, value] of Object.entries(units)) {
      deployment.set(key, value)
    }
    return deployment
  }

  constructor (properties: Partial<Deployment> = {}) {
    super()
    assign(this, properties, [ 'name' ])
    this.name ??= timestamp()
    this.log.label = `deployment(${bold(this.name)})`
  }

  serialize () {
    const units: Record<Name, ReturnType<Unit["serialize"]>> = {}
    for (const [key, value] of this.entries()) {
      units[key] = value.serialize()
    }
    return { name: this.name, units: Object.fromEntries(this.entries()) }
  }

  set (name: string, unit: Unit): this {
    if (!(unit instanceof Unit)) {
      throw new Error('a Deployment can only contain instances of Unit')
    }
    return super.set(name, unit)
  }

  /** Define a template, representing code that can be compiled
    * and uploaded, but will not be automatically instantiated.
    * This can then be used to define multiple instances of
    * the same code. */
  template (name: string, properties?:
    (
      |({ language: 'rust' } & Partial<RustSourceCode>)
      |({ language?: undefined } & Partial<SourceCode>)
    )&
    Partial<CompiledCode> &
    Partial<UploadedCode>
  ): UploadUnit {
    const source =
      properties?.language === 'rust' ? new RustSourceCode(properties)
        : new SourceCode(properties)
    const compiled = new CompiledCode(properties)
    const uploaded = new UploadedCode(properties)
    const unit = new UploadUnit({
      deployment: this, name, source, compiled, uploaded
    })
    hideProperties(unit, 'name', 'deployment', 'isTemplate')
    this.set(name, unit)
    return unit
  }

  /** Define a contract that will be automatically compiled, uploaded,
    * and instantiated as part of this deployment. */ 
  contract (name: string, properties?:
    (
      |({ language: 'rust' } & Partial<RustSourceCode>)
      |({ language?: undefined } & Partial<SourceCode>)
    )&
    Partial<CompiledCode> &
    Partial<UploadedCode> &
    Partial<InstantiateUnit>
  ): InstantiateUnit {
    const source =
      properties?.language === 'rust' ? new RustSourceCode(properties)
        : new SourceCode(properties)
    const compiled = new CompiledCode(properties)
    const uploaded = new UploadedCode(properties)
    const unit = new InstantiateUnit({
      deployment: this, name, source, compiled, uploaded, ...properties
    })
    hideProperties(unit, 'name', 'deployment', 'isTemplate')
    this.set(name, unit)
    return unit
  }

  addContract (...args: Parameters<this["contract"]>) {
    this.contract.apply(this, args)
    return this
  }

  addContracts (...args: Parameters<this["template"]>) {
    this.template.apply(this, args)
    return this
  }

  async build ({ units = [...this.keys()], ...options }: Parameters<ContractLifecycle["compile"]>[0] & {
    units?: Name[]
  } = {}):
    Promise<Record<CodeHash, CompiledCode & { codeHash: CodeHash }>>
  {
    const toCompile: Array<Unit & { source: SourceCode }> = []

    if (units && units.length > 0) {
      for (const name of units) {
        const unit = this.get(name)
        if (!unit) {
          throw new Error(`requested to build unknown unit "${unit}"`)
        }
        if (!unit.source?.status().canCompile && unit.compiled?.status().canUpload) {
          this.log.warn(`Missing source for ${bold(name)} (${unit.compiled.codeHash})`)
        } else {
          toCompile.push(unit as Unit & { source: SourceCode })
        }
      }
    }

    const compiled = await options.compiler!.buildMany(toCompile.map(unit=>unit.source!))

    const byCodeHash: Record<CodeHash, CompiledCode & { codeHash: CodeHash }> = {}

    for (const index in compiled) {
      const output = compiled[index]
      if (!output.codeHash) {
        throw new Error('build output did not contain codeHash')
      }
      toCompile[Number(index)].compiled = output
      byCodeHash[output.codeHash] = output as CompiledCode & { codeHash: CodeHash }
    }

    return byCodeHash
  }

  async upload ({ units, ...options }: Parameters<ContractLifecycle["upload"]>[0] & {
    units?: Name[]
    uploadStore?: UploadStore
  } = {}):
    Promise<Record<CodeId, UploadedCode & { codeId: CodeId }>>
  {
    const uploading: Array<Promise<UploadedCode & { codeId: CodeId }>> = []
    for (const [name, unit] of this.entries()) {
      uploading.push(unit.upload(options))
    }
    const uploaded: Record<CodeId, UploadedCode & { codeId: CodeId }> = {}
    for (const output of await Promise.all(uploading)) {
      uploaded[output.codeId] = output
    }
    return uploaded
  }

  async deploy ({ units, ...options }: Parameters<InstantiateUnit["deploy"]>[0] & {
    units?: Name[],
    deployStore?: DeployStore
  } = {}):
    Promise<Record<Address, InstantiateUnit & { address: Address }>>
  {
    const deploying: Array<Promise<InstantiateUnit & { address: Address }>> = []
    for (const [name, unit] of this.entries()) {
      if (unit instanceof InstantiateUnit) {
        deploying.push(unit.deploy(options))
      }
    }
    const deployed: Record<Address, InstantiateUnit & { address: Address }> = {}
    for (const output of await Promise.all(deploying)) {
      deployed[output.address] = output
    }
    return deployed
  }
}

