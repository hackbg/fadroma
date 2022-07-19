/**

  Fadroma Ops and Fadroma Mocknet
  Copyright (C) 2022 Hack.bg

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

import { spawn, execFileSync } from 'child_process'
import { basename, resolve, dirname, relative, extname } from 'path'
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  readdirSync,
  readlinkSync,
  lstatSync,
  existsSync,
  unlinkSync,
  symlinkSync
} from 'fs'
import { URL, pathToFileURL } from 'url'
import { homedir, tmpdir } from 'os'
import simpleGit from 'simple-git'
import LineTransformStream from 'line-transform-stream'
import { toHex, randomHex, Sha256, randomBech32, bech32 } from '@hackbg/formati'
import { Console, bold } from '@hackbg/konzola'
import { Dokeres, DokeresImage, DokeresContainer, waitUntilLogsSay } from '@hackbg/dokeres'
import $, {
  BinaryFile,
  JSONDirectory,
  JSONFile,
  OpaqueDirectory,
  Path,
  TextFile,
  YAMLFile
} from '@hackbg/kabinet'
import { Agent, Bundle, Chain, ChainMode, Artifact, Template } from '@fadroma/client'
import type {
  Address,
  AgentOpts,
  Client,
  ClientCtor,
  ClientOpts,
  DevnetHandle,
  Instance,
  Label,
  Message,
} from '@fadroma/client'
import TOML from 'toml'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'
import { cwd } from 'process'
import { freePort, waitPort } from '@hackbg/portali'
import * as http from 'http'

export { TOML, YAML }
export const console          = Console('Fadroma Ops')
export const HEAD             = 'HEAD'
export const distinct         = <T> (x: T[]): T[] => [...new Set(x)]
export const sanitize         = ref => ref.replace(/\//g, '_')
export const artifactName     = (crate, ref) => `${crate}@${sanitize(ref)}.wasm`
export const codeHashForPath  = (location: string) => codeHashForBlob(readFileSync(location))
export const codeHashForBlob  = (blob: Uint8Array) => toHex(new Sha256(blob).digest())
export const join             = (...x:any[]) => x.map(String).join(' ')
export const addPrefix        = (prefix, name) => `${prefix}/${name}`
export const overrideDefaults = (obj, defaults, options = {}) => {
  for (const k of Object.keys(defaults)) {
    obj[k] = obj[k] || ((k in options) ? options[k] : defaults[k].apply(obj))
  }
}

/** Domain API. A Devnet is created from a given chain ID
  * with given pre-configured identities, and its state is stored
  * in a given directory. */
export interface DevnetOpts {
  /** Internal name that will be given to chain. */
  chainId?:    string
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
  /** Path to directory where state will be stored. */
  stateRoot?:  string,
  /** Port to connect to. */
  port?:       number
  /** Which of the services should be exposed the devnet's port. */
  portMode?:   DevnetPortMode
  /** Whether to destroy this devnet on exit. */
  ephemeral?:  boolean
}

/** Used to reconnect between runs. */
export interface DevnetState {
  /** ID of Docker container to restart. */
  containerId?: string
  /** Chain ID that was set when creating the devnet. */
  chainId:      string
  /** The port on which the devnet will be listening. */
  port:         number|string
}

export abstract class Devnet implements DevnetHandle {
  /** Creates an object representing a devnet.
    * Use the `respawn` method to get it running. */
  constructor ({
    chainId,
    identities,
    stateRoot,
    port,
    portMode,
    ephemeral
  }: DevnetOpts) {
    this.ephemeral = ephemeral
    this.chainId  = chainId      || this.chainId
    this.port     = Number(port) || this.port
    this.portMode = portMode
    if (!this.chainId) {
      throw new Error(
        '@fadroma/ops/Devnet: refusing to create directories for devnet with empty chain id'
      )
    }
    if (identities) {
      this.genesisAccounts = identities
    }
    stateRoot = stateRoot || resolve(cwd(), 'receipts', this.chainId)
    this.stateRoot = $(stateRoot).as(OpaqueDirectory)
    this.nodeState = this.stateRoot.at('node.json').as(JSONFile) as JSONFile<DevnetState>
  }
  /** Whether to destroy this devnet on exit. */
  ephemeral = false
  /** The chain ID that will be passed to the devnet node. */
  chainId  = 'fadroma-devnet'
  /** The protocol of the API URL without the trailing colon. */
  protocol = 'http'
  /** The hostname of the API URL. */
  host     = 'localhost'
  /** The port of the API URL.
    * If `null`, `freePort` will be used to obtain a random port. */
  port     = 9091
  /** Which service does the API URL port correspond to. */
  portMode: DevnetPortMode
  /** The API URL that can be used to talk to the devnet. */
  get url (): URL {
    const url = `${this.protocol}://${this.host}:${this.port}`
    return new URL(url)
  }
  /** This directory is created to remember the state of the devnet setup. */
  stateRoot: OpaqueDirectory
  /** List of genesis accounts that will be given an initial balance
    * when creating the devnet container for the first time. */
  genesisAccounts: Array<string> = ['ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY']
  /** Retrieve an identity */
  abstract getGenesisAccount (name: string): Promise<AgentOpts>
  /** Start the node. */
  abstract spawn (): Promise<this>
  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  nodeState: JSONFile<DevnetState>
  /** Save the info needed to respawn the node */
  save (extraData = {}) {
    const shortPath = relative(cwd(), this.nodeState.path)
    //console.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port, ...extraData }
    this.nodeState.save(data)
    return this
  }
  /** Restore this node from the info stored in the nodeState file */
  async load (): Promise<DevnetState> {
    const path = relative(cwd(), this.nodeState.path)
    if (this.stateRoot.exists() && this.nodeState.exists()) {
      //console.info(bold(`Loading:  `), path)
      try {
        const data = this.nodeState.load()
        const { chainId, port } = data
        if (this.chainId !== chainId) {
          console.warn(`Loading state of ${chainId} into Devnet with id ${this.chainId}`)
        }
        this.port = port as number
        return data
      } catch (e) {
        console.warn(`Failed to load ${path}. Deleting it`)
        this.stateRoot.delete()
        throw e
      }
    } else {
      console.info(`${path} does not exist.`)
    }
  }
  /** Start the node if stopped. */
  abstract respawn (): Promise<this>
  /** Stop this node and delete its state. */
  async terminate () {
    await this.kill()
    await this.erase()
  }
  /** Stop the node. */
  abstract kill (): Promise<void>
  /** Erase the state of the node. */
  abstract erase (): Promise<void>
}

