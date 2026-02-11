/**
  Fadroma for CosmWasm
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import { Error } from '../../library/Err.ts'
import { Log } from '../../library/Log.ts'
import type { Fee, Coin, ChainId, ChainRef, Address, Hash } from '../Tendermint/Tendermint.ts';

export default CosmWasm;
function CosmWasm () {}
interface CosmWasm {};
namespace CosmWasm {

  /** A code ID, identifying uploaded code on a chain. */
  export type CodeId       = string|number;

  /** The hash of a contract's code. */
  export type CodeHash     = string;

  /** A contract's full unique on-chain label. */
  export type Label        = string;

  /** A transaction message that can be sent to a contract. */
  export type Message      = string|number|boolean|Record<string, unknown>;

  /** The source code of a contract. */
  export type SourceCode   = { /** URL pointing to Git upstream containing the canonical source code. */
                               upstream?:  string|URL
                             , /** Pointer to the source commit. */
                               reference?: string
                             , /** Path to local checkout of the source code (with .git directory if sourceRef is set). */
                               checkout?:  string
                             , /** Whether the code contains uncommitted changes. */
                               modified?:  boolean };

  /** A binary file somewhere. */
  export type CompiledCode = { /** Location of the compiled code. */
                               codePath?: string|URL
                             , /** The compiled code. */
                               codeData?: Uint8Array
                             , /** Checksum uniquely identifying the compiled code. */
                               codeHash?: CodeHash } & Partial<SourceCode>;

  /** A code upload to a given chain, represented by a code ID. */
  export type UploadedCode = { chain:      ChainRef
                             , /** Code ID representing the identity of the contract's code on a specific chain. */
                               codeId:     CodeId
                             , /** Signer of the upload transaction. */
                               uploadBy?:  Address
                             , /** Hash to the upload transaction. */
                               uploadTx?:  Hash
                             , /** Gas used during the upload. */
                               uploadGas?: Uint128 } & Partial<CompiledCode>;

  /** A Map that caches contract uploads, so that the same contract isn't uploaded multiple times. */
  export type UploadStore  = Map<CodeHash, UploadedCode>;

  /** A contract instance on a given chain. */
  export type Contract     = { initBy?: Address
                             , address: Address
                             , label:   string } & Partial<UploadedCode>;

  /** Available CosmWasm API methods. */
  export type Api          = { log:                Console
                             , fetchSource?:       FetchSource
                             , compile?:           Compile
                             , upload:             Upload
                             , fetchCodeInfo:      FetchCodeInfo
                             , fetchCodeInstances: FetchCodeInstances
                             , instantiate:        Instantiate
                             , fetchContractInfo:  FetchContractInfo
                             , query:              Query
                             , execute:            Execute } & BaseApi;

  /** Query a contract. */
  export type Query        = <T>(_: { address:   Address
                                    , codeHash?: string
                                    , message:   Message }) => Promise<T>;
  /** Execute a contract transaction. */
  export type Execute      = <T>(_: { address:   Address
                                    , codeHash?: string
                                    , message:   Message
                                    , execFee?:  Fee
                                    , execSend?: Coin[]
                                    , execMemo?: string }) => Promise<T>;

  export type ClientApi    = { /** The selected contract's address. */
                               address:   Address
                             , /** The selected contract's code hash. */
                               codeHash?: CodeHash
                             , /** Query the selected contract. */
                               querySelf <T> (message: Message): Promise<T>
                             , /** Execute a contract transaction on the selected contract. */
                               execSelf  <T> (message: Message, options?: {
                                 fee?: Fee, send?: Coin[], memo?: string
                               }): Promise<T> } & Api;

  /** Something that can fetch SourceCode from e.g. the filesystem, or a URL. */
  export type FetchSource =
    &((source: URL)                 => Promise<SourceCode>)
    &((source: string)              => Promise<SourceCode>)
    &((source: Partial<SourceCode>) => Promise<SourceCode>);

  /** Compile method signatures. */
  export type Compile =
    & ((source: URL)                   => Promise<CompiledCode>)
    & ((source: string)                => Promise<CompiledCode>)
    & ((source: Partial<CompiledCode>) => Promise<CompiledCode>);

  /** Upload method signatures. */
  export type Upload =
    & ((source: URL)                   => Promise<UploadedCode>)
    & ((source: string)                => Promise<UploadedCode>)
    & ((source: Uint8Array)            => Promise<UploadedCode>)
    & ((source: Partial<UploadedCode>) => Promise<UploadedCode>)
    & (((parameters: UploadParameters) => Promise<Partial<UploadedCode & { chainId: ChainId, codeId:  CodeId }>>));

  export type UploadParameters = { binary:       Uint8Array
                                 , reupload?:    boolean
                                 , uploadStore?: UploadStore
                                 , uploadFee?:   Fee
                                 , uploadMemo?:  string };

  /** Something that can instantiate UploadedCode to get a Contract instance,
    * e.g. that Chain's respective Agent. */
  export type FetchCodeInfo =
    & ((codeId:   CodeId,  options?: { parallel?: boolean }) => Promise<UploadedCode>)
    & (()                                                    => Promise<Record<CodeId, UploadedCode>>)
    & ((codeIds: [CodeId], options?: { parallel?: boolean }) => Promise<Record<CodeId, UploadedCode>>)

  export type FetchCodeInfoImpl =
    (args?: {codeIds?: CodeId[], parallel?: boolean}) => Promise<Record<CodeId, UploadedCode>>

  export type Instantiate =
    & ((codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee)           => Promise<Contract>)
    & ((args: { codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee }) => Promise<Contract>)
    & ((parameters: Partial<Contract> & InstantiateOptions)                              => Promise<Contract & { address: Address }>)

  export type InstantiateOptions = { initMsg:   Into<Message>
                                   , initFee?:  Fee
                                   , initSend?: Coin[]
                                   , initMemo?: string };

  export type FetchCodeInstances =
    & (()                                                            => Promise<Record<Address, Contract>>)
    & ((codeId:  CodeId)                                             => Promise<Record<Address, Contract>>)
    & ((codeIds: Iterable<CodeId>, options?: { parallel?: boolean }) => Promise<Record<CodeId, Record<Address, Contract>>>);

  export type FetchCodeInstancesImpl =
    (args?: {codeIds?: CodeId[], parallel?: boolean}) => Promise<Record<CodeId, Record<Address, Contract>>>;

  export type FetchContractInfo =
    & ((address:   Address)                                     => Promise<Contract>)
    & ((addresses: Address[], options?: { parallel?: boolean }) => Promise<Record<Address, Contract>>);


  /** A CosmWasm error. */
  export class Error extends BaseError {}

  /** A CosmWasm logger. */
  export class Console extends BaseConsole {}

  export const fetchSource: FetchSource = (...args: unknown[]) =>
    { throw new Error('todo!') }

  export const compile: Compile = (...args: unknown[]): Promise<CompiledCode> =>
    { throw new Error('todo!') }

  export const upload = (...args: unknown[]): Promise<UploadedCode> =>
    { throw new Error('todo!') }

  //export const upload = async ({ log, agent }: Context,
    //code: string|URL|Uint8Array|Partial<CompiledCode>,
    //options?: Omit<Parameters<Api["upload"]>[0], 'binary'>,
  //) => {
    //let template: Uint8Array
    //if (code instanceof Uint8Array) {
      //template = code
    //} else {
      //const { CompiledCode } = _$_HACK_$_
      //if (typeof code === 'string' || code instanceof URL) {
        //code = new CompiledCode({ codePath: code })
      //} else {
        //code = new CompiledCode(code)
      //}
      //const t0 = performance.now()
      //code = code as CompiledCode
      //template = await (code as any).fetch()
      //const t1 = performance.now() - t0
      //log.log(
        //`Fetched in`, `${bold((t1/1000).toFixed(6))}s: code hash`,
        //bold(code.codeHash), `(${bold(String(code.codeData?.length))} bytes`
      //)
    //}
    //log.debug(`Uploading ${bold((code as any).codeHash)}`)
    //const result = await timed(
      //() => agent.getConnection().uploadImpl({
        //...options,
        //binary: template
      //}),
      //({elapsed, result}: any) => log.debug(
        //`Uploaded in ${bold(elapsed)}:`,
        //`code with hash ${bold(result.codeHash)} as code id ${bold(String(result.codeId))}`,
      //))
    //return ({ ...template, ...result as any }) as UploadedCode & {
      //chainId: ChainId
      //codeId:  CodeId
    //}
  //}
  export const fetchCodeInfo = (
    { log }: Api, impl: FetchCodeInfoImpl, ...args: Parameters<FetchCodeInfo>|[]
  ) => log.timed('fetchCodeInfo', () => impl({
    codeIds: zeroOrMore(args[0]),
    parallel: args[1]?.parallel
  }))
  export const instantiate = (...args: unknown[]): Promise<Contract> =>
    { throw new Error('todo!') }
  export const fetchCodeInstances = ({ log }: Api, impl: FetchCodeInstancesImpl, ...args: Parameters<FetchCodeInstances>[]) =>
    { throw new Error('todo!') }
  //export const fetchCodeInstances = (
    //chain: Chain, ...args: Parameters<Chain["fetchCodeInstances"]>
  //) =>  {
      //let $C = Contract
      //let custom = false
      //if (typeof args[0] === 'function') {
        //$C = args.shift() as typeof Contract
        //custom = true
      //}
      //if (!args[0]) {
        //throw new Error('Invalid arguments')
      //}

      //if ((args[0] as any)[Symbol.iterator]) {
        //const result: Record<CodeId, Record<Address, Contract>> = {}
        //const codeIds: Record<CodeId, typeof $C> = {}
        //for (const codeId of args[0] as unknown as CodeId[]) {
          //codeIds[codeId] = $C
        //}
        //chain.log.debug(`Querying contracts with code ids ${Object.keys(codeIds).join(', ')}...`)
        //return timed(function doFetchCodeInstances () {
          //return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
        //}, function afterFetchCodeInstances ({elapsed}) {
          //chain.log.debug(`Queried in ${elapsed}ms`)
        //})
      //}

      //if (typeof args[0] === 'object') {
        //if (custom) {
          //throw new Error('Invalid arguments')
        //}
        //const result: Record<CodeId, Record<Address, Contract>> = {}
        //chain.log.debug(`Querying contracts with code ids ${Object.keys(args[0]).join(', ')}...`)
        //const codeIds = args[0] as { [id: CodeId]: typeof Contract }
        //return timed(function doFetchCodeInstances () {
          //return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
        //}, function afterFetchCodeInstances ({elapsed}) {
          //chain.log.debug(`Queried in ${elapsed}ms`)
        //})
      //}

      //if ((typeof args[0] === 'number')||(typeof args[0] === 'string')) {
        //const id = args[0]
        //chain.log.debug(`Querying contracts with code id ${id}...`)
        //const result = {}
        //return timed(function doFetchCodeInstances () {
          //return chain.getConnection().fetchCodeInstancesImpl({ codeIds: { [id]: $C } })
        //}, function afterFetchCodeInstances ({elapsed}) {
          //chain.log.debug(`Queried in ${elapsed}ms`)
        //})
      //}

      //throw new Error('Invalid arguments')
  //}

  export const fetchContractInfo: FetchContractInfo = (...args: unknown[]) =>
    Error.TODO('cw fetchContractInfo')

  function zeroOrMore <T> (args?: (T|T[])[]): T[] {
    if (!args || args.length === 0) {
      return []
    } else if (args.length === 1) {
      if (args[0] instanceof Array) {
        return args[0]
      } else {
        return [args[0]]
      }
    } else {
      return args as T[]
    }
  }



    //fetchCodeInstances (codeIds: { [id: CodeId]: Contract }, options?: { parallel?: boolean }): Promise<{ [codeId in keyof typeof codeIds]:
      //Record<Address, InstanceType<typeof codeIds[codeId]>> }>
    //[>* Fetch all instances of a code ID. <]
    //fetchCodeInstances (
      //codeId: CodeId
    //): Promise<Record<Address, Contract>>
    //[>* Fetch all instances of a code ID, with custom client class. <]
    //fetchCodeInstances <C extends typeof Contract> (
      //Contract: C,
      //codeId: CodeId
    //): Promise<Record<Address, InstanceType<C>>>
    //[>* Fetch all instances of multple code IDs. <]
    //fetchCodeInstances (
      //codeIds:  Iterable<CodeId>,
      //options?: { parallel?: boolean }
    //): Promise<Record<CodeId, Record<Address, Contract>>>
    //[>* Fetch all instances of multple code IDs, with custom client class. <]
    //fetchCodeInstances <C extends typeof Contract> (
      //Contract: C,
      //codeIds:  Iterable<CodeId>,
      //options?: { parallel?: boolean }
    //): Promise<Record<CodeId, Record<Address, InstanceType<C>>>>
    //[>* Fetch all instances of multple code IDs, with multiple custom client classes. <]
    //fetchCodeInstances (
      //codeIds:  { [id: CodeId]: typeof Contract },
      //options?: { parallel?: boolean }
    //): Promise<{
      //[codeId in keyof typeof codeIds]: Record<Address, InstanceType<typeof codeIds[codeId]>>
    //}>
    //async fetchCodeInstances (...args: unknown[]): Promise<unknown> {
      //return fetchCodeInstances(this, ...args as Parameters<Chain["fetchCodeInstances"]>)
    //}
    //[>* Chain-specific implementation of fetchCodeInstances. <]
    //abstract fetchCodeInstancesImpl (parameters: {
      //codeIds:   { [id: CodeId]: typeof Contract },
      //parallel?: boolean
    //}): Promise<{
      //[codeId in keyof typeof parameters["codeIds"]]:
        //Record<Address, InstanceType<typeof parameters["codeIds"][codeId]>>
    //}>
  //}



  //import {
    //Console, Logged, SHA256, assign, base16, bold, hideProperties, into, timestamp, timed
  //} from '../Util.ts'
  //import type {
    //Address, Agent, Chain, ChainId, CodeId, CodeHash, Connection, Into, Label, Message, Name,
    //Token, TxHash,
  //} from '../../index.ts'
  //import {
    //CompiledCode
  //} from './Compile.ts'

  //export class UploadStore extends Map<CodeHash, UploadedCode> {
    //log = new Console(this.constructor.name)

    //constructor () {
      //super()
    //}

    //override get (codeHash: CodeHash): UploadedCode|undefined {
      //return super.get(codeHash)
    //}

    //override set (codeHash: CodeHash, value: Partial<UploadedCode>): this {
      //if (!(value instanceof UploadedCode)) {
        //value = new UploadedCode(value)
      //}
      //if (value.codeHash && (value.codeHash !== codeHash)) {
        //throw new Error('tried to store upload under different code hash')
      //}
      //return super.set(codeHash, value as UploadedCode)
    //}
  //}

  //[>* Represents a contract's code, in binary form, uploaded to a given chain. <]


  /** The `CompiledCode` class has an alternate implementation for non-browser environments.
    * This is because Next.js tries to parse the dynamic `import('node:...')` calls used by
    * the `fetch` methods. (Which were made dynamic exactly to avoid such a dual-implementation
    * situation in the first place - but Next is smart and adds a problem where there isn't one.)
    * So, it defaults to the version that can only fetch from URL using the global fetch method;
    * but the non-browser entrypoint substitutes `CompiledCode` in `_$_HACK_$_` with the
    * version which can also load code from disk (`LocalCompiledCode`). Ugh. */
  //export const _$_HACK_$_ = { CompiledCode: CompiledCode }

  //
    //[>* Fetch a contract's details wrapped in a `Contract` instance. <]
    //fetchContractInfo (
      //address:   Address
    //): Promise<Contract>
    //[>* Fetch a contract's details wrapped in a custom class instance. <]
    //fetchContractInfo <T extends typeof Contract> (
      //Contract:  T,
      //address:   Address
    //): Promise<InstanceType<T>>
    //[>* Fetch multiple contracts' details wrapped in `Contract` instance. <]
    //fetchContractInfo (
      //addresses: Address[],
      //options?:  { parallel?: boolean }
    //): Promise<Record<Address, Contract>>
    //[>* Fetch multiple contracts' details wrapped in instances of a custom class. <]
    //fetchContractInfo <T extends typeof Contract> (
      //Contract:  T,
      //addresses: Address[],
      //options?:  { parallel?: boolean }
    //): Promise<Record<Address, InstanceType<T>>>
    //[>* Fetch multiple contracts' details, specifying a custom class for each. <]
    //fetchContractInfo (
      //contracts: { [address: Address]: typeof Contract },
      //options?:  { parallel?: boolean }
    //): Promise<{
      //[address in keyof typeof contracts]: InstanceType<typeof contracts[address]>
    //}>
    //async fetchContractInfo (...args: unknown[]): Promise<unknown> {
      //return fetchContractInfo(this, ...args as Parameters<Chain["fetchContractInfo"]>)
    //}
    //[>* Chain-specific implementation of fetchContractInfo. <]
    //abstract fetchContractInfoImpl (parameters: {
      //contracts: { [address: Address]: typeof Contract },
      //parallel?: boolean
    //}): Promise<Record<Address, Contract>>
}

