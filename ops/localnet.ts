import { ChainNode, ChainNodeOptions } from './types'
import { __dirname, defaultStateBase } from './constants'

import { resolve, loadJSON, rimraf, TextFile, JSONFile, Directory } from './system'
import { Docker, waitPort, freePort, pulled, waitUntilLogsSay } from './network'
import { Console, bold } from './command'

const console = Console(import.meta.url)

export abstract class BaseChainNode implements ChainNode {
  chainId: string
  apiURL:  URL
  port:    number
  ready:   Promise<void>

  /* This directory is created to remember the state of the localnet setup. */
  readonly stateRoot:  Directory

  /* This file contains the id of the current localnet container.
   * TODO store multiple containers */
  readonly nodeState:  JSONFile

  /* This directory is mounted out of the localnet container
   * in order to persist the state of the chain. */
  readonly daemonDir:  Directory

  /* This directory is mounted out of the localnet container
   * in order to persist the state of the container's built-in secretcli. */
  readonly clientDir:  Directory

  /* This directory is mounted out of the localnet container
   * in order to persist the state of the SGX modules. */
  readonly sgxDir:     Directory

  /* This directory is mounted out of the localnet container
   * to persist the keys of the genesis wallets. */
  readonly identities: Directory

  /* List of genesis accounts that have been given an initial balance
   * when creating the localnet container for the first time. */
  identitiesToCreate: Array<string> = []

  /* Retrieve an identity */
  genesisAccount = (name: string) =>
    loadJSON(resolve(this.identities.path, `${name}.json`))

  /* Restore this node from the info stored in nodeState */
  load () {
    console.debug('loading localnet node', { from: this.nodeState.path })
    this.stateRoot.assert()
    this.nodeState.assert()
    try {
      return this.nodeState.load() }
    catch (e) {
      console.warn(`failed to parse ${this.nodeState.path}`)
      this.stateRoot.delete()
      throw e } }

  /* Stop this node and delete its state. */
  async terminate () {
    await this.kill()
    await this.erase() }

  abstract respawn (): Promise<void>
  abstract spawn   (): Promise<void>
  abstract kill    (): Promise<void>
  abstract erase   (): Promise<void>
  abstract save    (): this }


/** Run a pausable Secret Network localnet in a Docker container and manage its lifecycle.
 *  State is stored as a pile of files in a directory. */
export class ScrtNode extends BaseChainNode {

  /* Resolved when ready.
   * TODO check */
  readonly ready: Promise<void> = Promise.resolve()

  docker:    Docker

  container: any

  /* This should point to the standard production docker image for Secret Network. */
  image = "enigmampc/secret-network-sw-dev"

  /* This file is mounted into the localnet container
   * in place of its default init script in order to
   * add custom genesis accounts with initial balances. */
  readonly initScript = new TextFile(__dirname, 'scrt_localnet_init.sh')

  chainId = 'enigma-pub-testnet-3'

  identitiesToCreate: Array<string>