export type DevnetPortMode = 'lcp'|'grpcWeb'

/** Parameters for the Dockerode-based implementation of Devnet.
  * (https://www.npmjs.com/package/dockerode) */
export interface DockerDevnetOpts extends DevnetOpts {
  /** Docker image of the chain's runtime. */
  image?:       DokeresImage
  /** Init script to launch the devnet. */
  initScript?:  string
  /** Once this string is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase?: string
}

/** Fadroma can spawn a devnet in a container using Dockerode.
  * This requires an image name and a handle to Dockerode. */
export class DockerDevnet extends Devnet implements DevnetHandle {
  constructor (options: DockerDevnetOpts = {}) {
    super(options)
    console.info('Constructing devnet with', bold('@hackbg/dokeres'))
    this.identities  = this.stateRoot.in('identities').as(JSONDirectory)
    this.image       = options.image
    this.initScript  = options.initScript
    this.readyPhrase = options.readyPhrase
  }
  get dokeres (): Dokeres {
    return this.image.dokeres
  }
  /** This should point to the standard production docker image for the network. */
  image: DokeresImage
  /** */
  container: DokeresContainer|null
  /** Mounted into devnet container in place of default init script
    * in order to add custom genesis accounts with initial balances
    * and store their keys. */
  initScript: string
  /** Mounted out of devnet container to persist keys of genesis wallets. */
  identities: JSONDirectory<unknown>
  /** Gets the info for a genesis account, including the mnemonic */
  async getGenesisAccount (name: string): Promise<AgentOpts> {
    return this.identities.at(`${name}.json`).as(JSONFile).load()
  }
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase: string
  /** Path under which the init script is mounted in the container. */
  get initScriptName (): string {
    return resolve('/', basename(this.initScript))
  }
  async spawn () {
    // tell the user that we have begun
    console.info(`Spawning new node...`)
    // if no port is specified, use a random port
    if (!this.port) {
      this.port = (await freePort()) as number
    }
    // create the state dirs and files
    const items = [this.stateRoot, this.nodeState]
    for (const item of items) {
      try {
        item.make()
      } catch (e) {
        console.warn(`Failed to create ${item.path}: ${e.message}`)
      }
    }
    // run the container
    const containerName = `${this.chainId}-${this.port}`
    console.info('Creating and starting devnet container:', bold(containerName))
    const env: Record<string, string> = {
      ChainID:         this.chainId,
      GenesisAccounts: this.genesisAccounts.join(' '),
    }
    switch (this.portMode) {
      case 'lcp':     env.lcpPort     = String(this.port);      break
      case 'grpcWeb': env.grpcWebAddr = `0.0.0.0:${this.port}`; break
      default: throw new Error(`DockerDevnet#portMode must be either 'lcp' or 'grpcWeb'`)
    }
    this.container = await this.image.run(containerName, {
      env,
      exposed: [`${this.port}/tcp`],
      extra: {
        Tty:          true,
        AttachStdin:  true,
        AttachStdout: true,
        AttachStderr: true,
        Hostname:     this.chainId,
        Domainname:   this.chainId,
        HostConfig:   {
          NetworkMode: 'bridge',
          Binds: [
            `${this.initScript}:${resolve('/', basename(this.initScript))}:ro`,
            `${this.stateRoot.path}:/receipts/${this.chainId}:rw`
          ],
          PortBindings: {
            [`${this.port}/tcp`]: [{HostPort: `${this.port}`}]
          }
        }
      }
    }, ['node', this.initScriptName], '/usr/bin/env')
    // update the record
    this.save()
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(
      this.container.container,
      this.readyPhrase,
      false,
      this.waitSeconds,
      DockerDevnet.logFilter
    )
    // wait for port to be open
    await this.waitPort({ host: this.host, port: Number(this.port) })
    return this
  }
  /** Overridable for testing. */
  //@ts-ignore
  protected waitPort = waitPort
  /** Overridable for testing. */
  protected waitSeconds = 7
  /** Filter logs when waiting for the ready phrase. */
  static logFilter (data: string) {
    const RE_GARBAGE = /[\x00-\x1F]/
    return (
      data.length > 0                            &&
      !data.startsWith('TRACE ')                 &&
      !data.startsWith('DEBUG ')                 &&
      !data.startsWith('INFO ')                  &&
      !data.startsWith('I[')                     &&
      !data.startsWith('Storing key:')           &&
      !RE_GARBAGE.test(data)                     &&
      !data.startsWith('{"app_message":')        &&
      !data.startsWith('configuration saved to') &&
      !(data.length>1000)
    )
  }
  async load (): Promise<DevnetState> {
    const data = await super.load()
    if (data.containerId) {
      this.container = await this.dokeres.container(data.containerId)
    } else {
      throw new Error('@fadroma/ops/Devnet: missing container id in devnet state')
    }
    return data
  }
  /** Write the state of the devnet to a file. */
  save () {
    return super.save({ containerId: this.container.id })
  }
  /** Spawn the existing localnet, or a new one if that is impossible */
  async respawn () {
    const shortPath = $(this.nodeState.path).shortPath
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.info(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }
    // get stored info about the container was supposed to be
    let id: string
    try {
      id = (await this.load()).containerId
    } catch (e) {
      // if node state is corrupted, spawn
      console.warn(e)
      console.info(`Reading ${bold(shortPath)} failed`)
      return this.spawn()
    }
    this.container = await this.dokeres.container(id)
    // check if contract is running
    let running: boolean
    try {
      running = await this.container.isRunning
    } catch (e) {
      // if error when checking, RESPAWN
      console.info(`✋ Failed to get container ${bold(id)}`)
      console.info('Error was:', e)
      console.info(`Cleaning up outdated state...`)
      await this.erase()
      console.info(`Trying to launch a new node...`)
      return this.spawn()
    }
    // if not running, RESPAWN
    if (!running) {
      await this.container.start()
    }
    // ...and try to make sure it dies when the Node process dies
    process.on('beforeExit', () => {
      if (this.ephemeral) {
        this.container.kill()
      } else {
        console.log()
        console.info(
          'Devnet is running on port', bold(String(this.port)),
          'from container', bold(this.container.id.slice(0,8))
        )
      }
    })
    return this
  }
  /** Kill the container, if necessary find it first */
  async kill () {
    if (this.container) {
      const { id } = this.container
      await this.container.kill()
      console.info(
        `Stopped container`, bold(id)
      )
    } else {
      console.info(
        `Checking if there's an old node that needs to be stopped...`
      )
      try {
        const { containerId } = await this.load()
        await this.container.kill()
        console.info(`Stopped container ${bold(containerId)}.`)
      } catch (_e) {
        console.info("Didn't stop any container.")
      }
    }
  }
  /** External environment needs to be returned to a pristine state via Docker.
    * (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.) */
  async erase () {
    const path = bold(relative(cwd(), this.stateRoot.path))
    try {
      if (this.stateRoot.exists()) {
        console.info(`Deleting ${path}...`)
        this.stateRoot.delete()
      }
    } catch (e) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        console.warn(`Failed to delete ${path}: ${e.code}; trying cleanup container...`)
        await this.image.ensure()
        const containerName = `${this.chainId}-${this.port}-cleanup`
        const options = {
          AutoRemove: true,
          Image:      this.image.name,
          Entrypoint: [ '/bin/rm' ],
          Cmd:        ['-rvf', '/state',],
          HostConfig: { Binds: [`${this.stateRoot.path}:/state:rw`] }
          //Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
        }
        const cleanupContainer = await this.image.run(
          containerName,
          { extra: options },
          ['-rvf', '/state'],
          '/bin/rm'
        )
        console.info(`Starting cleanup container...`)
        await cleanupContainer.start()
        console.info('Waiting for cleanup to finish...')
        await cleanupContainer.wait()
        console.info(`Deleted ${path} via cleanup container.`)
      } else {
        console.warn(`Failed to delete ${path}: ${e.message}`)
        throw e
      }
    }
  }

}