/** The set of JSONSchemas describing a certain CosmWasm contract. */
export class CosmWasmSchema {
  constructor (source, {
    contract_name, contract_version, idl_version, description,
    instantiate, execute, query, migrate, sudo, responses
  }) {
    this.source = source
    Object.assign(this, {
      contract_name, contract_version, idl_version, description,
      instantiate, execute, query, migrate, sudo, responses
    })
    /** Collect type definitions used by all schemas.
      * WARNING: Duplicate definitions are silently overwritten.
      *          Contracts shouldn't contain any of those, though. */
    for (const section of [
      this.instantiate,
      this.execute,
      this.query,
      this.migrate,
      this.sudo,
      this.responses,
      ...Object.values(this.responses)
    ]) {
      this.addDefinitions(section)
    }
  }
  /** Collection of type definitions referenced by the included JSONSchemas. */
  definitions = new Map()
  /** Collect type definitions from a schema */
  addDefinitions = section => {
    if (section && section.definitions)
      for (const name of Object.keys(section.definitions).sort()) {
        this.definitions.set(name, section.definitions[name])
        for (const definition of [
          ...section.definitions[name].oneOf||[],
          ...section.definitions[name].anyOf||[],
          ...section.definitions[name].allOf||[],
        ])
          if (!this.definitions.has(definition.title))
            this.definitions.set(definition.title, definition)
      }
  }
  /** Resolve an `allOf` schema clause against all definitions in this schema. */
  resolveAllOf = (property) =>
    allOf(this.definitions, property)
  /** Get a safe default value for a property. */
  defaultValueFor = (property) =>
    isObject(property) ? undefined :
    isString(property) ? "" :
    isNumber(property) ? 0  : ''
  /** Hardcoded overrides for a couple of types that fail to represent correctly. */
  overrides = {
    Uint128: 'A string containing a 128-bit integer in decimal representation.',
    Binary:  'A string containing Base64-encoded data.'
  }
}