  protocol:  string = 'http'
  host:      string = 'localhost'
  port:      number

  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.docker)     this.docker           = options.docker
    if (options.image)      this.image            = options.image
    if (options.chainId)    this.chainId          = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    const stateRoot = options.stateRoot || resolve(defaultStateBase, this.chainId)
    Object.assign(this, {stateRoot:  new Directory(stateRoot),
                         identities: new Directory(stateRoot, 'identities'),
                         nodeState:  new JSONFile(stateRoot,  'node.json'),
                         daemonDir:  new Directory(stateRoot, '_secretd'),
                         clientDir:  new Directory(stateRoot, '_secretcli'),
                         sgxDir:     new Directory(stateRoot, '_sgx-secrets') }) }

  /* Write the state of the localnet to a file. */
  save () {
    console.debug('saving localnet node', { to: this.nodeState.path })
    const data = { containerId: this.container.id, chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this }

  /* All the directories that need to be mounted into/out of the container,
   * in a Dockerode-friendly format. */
  get binds () {
    return { [this.initScript.path]: `/init.sh:ro`,
             [this.identities.path]: `/shared-keys:rw`,
             [this.daemonDir.path]:  `/root/.secretd:rw`,
             [this.clientDir.path]:  `/root/.secretcli:rw`,
             [this.sgxDir.path]:     `/root/.sgx-secrets:rw` } }

  /* Environment variables that will be set in the container.
   * Use them to pass parameters to the init script. */
  get env () {
    return [`Port=${this.port}`
           ,`ChainID=${this.chainId}`
           ,`GenesisAccounts=${this.identitiesToCreate.join(' ')}`]}

  /** Dockerode passes these to the Docker API in order to launch a localnet container. */
  get spawnContainerOptions () {
    return pulled(this.image, this.docker).then((Image: string)=>({
      AutoRemove: true,
      Image, Name: `${this.chainId}-${this.port}`,
      Env: this.env, Entrypoint: [ '/bin/bash' ], Cmd: [ '/init.sh' ],
      Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
      Hostname: this.chainId, Domainname: this.chainId, ExposedPorts: { [`${this.port}/tcp`]: {} },
      HostConfig: { NetworkMode:  'bridge',
                    Binds:        Object.entries(this.binds).map(pair=>pair.join(':')),
                    PortBindings: { [`${this.port}/tcp`]: [{HostPort: `${this.port}`}] } } })) }

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
   *  in order to launch a cleanup container. */
  get cleanupContainerOptions () {
    return pulled(this.image, this.docker).then((Image:string)=>({
      Image, Name: `${this.chainId}-${this.port}-cleanup`,
      Entrypoint: [ '/bin/rm' ], Cmd: ['-rvf', '/state',],
      Tty: true, AttachStdin:  true, AttachStdout: true, AttachStderr: true,
      HostConfig: { NetworkMode: 'host',
                    Binds: [`${this.stateRoot}:/state:rw`] }, })) }

  async respawn () {
    console.debug(`⏳ respawning localnet at ${bold(this.nodeState.path)}...`)
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.debug(`✋ no localnet found at ${bold(this.nodeState.path)}`)
      return this.spawn() }
    // get stored info about the container was supposed to be
    let id: any; try { id = this.load().containerId } catch (e) {
      // if node state is corrupted, spawn
      console.warn(e)
      console.warn(`✋ reading ${bold(this.nodeState.path)} failed`)
      return this.spawn() }
    // check if contract is running
    let running: any; try { running = this.isRunning(id) } catch (e) {
      // if error when checking, RESPAWN
      console.warn(`✋ failed to get container ${bold(id)}`)
      console.info('Error was:', e)
      console.info(`⏳ cleaning up outdated state...`)
      await this.erase()
      console.info(`⏳ trying to spawn a new node...`)
      return this.spawn() }
    // if not running, RESPAWN
    if (!running) this.startContainer(id)
    // ...and try to make sure it dies when the Node process dies
    process.on('beforeExit', () => { this.killContainer(id) })
    // if running, do nothing
    // TODO allow attaching multiple times to the same localnet
  }

  private createContainer = async (options: Promise<any>) =>
    await this.docker.createContainer(await options)

  private startContainer = async (id: string = this.container.id) =>
    await this.docker.getContainer(id).start()

  private killContainer = async (id: string = this.container.id) => {
    if (await this.isRunning(id)) {
      console.info(`killing ${bold(id)}...`)
      await this.docker.getContainer(id).kill()
      console.info(`killed ${bold(id)}`) }
    else {
      console.debug(`${bold(id)} was dead on arrival`) } }

  private isRunning = async (id: string = this.container.id) =>
    (await this.docker.getContainer(id).inspect()).State.Running

  /** Spawn a new localnet instance from scratch */
  async spawn () {
    // tell the user that we have begun
    console.debug(`⏳ spawning new localnet...`)
    // get a free port
    this.port = (await freePort()) as number
    // create the state dirs and files
    for (const item of [
      this.stateRoot, this.nodeState,
      this.daemonDir, this.clientDir, this.sgxDir
    ]) item.make()
    // create the container
    this.container = await this.createContainer(this.spawnContainerOptions)
    // emit any warnings
    if (this.container.Warnings) {
      console.warn(`Creating container ${this.container.id} emitted warnings:`)
      console.info(this.container.Warnings) }
    // report progress
    console.info(`Created container ${this.container.id} (${bold(this.nodeState.path)})...`)
    // start the container
    await this.startContainer(this.container.id)
    console.info(`Started container ${this.container.id}...`)
    // update the
    this.save()
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(this.container, 'GENESIS COMPLETE')
    // wait for port to be open
    await waitPort({ host: this.host, port: this.port }) }

  /** Kill the container, if necessary find it first */
  async kill () {
    if (this.container) {
      await this.container.kill() }
    else {
      try {
        console.info(`seeing if any container needs to be killed`)
        const { containerId } = this.load()
        console.info(`to kill container ${bold(containerId)}`)
        const container = await this.docker.getContainer(containerId)
        console.info(`killing container ${bold(containerId)}`)
        await container.kill()
        console.info(`killed container ${bold(containerId)}`) }
      catch (e) {
        console.info("didn't kill any container") } } }

  /** Outside environment needs to be returned to a pristine state via Docker.
   *  (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.)*/
  async erase () {
    try {
      if (this.stateRoot.exists()) {
        console.info(`⏳ erasing ${bold(this.stateRoot.path)}`)
        await rimraf(this.stateRoot.path) } }
    catch (e) {
      if (e.code !== 'EACCES') {
        console.warn(`failed to delete ${bold(this.stateRoot.path)}, because:`)
        console.warn(e) }
      console.warn(`⏳ running cleanup container`)
      const container = await this.docker.createContainer(
        this.cleanupContainerOptions)
      await container.start()
      console.info('⏳ waiting for erase to finish')
      await container.wait()
      console.info(`erased ${bold(this.stateRoot.path)}`) } } }

export function pick (obj: Record<any, any>, ...keys: Array<any>) {
  return Object.keys(obj).filter(key=>keys.indexOf(key)>-1).reduce((obj2,key)=>{
    obj2[key] = obj[key]
    return obj2 }, {}) }

export function required (label: string) {
  return () => { throw new Error(`required: ${label}`) } }