/** Parameters for the HTTP API-managed implementation of Devnet. */
export type RemoteDevnetOpts = DevnetOpts & {
  /** Base URL of the API that controls the managed node. */
  managerURL: string
}

/** When running in docker-compose, Fadroma needs to request
  * from the devnet container to spawn a chain node with the
  * given chain id and identities via a HTTP API. */
export class RemoteDevnet extends Devnet implements DevnetHandle {
  /** Get a handle to a remote devnet. If there isn't one,
    * create one. If there already is one, reuse it. */
  static getOrCreate (
    projectRoot: string,
    managerURL:  string,
    chainId?:    string,
    prefix?:     string,
    portMode?:   string
  ) {
    // If passed a chain id, use it; this makes a passed prefix irrelevant.
    if (chainId && prefix) {
      console.warn('Passed both chainId and prefix to RemoteDevnet.getOrCreate: ignoring prefix')
    }
    // Establish default prefix. Chain subclasses should define this.
    if (!prefix) {
      prefix = 'devnet'
    }
    // If no chain id passed, try to reuse the last created devnet;
    // if there isn't one, create a new one and symlink it as active.
    if (!chainId) {
      const active = $(projectRoot, 'receipts', `${prefix}-active`)
      if ($(active).exists()) {
        chainId = basename(readlinkSync(active.path))
        console.info('Reusing existing managed devnet with chain id', bold(chainId))
      } else {
        chainId = `${prefix}-${randomHex(4)}`
        const devnet = $(projectRoot).in('receipts').in(chainId)
        devnet.make()
        symlinkSync(devnet.path, active.path)
        console.info('Creating new managed devnet with chain id', bold(chainId))
      }
    }
    return new RemoteDevnet({ managerURL, chainId, portMode })
  }
  constructor (options) {
    super(options)
    console.info('Constructing', bold('remotely managed'), 'devnet')
    this.manager = new Endpoint(options.managerURL)
    this.host    = this.manager.url.hostname
  }
  manager: Endpoint
  async spawn () {
    const port = await freePort()
    this.port = port
    console.info(bold('Spawning managed devnet'), this.chainId, 'on port', port)
    const params = {
      id:          this.chainId,
      genesis:     this.genesisAccounts.join(','),
      lcpPort:     undefined,
      grpcWebAddr: undefined
    }
    if (this.portMode === 'lcp') {
      params.lcpPort = port
    } else if (this.portMode === 'grpcWeb') {
      params.grpcWebAddr = `0.0.0.0:${port}`
    }
    const result = await this.manager.get('/spawn', params)
    if (result.error === 'Node already running') {
      console.info('Remote devnet already running')
      if (this.portMode === 'lcp' && result.lcpPort) {
        this.port = Number(result.lcpPort)
      } else if (this.portMode === 'grpcWeb' && result.grpcWebAddr) {
        this.port = Number(new URL('idk://'+result.grpcWebAddr).port)
      }
      console.info('Reusing port', this.port, 'for', this.portMode)
    }
    await this.ready()
    console.info(`Waiting 7 seconds for good measure...`)
    await new Promise(ok=>setTimeout(ok, 7000))
    return this
  }
  save () {
    const shortPath = $(this.nodeState.path).shortPath
    console.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }
  async respawn () {
    const shortPath = $(this.nodeState.path).shortPath
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.info(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }
    return this
  }
  protected async ready (): Promise<void> {
    while (true) {
      const { ready } = await this.manager.get('/ready')
      if (ready) {
        break
      }
      console.info('Waiting for devnet to become ready...')
      await new Promise(resolve=>setTimeout(resolve, 2000))
    }
  }
  async getGenesisAccount (name: string): Promise<AgentOpts> {
    const identity = await this.manager.get('/identity', { name })
    if (identity.error) {
      throw new Error(`RemoteDevnet#getGenesisAccount: failed to get ${name}: ${identity.error}`)
    }
    return identity
  }
  async erase () {
    throw new Error('RemoteDevnet#erase: not implemented')
  }
  async kill () {
    throw new Error('RemoteDevnet#kill: not implemented')
  }
}