/** Resolve an `allOf` schema clause against a pre-existing map of definitions. */
export const allOf = (definitions, property) => {
  let { properties = {}, allOf = [] } = property
  for (const type of allOf) {
    if (!type.$ref) throw new Error('Unsupported', { type })
    const name = refName(type)
    const definition = definitions.get(name)
    if (!definition) throw new Error(`Missing definition: ${name}`, { name })
    Object.assign(properties, definition.properties)
  }
  return properties
}

export const isObject = property =>
  (property.type === 'object') || (property.allOf?.length > 0)

export const isString = property =>
  (property.type === 'string')

export const isNumber = property =>
  (property.type === 'integer') || (property.type === 'float')

export const refName = type =>
  type.type ? type.type :
  type.$ref ? type.$ref.split('/').slice(-1)[0] : undefined

const primitiveTypes = new Set([
  'integer', 'float', 'string', 'boolean', 'object', 'null'
])

const refLink = ref =>
  (primitiveTypes.has(ref) || !ref) ? ref : `[${ref}](#${slugify(ref)})`

const slugify = ref =>
  ref.replace(/ /g, '-').toLowerCase()

const formatDescription = (definition) =>
  (definition?.description||'')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const formatDescriptionInTable = (definition) =>
  formatDescription(definition)
    .replace(/\n/g, '<br />')

/** Converts a contract schema to a Markdown document. */
export class CosmWasmSchemaToMarkdown extends CosmWasmSchema {
  /** Convert to Markdown. */
  toMd = () => {
    const fragments = [this.description]
    // Add init message
    for (const f of this.toMdInstantiate()) fragments.push(f)
    // Add other messages
    for (const section of [this.execute, this.query, this.migrate, this.sudo]) {
      for (const f of this.toMdSection(section)) fragments.push(f)
    }
    // Add responses
    for (const f of this.toMdResponses(this.responses)) fragments.push(f)
    // Add definitions
    for (const f of this.toMdDefinitions(this.definitions)) fragments.push(f)
    return fragments.join('\n')
  }
  /** Render init message section. */
  toMdInstantiate = (section = this.instantiate) => {
    if (!section) return []
    return [
      ``, `## ${section.title}`,
      ``, `${formatDescription(section)}`,
      ``, this.toMdSchemaTable(section.title, section, 'parameter').join('\n')
    ]
  }
  /** Render non-init message section. */
  toMdSection = (section) => {
    if (!section || section.oneOf.length < 1) return []
    return [
      ``, `## ${section.title}`,
      ``, `${formatDescription(section)}`,
      ...section.oneOf.map(variant=>this.toMdSectionVariant(section, variant).join('\n'))
    ]
  }
  /** Render non-init message variant. */
  toMdSectionVariant = (section, variant) => [
    ``, `### ${section.title}::${variant.title}`,
    ``, `${formatDescription(variant)}`,
    ``, this.toMdSchemaTable(variant.title, variant, 'parameter').join('\n')
  ]
  /** Render responses section. */
  toMdResponses = (responses = this.responses) => {
    if (!this.responses || Object.keys(this.responses).length < 1) return []
    return [
      ``, `## Responses`,
      ...Object.entries(this.responses)
        .map(([name, response])=>this.toMdResponseVariant(name, response).join('\n'))
    ]
  }
  /** Render response variant. */
  toMdResponseVariant = (name, response) => [
    ``, `### ${name}`,
    ``, `${formatDescription(response)}`,
    ``, this.toMdSchemaTable(name, response).join('\n')
  ]