export abstract class Uploader {
  constructor (public agent: Agent) {}
  get chain () { return this.agent.chain }
  abstract upload     (artifact:  Artifact, ...args): Promise<Template>
  abstract uploadMany (artifacts: Artifact[]):        Promise<Template[]>
}

export interface UploadReceipt {
  codeHash:           string
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

/** Directory collecting upload receipts. */
export class Uploads extends JSONDirectory<UploadReceipt> {}

/** Uploads contracts from the local file system. */
export class FSUploader extends Uploader {
  /** Upload an Artifact from the filesystem, returning a Template. */
  async upload (artifact: Artifact): Promise<Template> {
    const data = $(artifact.url).as(BinaryFile).load()
    const template = await this.agent.upload(data)
    await this.agent.nextBlock
    return template
  }
  /** Upload multiple Artifacts from the filesystem.
    * TODO: Optionally bundle them (where is max size defined?) */
  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {
    //console.log('uploadMany', artifacts)
    const templates = []
    for (const i in artifacts) {
      // support "holes" in artifact array
      // (used by caching subclass)
      const artifact = artifacts[i]
      let template
      if (artifact) {
        const path = $(artifact.url)
        const data = path.as(BinaryFile).load()
        //console.info('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
        template = await this.agent.upload(data)
        //console.info('Uploaded:', bold(path.shortPath))
        //console.debug(template)
        this.checkCodeHash(artifact, template)
      }
      templates[i] = template
    }
    return templates
  }
  /** Print a warning if the code hash returned by the upload
    * doesn't match the one specified in the Artifact.
    * This means the Artifact is wrong, and may become
    * a hard error in the future. */
  checkCodeHash (artifact: Artifact, template: Template) {
    if (template.codeHash !== artifact.codeHash) {
      console.warn(
        `Code hash mismatch from upload in TX ${template.uploadTx}:\n`+
        `   Expected ${artifact.codeHash} (from ${$(artifact.url).shortPath})\n`+
        `   Got      ${template.codeHash} (from codeId#${template.codeId})`
      )
    }
  }
}

export class UploadReceipt extends JSONFile<{ chainId, codeId, codeHash, uploadTx, artifact? }> {
  toTemplate (): Template {
    const { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    return new Template(
      chainId,
      codeId,
      codeHash,
      uploadTx,
      artifact
    )
  }
}

/** Uploads contracts from the file system,
  * but only if a receipt does not exist in the chain's uploads directory. */
export class CachingFSUploader extends FSUploader {
  static fromConfig (agent, projectRoot) {
    return new CachingFSUploader(
      agent,
      $(projectRoot).in('receipts').in(agent.chain.id).in('uploads').as(Uploads)
    )
  }
  constructor (readonly agent: Agent, readonly cache: Uploads) {
    super(agent)
  }
  protected getUploadReceiptPath (artifact: Artifact): string {
    const receiptName = `${this.getUploadReceiptName(artifact)}`
    const receiptPath = this.cache.resolve(receiptName)
    return receiptPath
  }
  protected getUploadReceiptName (artifact: Artifact): string {
    return `${$(artifact.url).name}.json`
  }
  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (artifact: Artifact): Promise<Template> {
    const name    = this.getUploadReceiptName(artifact)
    const receipt = this.cache.at(name).as(UploadReceipt)
    if (receipt.exists()) {
      return receipt.toTemplate()
    }
    const data = $(artifact.url).as(BinaryFile).load()
    //console.info(
      //`Uploading:`, bold($(artifact.url).shortPath),
      //'with code hash', bold(artifact.codeHash),
      //'uncompressed', bold(String(data.length)), 'bytes'
    //)
    const template = await this.agent.upload(data)
    //console.info(`Storing:  `, bold($(receipt.path).shortPath))
    receipt.save(template)
    return template
  }
  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {
    const templates = []
    const artifactsToUpload  = []
    for (const i in artifacts) {
      const artifact = artifacts[i]
      this.ensureCodeHash(artifact)
      const blobName     = $(artifact.url).name
      const receiptPath  = this.getUploadReceiptPath(artifact)
      const relativePath = $(receiptPath).shortPath
      if (!$(receiptPath).exists()) {
        artifactsToUpload[i] = artifact
      } else {
        const receiptFile     = $(receiptPath).as(JSONFile) as JSONFile<UploadReceipt>
        const receiptData     = receiptFile.load()
        const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
        if (!receiptCodeHash) {
          //console.info(bold(`No code hash:`), `${relativePath}; reuploading...`)
          artifactsToUpload[i] = artifact
          continue
        }
        if (receiptCodeHash !== artifact.codeHash) {
          console.warn(
            bold(`Different code hash:`), `${relativePath}; reuploading...`
          )
          artifactsToUpload[i] = artifact
          continue
        }
        //console.info('✅', 'Exists, not reuploading (same code hash):', bold(relativePath))
        templates[i] = new Template(
          this.chain.id,
          String(receiptData.codeId),
          artifact.codeHash,
          receiptData.transactionHash as string,
          artifact
        )
      }
    }
    if (artifactsToUpload.length > 0) {
      const uploaded = await super.uploadMany(artifactsToUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const receiptName = this.getUploadReceiptName(artifactsToUpload[i])
        const receiptFile = $(this.cache, receiptName).as(JSONFile)
        receiptFile.save(uploaded[i])
        templates[i] = uploaded[i]
      }
    } else {
      //console.info('No artifacts need to be uploaded.')
    }
    return templates
  }
  /** Warns if a code hash is missing in the Artifact,
    * and mutates the Artifact to set the code hash. */
  protected ensureCodeHash (artifact: Artifact) {
    if (!artifact.codeHash) {
      console.warn(
        'No code hash in artifact',
        bold($(artifact.url).shortPath)
      )
      try {
        const codeHash = codeHashForPath($(artifact.url).path)
        Object.assign(artifact, { codeHash })
        console.warn(
          'Computed code hash:',
          bold(artifact.codeHash)
        )
      } catch (e) {
        console.warn('Could not compute code hash:', e.message)
      }
    }
  }
}

/** Deployments for a chain, represented by a directory with 1 YAML file per deployment. */
export class Deployments extends JSONDirectory<unknown> {
  static fromConfig (chain, projectRoot) {
    return $(projectRoot).in('receipts').in(chain.id).in('deployments').as(Deployments)
  }
  KEY = '.active'
  async create (deployment: string) {
    const path = this.at(`${deployment}.yml`)
    if (path.exists()) {
      throw new Error(`${deployment} already exists`)
    }
    return path.makeParent().as(YAMLFile).save(undefined)
    return new Deployment(path.path)
  }
  async select (deployment: string) {
    const selection = this.at(`${deployment}.yml`)
    if (!selection.exists) {
      throw new Error(`${deployment} does not exist`)
    }
    const active = this.at(`${this.KEY}.yml`).as(YAMLFile)
    try { active.delete() } catch (e) {}
    await symlinkSync(selection.path, active.path)
  }
  get active (): Deployment|null {
    return this.get(this.KEY)
  }
  get (id: string): Deployment|null {
    const path = resolve(this.path, `${id}.yml`)
    if (!existsSync(path)) {
      return null
    }
    let prefix: string
    return new Deployment(path)
  }
  list () {
    if (!existsSync(this.path)) {
      return []
    }
    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
  }
  save <D> (name: string, data: D) {
    const file = this.at(`${name}.json`).as(JSONFile) as JSONFile<D>
    //console.info('Deployments writing:', bold(file.shortPath))
    return file.save(data)
  }
}

/** An individual deployment, represented as a multi-document YAML file. */
export class Deployment {
  constructor (public readonly path: string) {
    this.load()
  }
  /** This is the name of the deployment.
    * It's used as a prefix to contract labels
    * (which need to be globally unique). */
  prefix: string
  /** These are the items contained by the Deployment.
    * They correspond to individual contract instances. */
  receipts: Record<string, Instance & any> = {}
  /** Load deployment state from YAML file. */
  load (path = this.path) {
    while (lstatSync(path).isSymbolicLink()) {
      path = resolve(dirname(path), readlinkSync(path))
    }
    this.prefix    = basename(path, extname(path))
    const data     = readFileSync(path, 'utf8')
    const receipts = YAML.loadAll(data)
    for (const receipt of receipts) {
      const [contractName, _version] = receipt.name.split('+')
      this.receipts[contractName] = receipt
    }
  }
  has (name: string): boolean {
    return !!this.receipts[name]
  }
  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string, suffix?: string): Instance {
    const receipt = this.receipts[name]
    if (!receipt) {
      const msg = `@fadroma/ops/Deploy: ${name}: no such contract in deployment`
      throw new Error(msg)
    }
    receipt.name = name
    return receipt
  }
  /** Chainable. Add to deployment, replacing existing receipts. */
  set (name: string, data = {}): this {
    this.receipts[name] = { name, ...data }
    return this.save()
  }
  /** Chainable. Add multiple to the deployment, replacing existing. */
  setMany (receipts: Record<string, any>) {
    for (const [name, receipt] of Object.entries(receipts)) {
      this.receipts[name] = receipt
    }
    return this.save()
  }
  /** Chainable. Add to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.receipts[name] || {}, ...data })
  }
  /** Chainable: Serialize deployment state to YAML file. */
  save (): this {
    let output = ''
    for (let [name, data] of Object.entries(this.receipts)) {
      output += '---\n'
      output += alignYAML(YAML.dump({ name, ...data }, { noRefs: true }))
    }
    writeFileSync(this.path, output)
    return this
  }
  /** Resolve a path relative to the deployment directory. */
  resolve (...fragments: Array<string>) {
    return resolve(this.path, ...fragments)
  }
  getClient <C extends Client, O extends ClientOpts> (
    agent:  Agent,
    Client: ClientCtor<C, O>,
    name:   string
  ): C {
    return new Client(agent, this.get(name) as O)
  }
  /** Instantiate one contract and save its receipt to the deployment. */
  async init (
    deployAgent: Agent,
    template:    Template,
    name:        Label,
    msg:         Message
  ): Promise<Instance> {
    const label = addPrefix(this.prefix, name)
    const instance = await deployAgent.instantiate(template, label, msg)
    this.set(name, instance)
    return instance
  }
  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (
    deployAgent: Agent,
    template:    Template,
    configs:     [Label, Message][] = []
  ): Promise<Instance[]> {
    // this adds just the template - prefix is added in initVarious
    return this.initVarious(deployAgent, configs.map(([name, msg])=>[template, name, msg]))
  }
  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (
    deployAgent: Agent,
    configs:     [Template, Label, Message][] = []
  ): Promise<Instance[]> {
    // Validate
    for (const index in configs) {
      const config = configs[index]
      if (config.length !== 3) {
        throw Object.assign(
          new Error('initVarious: configs must be [Template, Name, Message] triples'),
          { index, config }
        )
      }
    }
    // Add prefixes
    const initConfigs = configs.map(([template, name, msg])=>
      [template, addPrefix(this.prefix, name), msg]) as [Template, Label, Message][]
    // Deploy
    const instances = await deployAgent.instantiateMany(initConfigs)
    // Store receipt
    for (const [label, receipt] of Object.entries(instances)) {
      const name = label.slice(this.prefix.length+1)
      this.set(name, { name, ...receipt })
    }
    return Object.values(instances)
  }
}

/** Management endpoint client for remote build/remote devnet. */
export class Endpoint {
  url: URL
  constructor (url: string) {
    this.url = new URL(url)
  }
  get (pathname: string = '', params: Record<string, string> = {}): Promise<any> {
    const url = Object.assign(new URL(this.url.toString()), { pathname })
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    return new Promise((resolve, reject)=>{
      this._get(url.toString(), res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve(JSON.parse(data)))
      }).on('error', reject)
    })
  }
  _get = http.get
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()
declare class TextDecoder { decode (data: any): string }
declare class TextEncoder { encode (data: string): any }
declare namespace WebAssembly {
  class Memory { constructor ({ initial, maximum }); buffer: Buffer }
  class Instance<T> { exports: T }
  function instantiate (code, world)
}
export type ErrCode = number
export type Ptr     = number
export type Size    = number
/** Memory region as allocated by CosmWasm */
export type Region = [Ptr, Size, Size, Uint32Array?]
export interface IOExports {
  memory: WebAssembly.Memory
  allocate (len: Size): Ptr
}
export interface ContractExports extends IOExports {
  init   (env: Ptr, msg: Ptr): Ptr
  handle (env: Ptr, msg: Ptr): Ptr
  query  (msg: Ptr):           Ptr
}
export interface ContractImports {
  memory: WebAssembly.Memory
  env: {
    db_read              (key: Ptr): Ptr
    db_write             (key: Ptr, val: Ptr)
    db_remove            (key: Ptr)
    canonicalize_address (src: Ptr, dst: Ptr): ErrCode
    humanize_address     (src: Ptr, dst: Ptr): ErrCode
    query_chain          (req: Ptr): Ptr
  }
}
export const MOCKNET_ADDRESS_PREFIX = 'mocked'
// TODO move this env var to global config
const trace = process.env.FADROMA_MOCKNET_DEBUG ? ((...args) => {
  console.info(...args)
  console.log()
}) : (...args) => {}
const debug = process.env.FADROMA_MOCKNET_DEBUG ? ((...args) => {
  console.debug(...args)
  console.log()
}) : (...args) => {}
/** Chain instance containing a local MocknetBackend. */
export class Mocknet extends Chain {
  defaultDenom = 'umock'
  constructor (id = 'fadroma-mocknet', options = {}) {
    super(id, { ...options, mode: ChainMode.Mocknet })
  }
  Agent = MocknetAgent
  backend = new MocknetBackend(this.id)
  async getAgent (options: AgentOpts) {
    return new MocknetAgent(this, options)
  }
  async query <T, U> (contract: Instance, msg: T): Promise<U> {
    return this.backend.query(contract, msg)
  }
  async getHash (_: any) {
    return Promise.resolve("SomeCodeHash")
  }
  async getCodeId (_: any) {
    return Promise.resolve("1")
  }
  async getLabel (_: any) {
    return "SomeLabel"
  }
  async getBalance (_: string) {
    return "0"
  }
  get height () {
    return Promise.resolve(0)
  }
}
/** Agent instance calling its Chain's Mocknet backend. */
export class MocknetAgent extends Agent {
  get defaultDenom () { return this.chain.defaultDenom }
  Bundle = MocknetBundle
  static async create (chain: Mocknet, options: AgentOpts) {
    return new MocknetAgent(chain, options)
  }
  constructor (readonly chain: Chain, readonly options: AgentOpts) {
    super(chain, options)
  }
  name:    string  = 'MocknetAgent'
  address: Address = randomBech32(MOCKNET_ADDRESS_PREFIX)
  get backend (): MocknetBackend {
    const { backend }: Mocknet = this.chain as unknown as Mocknet
    return backend
  }
  async upload (blob: Uint8Array) {
    return await this.backend.upload(blob)
  }
  async instantiate (template, label, msg, funds = []): Promise<Instance> {
    return await this.backend.instantiate(this.address, template, label, msg, funds)
  }
  async execute <R> (instance, msg: Message, opts): Promise<R> {
    return await this.backend.execute(this.address, instance, msg, opts.funds, opts.memo, opts.fee)
  }
  async query <R> (instance, msg: Message): Promise<R> {
    return await this.chain.query(instance, msg)
  }
  get nextBlock () { return Promise.resolve(0)   }
  get block     () { return Promise.resolve(0)   }
  get account   () { return Promise.resolve()    }
  get balance   () { return Promise.resolve("0") }
  getBalance (_: string) { return Promise.resolve("0") }
  send (_1:any, _2:any, _3?:any, _4?:any, _5?:any) { return Promise.resolve() }
  sendMany (_1:any, _2:any, _3?:any, _4?:any) { return Promise.resolve() }
}
export class MocknetBundle extends Bundle {
  declare agent: MocknetAgent
  async submit (memo = "") {
    const results = []
    for (const { init, exec } of this.msgs) {
      if (init) {
        const { sender, codeId, codeHash, label, msg, funds } = init
        results.push(await this.agent.instantiate({ codeId, codeHash }, label, msg, funds))
      } else if (exec) {
        const { sender, contract, codeHash, msg, funds } = exec
        results.push(await this.agent.execute({ address: contract, codeHash }, msg, { send: funds }))
      } else {
        console.warn('MocknetBundle#submit: found unknown message in bundle, ignoring')
        results.push(null)
      }
    }
    return results
  }
  save (name: string): Promise<unknown> {
    throw new Error('MocknetBundle#save: not implemented')
  }
}
/** Hosts MocknetContract instances. */
export class MocknetBackend {
  constructor (readonly chainId: string) {}
  codeId  = 0
  uploads = {}
  getCode (codeId) {
    const code = this.uploads[codeId]
    if (!code) {
      throw new Error(`No code with id ${codeId}`)
    }
    return code
  }
  upload (blob: Uint8Array): Template {
    const chainId  = this.chainId
    const codeId   = ++this.codeId
    const content  = this.uploads[codeId] = blob
    const codeHash = codeHashForBlob(blob)
    return new Template(chainId, String(codeId), codeHash)
  }
  instances = {}
  getInstance (address) {
    const instance = this.instances[address]
    if (!instance) {
      throw new Error(`MocknetBackend#getInstance: no contract at ${address}`)
    }
    return instance
  }
  async instantiate (
    sender: Address, { codeId, codeHash }: Template, label, msg, funds = []
  ): Promise<Instance> {
    const chainId  = this.chainId
    const code     = this.getCode(codeId)
    const contract = await new MocknetContract(this).load(code)
    const env      = this.makeEnv(sender, contract.address, codeHash)
    const response = contract.init(env, msg)
    const initResponse = parseResult(response, 'instantiate', contract.address)
    this.instances[contract.address] = contract
    await this.passCallbacks(contract.address, initResponse.messages)
    return { chainId, codeId, codeHash, address: contract.address, label }
  }
  async execute (sender: string, { address, codeHash }: Instance, msg, funds, memo?, fee?) {
    const result   = this.getInstance(address).handle(this.makeEnv(sender, address), msg)
    const response = parseResult(result, 'execute', address)
    if (response.data !== null) {
      response.data = b64toUtf8(response.data)
    }
    await this.passCallbacks(address, response.messages)
    return response
  }
  /** Populate the `Env` object available in transactions. */
  makeEnv (
    sender,
    address,
    codeHash = this.instances[address].codeHash,
    now      = + new Date()
  ) {
    const height     = Math.floor(now/5000)
    const time       = Math.floor(now/1000)
    const chain_id   = this.chainId
    const sent_funds = []
    return {
      block:    { height, time, chain_id },
      message:  { sender, sent_funds },
      contract: { address },
      contract_key: "",
      contract_code_hash: codeHash
    }
  }
  async passCallbacks (sender: Address, messages: Array<any>) {
    for (const message of messages) {
      const { wasm } = message
      if (!wasm) {
        console.warn(
          'MocknetBackend#execute: transaction returned non-wasm message, ignoring:',
          message
        )
        continue
      }
      const { instantiate, execute } = wasm
      if (instantiate) {
        const { code_id, callback_code_hash, label, msg, send } = instantiate
        const instance = await this.instantiate(
          sender, /* who is sender? */
          { codeId: code_id, codeHash: callback_code_hash },
          label,
          JSON.parse(b64toUtf8(msg)),
          send
        )
        trace(
          `Callback from ${bold(sender)}: instantiated contract`, bold(label),
          'from code id', bold(code_id), 'with hash', bold(callback_code_hash),
          'at address', bold(instance.address)
        )
      } else if (execute) {
        const { contract_addr, callback_code_hash, msg, send } = execute
        const response = await this.execute(
          sender,
          { address: contract_addr, codeHash: callback_code_hash },
          JSON.parse(b64toUtf8(msg)),
          send
        )
        trace(
          `Callback from ${bold(sender)}: executed transaction`,
          'on contract', bold(contract_addr), 'with hash', bold(callback_code_hash),
        )
      } else {
        console.warn(
          'MocknetBackend#execute: transaction returned wasm message that was not '+
          '"instantiate" or "execute", ignoring:',
          message
        )
      }
    }
  }
  async query ({ address, codeHash }: Instance, msg) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }
  private resultOf (address: Address, action: string, response: any) {
    const { Ok, Err } = response
    if (Err !== undefined) {
      const errData = JSON.stringify(Err)
      const message = `MocknetBackend#${action}: contract ${address} returned Err: ${errData}`
      throw Object.assign(new Error(message), Err)
    }
    if (Ok !== undefined) {
      return Ok
    }
    throw new Error(`MocknetBackend#${action}: contract ${address} returned non-Result type`)
  }
}

export function parseResult (response: any, address: Address, action: string) {
  const { Ok, Err } = response
  if (Err !== undefined) {
    const errData = JSON.stringify(Err)
    const message = `Mocknet ${action}: contract ${address} returned Err: ${errData}`
    throw Object.assign(new Error(message), Err)
  }
  if (Ok !== undefined) {
    return Ok
  }
  throw new Error(`Mocknet ${action}: contract ${address} returned non-Result type`)
}

/** Hosts a WASM contract blob and contains the contract-local storage. */
export class MocknetContract {
  constructor (
    readonly backend: MocknetBackend|null = null,
    readonly address: Address             = randomBech32(MOCKNET_ADDRESS_PREFIX)
  ) {
    trace('Instantiating', bold(address))
  }
  instance: WebAssembly.Instance<ContractExports>
  async load (code) {
    const { instance } = await WebAssembly.instantiate(code, this.makeImports())
    this.instance = instance
    return this
  }
  init (env, msg) {
    debug(`${bold(this.address)} init:`, msg)
    try {
      const envBuf  = this.pass(env)
      const msgBuf  = this.pass(msg)
      const retPtr  = this.instance.exports.init(envBuf, msgBuf)
      const retData = this.readUtf8(retPtr)
      return retData
    } catch (e) {
      console.error(bold(this.address), `crashed on init:`, e.message)
      throw e
    }
  }
  handle (env, msg) {
    debug(`${bold(this.address)} handle:`, msg)
    try {
      const envBuf = this.pass(env)
      const msgBuf = this.pass(msg)
      const retPtr = this.instance.exports.handle(envBuf, msgBuf)
      const retBuf = this.readUtf8(retPtr)
      return retBuf
    } catch (e) {
      console.error(bold(this.address), `crashed on handle:`, e.message)
      throw e
    }
  }
  query (msg) {
    debug(`${bold(this.address)} query:`, msg)
    try {
      const msgBuf = this.pass(msg)
      const retPtr = this.instance.exports.query(msgBuf)
      const retBuf = this.readUtf8(retPtr)
      return retBuf
    } catch (e) {
      console.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }
  private pass (data) {
    return pass(this.instance.exports, data)
  }
  private readUtf8 (ptr) {
    return JSON.parse(readUtf8(this.instance.exports, ptr))
  }
  storage = new Map<string, Buffer>()

  /** TODO: these are different for different chains. */
  makeImports (): ContractImports {
    // don't destructure - when first instantiating the
    // contract, `this.instance` is still undefined
    const contract = this
    // initial blank memory
    const memory   = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const getExports = () => ({
      memory:   contract.instance.exports.memory,
      allocate: contract.instance.exports.allocate,
    })
    return {
      memory,
      env: {
        db_read (keyPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          const val     = contract.storage.get(key)
          trace(bold(contract.address), `db_read:`, bold(key), '=', val)
          if (contract.storage.has(key)) {
            return passBuffer(exports, val)
          } else {
            return 0
          }
        },
        db_write (keyPtr, valPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          const val     = readBuffer(exports, valPtr)
          contract.storage.set(key, val)
          trace(bold(contract.address), `db_write:`, bold(key), '=', val)
        },
        db_remove (keyPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          trace(bold(contract.address), `db_remove:`, bold(key))
          contract.storage.delete(key)
        },
        canonicalize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const human   = readUtf8(exports, srcPtr)
          const canon   = bech32.fromWords(bech32.decode(human).words)
          const dst     = region(exports.memory.buffer, dstPtr)
          trace(bold(contract.address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(exports, dstPtr, canon)
          return 0
        },
        humanize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const canon   = readBuffer(exports, srcPtr)
          const human   = bech32.encode(MOCKNET_ADDRESS_PREFIX, bech32.toWords(canon))
          const dst     = region(exports.memory.buffer, dstPtr)
          trace(bold(contract.address), `humanize:`, canon, '->', human)
          writeToRegionUtf8(exports, dstPtr, human)
          return 0
        },
        query_chain (reqPtr) {
          const exports  = getExports()
          const req      = readUtf8(exports, reqPtr)
          trace(bold(contract.address), 'query_chain:', req)
          const { wasm } = JSON.parse(req)
          if (!wasm) {
            throw new Error(
              `MocknetContract ${contract.address} made a non-wasm query:`+
              ` ${JSON.stringify(req)}`
            )
          }
          const { smart } = wasm
          if (!wasm) {
            throw new Error(
              `MocknetContract ${contract.address} made a non-smart wasm query:`+
              ` ${JSON.stringify(req)}`
            )
          }
          if (!contract.backend) {
            throw new Error(
              `MocknetContract ${contract.address} made a query while isolated from`+
              ` the MocknetBackend: ${JSON.stringify(req)}`
            )
          }
          const { contract_addr, callback_code_hash, msg } = smart
          const queried = contract.backend.getInstance(contract_addr)
          if (!queried) {
            throw new Error(
              `MocknetContract ${contract.address} made a query to contract ${contract_addr}` +
              ` which was not found in the MocknetBackend: ${JSON.stringify(req)}`
            )
          }
          const decoded = JSON.parse(b64toUtf8(msg))
          debug(`${bold(contract.address)} queries ${contract_addr}:`, decoded)
          const result = parseResult(queried.query(decoded), 'query_chain', contract_addr)
          debug(`${bold(contract_addr)} responds to ${contract.address}:`, b64toUtf8(result))
          return pass(exports, { Ok: { Ok: result } })
          // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
        }
      }
    }
  }
}
/** Read region properties from pointer to region. */
export function region (buffer: Buffer, ptr: Ptr): Region {
  const u32a = new Uint32Array(buffer)
  const addr = u32a[ptr/4+0] // Region.offset
  const size = u32a[ptr/4+1] // Region.capacity
  const used = u32a[ptr/4+2] // Region.length
  return [addr, size, used, u32a]
}
/** Read contents of region referenced by region pointer into a string. */
export function readUtf8 (exports: IOExports, ptr: Ptr): string {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const view = new DataView(buffer, addr, used)
  const data = decoder.decode(view)
  drop(exports, ptr)
  return data
}
/** Read contents of region referenced by region pointer into a string. */
export function readBuffer (exports: IOExports, ptr: Ptr): Buffer {
  const { buffer } = exports.memory
  const [addr, size, used] = region(buffer, ptr)
  const u8a  = new Uint8Array(buffer)
  const output = Buffer.alloc(size)
  for (let i = addr; i < addr + size; i++) {
    output[i - addr] = u8a[i]
  }
  return output
}
/** Serialize a datum into a JSON string and pass it into the contract. */
export function pass <T> (exports: IOExports, data: T): Ptr {
  return passBuffer(exports, utf8toBuffer(JSON.stringify(data)))
}
/** Allocate region, write data to it, and return the pointer.
  * See: https://github.com/KhronosGroup/KTX-Software/issues/371#issuecomment-822299324 */
export function passBuffer (exports: IOExports, buf: Buffer): Ptr {
  const ptr = exports.allocate(buf.length)
  const { buffer } = exports.memory // must be after allocation - see [1]
  const [ addr, _, __, u32a ] = region(buffer, ptr)
  u32a[ptr/4+2] = u32a[ptr/4+1] // set length to capacity
  write(buffer, addr, buf)
  return ptr
}
/** Write data to memory address. */
export function write (buffer: Buffer, addr, data: ArrayLike<number>): void {
  new Uint8Array(buffer).set(data, addr)
}
/** Write UTF8-encoded data to memory address. */
export function writeUtf8 (buffer: Buffer, addr, data: string): void {
  new Uint8Array(buffer).set(encoder.encode(data), addr)
}
/** Write data to address of region referenced by pointer. */
export function writeToRegion (exports: IOExports, ptr: Ptr, data: ArrayLike<number>): void {
  const [addr, size, _, u32a] = region(exports.memory.buffer, ptr)
  if (data.length > size) { // if data length > Region.capacity
    throw new Error(`Mocknet: tried to write ${data.length} bytes to region of ${size} bytes`)
  }
  const usedPtr = ptr/4+2
  u32a[usedPtr] = data.length // set Region.length
  write(exports.memory.buffer, addr, data)
}
/** Write UTF8-encoded data to address of region referenced by pointer. */
export function writeToRegionUtf8 (exports: IOExports, ptr: Ptr, data: string): void {
  writeToRegion(exports, ptr, encoder.encode(data))
}
/** Deallocate memory. Fails silently if no deallocate callback is exposed by the blob. */
export function drop (exports, ptr): void {
  if (exports.deallocate) {
    exports.deallocate(ptr)
  } else {
    //console.warn("Can't deallocate", ptr)
  }
}
/** Convert base64 to string */
export function b64toUtf8 (str: string) {
  return Buffer.from(str, 'base64').toString('utf8')
}
/** Convert string to base64 */
export function utf8toB64 (str: string) {
  return Buffer.from(str, 'utf8').toString('base64')
}
export function utf8toBuffer (str: string) {
  return Buffer.from(str, 'utf8')
}
export function bufferToUtf8 (buf: Buffer) {
  return buf.toString('utf8')
}