  /** Render definitions section. */
  toMdDefinitions = () => {
    if (!this.definitions || this.definitions.size < 1) return []
    return [
      ``, `## Definitions`,
      ...[...this.definitions.keys()].sort().map(k=>this.toMdDefinitionVariant(k).join('\n'))
    ]
  }
  /** Render definition. */
  toMdDefinitionVariant = (name, definition = this.definitions.get(name)) => [
    ``, `### ${name}`,
    ``, this.overrides[name]||definition.description||'',
    ``, this.toMdSchemaTable(name, definition).join('\n')
  ]
  /** Render table with the fields of a type. */
  toMdSchemaTable = (name, definition, keyName = 'property') => {

    const { type, properties, enum: enum_, oneOf, description, required } = definition

    if (enum_) return [
      `|literal|`,
      `|-------|`,
      `|${enum_.map(x=>`\`"${x}"\``).join(" \\| ")}|`
    ]

    if (properties) return [
      `|${keyName}|description|`,
      `|----------|-----------|`,
      Object.entries(properties)
        .map(([name, property])=>{
          // Collection of rows that will be returned
          const rows = []
          // Turn values into a table row and add it to the table.
          const row = (...args) => rows.push(['', ...args, '']
            // Replaces newlines with <br> tags.
            .map(x=>String(x).replace(/\n/g,'<br />'))
            // Table cells are terminated by pypes
            .join('|'))
          // Add the field name, type, and 1st line of default value
          row(
            `\`${name}\``,
            ``
            + (required?.includes(name)?`*(Required.) * `:'')
            + `**${this.toMdSchemaType(name, property)}**. `
            + `${formatDescriptionInTable(property)}`
          )
          // If this property is an object, add its keys on an indented level
          if (isObject(property)) {
            const parentName = name
            const parentProp = property
            const properties = this.resolveAllOf(property)
            for (const [name, property] of Object.entries(properties)) row(
              `\`${parentName}.${name}\``,
              ``
              + (parentProp.required?.includes(name)?`*(Required.) * `:'')
              + `**${this.toMdSchemaType(name, property)}**. ${formatDescriptionInTable(property)}`
              + (property.default?`<br />**Default:** \`${JSON.stringify(property.default)}\``:'')
            )
          }
          return rows.join('\n')
        })
        .join('\n')
    ]

    if (oneOf) return [
      `|variant|description|`,
      `|-------|-----------|`,
      oneOf.map(variant=>{
        let {title, type, enum: enum_} = variant
        if (this.definitions.has(title)) title = refLink(title)
        type = enum_
          ? `**${type}**: ${enum_.map(x=>`\`${x}\``).join('\\|')}.`
          : `**${type}**.`
        return `|${title}|${type} ${formatDescriptionInTable(variant)}|`
      }).join('\n'),
    ]

    if (type) return [
      `|type|`,
      `|----|`,
      `|**${type}**.|`
    ]

    return []

  }
  /** Return a representation of the a property's type */
  toMdSchemaType = (key, val) => {
    if (val.$ref) return (this.toMdSchemaType(
      refName(val), this.definitions.get(refName(val)) || {}))

    const resolveRef = x =>
      x.type ? refLink(x.title||x.type) :
      x.$ref ? refLink(refName(x)) : '(unknown)'
    const joinOr = '\\|'
    const joinAnd = '&'

    if (val.anyOf) return val.anyOf.map(resolveRef).join(joinOr)
    if (val.oneOf) return val.oneOf.map(resolveRef).join(joinOr)
    if (val.allOf) return val.allOf.map(resolveRef).join(joinAnd)
    if (val.type instanceof Array) return val.type.join(joinOr)

    if (val.type === 'integer') return "integer"
    if (val.type === 'string')  return "string"
    if (val.type === 'boolean') return "boolean"
    if (val.type === 'array')   return `Array&lt;${refLink(refName(val.items))}&gt;`
    if (val.type === 'object')  return "object"

    process.stderr.write(`Warning: unsupported field definition: ${key} -> ${JSON.stringify(val)}`)
    return '(unsupported)'
  }
}
