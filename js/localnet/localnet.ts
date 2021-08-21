import { Console, bold } from '@fadroma/cli'
const { warn, info, debug } = Console(import.meta.url)

import { resolve, dirname, fileURLToPath, mkdir, existsSync, touch, rimraf,
         writeFile, readFileSync, unlinkSync, loadJSON, cwd } from '@fadroma/sys'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const defaultStateBase = resolve(cwd(), 'artifacts')

import { Docker, waitPort, freePort, pulled, waitUntilLogsSay } from '@fadroma/net'

export type NodeCtorArgs = {
  docker?:  Docker
  image?:   string
  chainId?: string
  genesisAccounts?: Array<string>
  state?:   string,
}

export interface Node {
  new       (args: NodeCtorArgs)
  load      (): Record<any, any>
  save      (): Promise<void>
  erase     (): Promise<void>
  respawn   (): Promise<void>
  spawn     (): Promise<void>
  suspend   (): Promise<void>
  terminate (): Promise<void>
}

/** @class
 *  Run a pausable Secret Network localnet in a Docker container and manage its lifecycle.
 *  State is stored as a pile of files in directories.
 */
export class ScrtNode implements ScrtNode {
  docker:    Docker
  image:     string
  container: any
  protocol:  string
  host:      string
  port:      number
  state:     string | null
  chainId:   string
  genesisAccounts: Array<string>

  constructor ({
    docker  = new Docker({ socketPath: '/var/run/docker.sock' }),
    image   = "enigmampc/secret-network-sw-dev",
    chainId = 'enigma-pub-testnet-3',
    genesisAccounts = ['ADMIN', 'ALICE', 'BOB', 'MALLORY'],
    state   = resolve(defaultStateBase, chainId),
  }: NodeCtorArgs = {}) {
    Object.assign(this, { state, docker, chainId, genesisAccounts, image })
    if (existsSync(this.state) && existsSync(this.files.nodeState)) {
      try {
        this.load() }
      catch (e) {
        warn(e)
        unlinkSync(this.files.nodeState) } } }

  load () {
    debug('loading localnet node', { from: this.files.nodeState })
    const data = JSON.parse(readFileSync(this.files.nodeState, 'utf8'))
    debug('loaded localnet node', data)
    return data }

  async save () {
    debug('saving localnet node', { to: this.files.nodeState })
    await writeFile(this.files.nodeState, JSON.stringify({
      containerId: this.container.id,
      chainId:     this.chainId,
      port:        this.port, }, null, 2), 'utf8') }

  /** Outside environment needs to be returned to a pristine state via Docker.
   *  (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.)*/
  async erase () {
    try {
      // try without root first
      if (existsSync(this.state)) {
        info(`⏳ erasing ${bold(this.state)}`)
        await rimraf(this.state) }
      else {
        info(`${bold(this.state)} does not exist`) } }
    catch (e) {
      if (e.code !== 'EACCES') {
        warn(`failed to delete ${bold(this.state)}, because:`)
        warn(e) }
      warn(`⏳ running cleanup container`)
      const container = await this.docker.createContainer(await this.cleanupContainerOptions)
      await container.start()
      info('⏳ waiting for erase to finish')
      await container.wait()
      info(`erased ${bold(this.state)}`) } }

  // piles of files:
  get files () {
    return { initScript: resolve(__dirname, 'scrt_localnet_init.sh')
           , nodeState:  resolve(this.state, 'node.json') } }
  // and dirs:
  get dirs () {
    return { state:      this.state
           , wallets:    resolve(this.state, 'wallets')
           , secretd:    resolve(this.state, '.secretd')
           , secretcli:  resolve(this.state, '.secretcli')
           , sgxSecrets: resolve(this.state, '.sgx-secrets') } }
  // volume mounts
  get binds () {
    return [`${this.files.initScript}:/init.sh:ro`
           ,`${this.dirs.wallets}:/shared-keys:rw`
           ,`${this.dirs.secretd}:/root/.secretd:rw`
           ,`${this.dirs.secretcli}:/root/.secretcli:rw`
           ,`${this.dirs.sgxSecrets}:/root/.sgx-secrets:rw`]}
  // environment
  get env () {
    return [
      `Port=${this.port}`,
      `ChainID=${this.chainId}`,
      `GenesisAccounts=${this.genesisAccounts.join(' ')}`]}

  // deprecati:
  get initScript     () { return this.files.initScript    }
  get nodeStateFile  () { return this.files.nodeState     }
  get keysStateDir   () { return this.dirs.wallets        }
  get daemonStateDir () { return this.dirs.secretd        }
  get cliStateDir    () { return this.dirs.secretcli      }
  get sgxStateDir    () { return this.dirs.sgxSecrets     }
  get stateDirs      () { return Object.values(this.dirs) }

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
   *  in order to launch a localnet container. */
  get spawnContainerOptions () {
    return pulled(this.image, this.docker).then((Image: string)=>({
      Image,
      Name:         `${this.chainId}-${this.port}`,
      Hostname:     this.chainId,
      Domainname:   this.chainId,
      Entrypoint:   [ '/bin/bash' ],
      Cmd:          [ '/init.sh' ],
      Tty:          true,
      AttachStdin:  true,
      AttachStdout: true,
      AttachStderr: true,
      Env:          this.env,
      ExposedPorts: { [`${this.port}/tcp`]: {} },
      AutoRemove: true,
      HostConfig: {
        NetworkMode: 'bridge',
        Binds: this.binds,
        PortBindings: {
          [`${this.port}/tcp`]: [{HostPort: `${this.port}`}], }, }, })) }

  async respawn () {
    debug(`⏳ respawning localnet at ${bold(this.files.nodeState)}...`)

    if (!existsSync(this.files.nodeState)) {
      debug(`✋ no localnet found at ${bold(this.files.nodeState)}`)
      return this.spawn()
    }

    // get stored info about the container was supposed to be
    let restored
    try {
      restored = await this.load() }
    catch (e) {
      // spawn a new one if the node state is corrupted
      warn(e)
      warn(`✋ reading ${bold(this.files.nodeState)} failed`)
      return this.spawn() }

    // what was the container id supposed to be
    const id = restored.containerId
    let container: any
      , Running:   any
    try {
      // if it exists then we can see if it's running
      container = this.docker.getContainer(id)
      ;({State:{Running}} = await container.inspect()) }
    catch (e) {
      // if it doesn't we need to spawn a new one
      warn(`✋ getting container ${bold(id)} failed, trying to spawn a new node...`)
      info(`⏳ cleaning up outdated state`)
      await this.erase()
      return this.spawn() }

    // if the container exists and isn't running then we JUST have to start it...
    if (!Running) await container.start({})

    // ...and try to make sure it dies when the Node process dies
    // TODO although that's a preference and should be optional:
    // attaching multiple times to the same development localnet
    // has definite merit in not having to wait through the setup phase each time...
    process.on('beforeExit', async ()=>{
      const {State:{Running}} = await container.inspect()
      if (Running) {
        debug(`killing ${bold(container.id)}`)
        await container.kill()
        debug(`killed ${bold(container.id)}`)
        process.exit() // do I need to call this?
        // i doubt the event prevents the process from exiting if bound
        // but who knows all is possible in dynamic lang
      } else {
        debug(`${bold(container.id)} was dead on arrival`) } }) }

  async spawn () {
    debug(`⏳ spawning new localnet at ${bold(this.files.nodeState)}...`)
    mkdir(this.state)
    touch(this.files.nodeState)
    for (const dir of Object.values(this.dirs)) {
      mkdir(dir) }
    Object.assign(this, {
      protocol: 'http',
      host: 'localhost',
      port: await freePort() })
    this.container = await this.docker.createContainer(
      await this.spawnContainerOptions)
    const { id: containerId, Warnings: w } = this.container
    if (w) console.warn(w)
    await this.container.start()
    await this.save()
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(this.container, 'GENESIS COMPLETE')
    // wait for port to be open
    await waitPort({ host: this.host, port: this.port }) }

  /**Return one of the genesis accounts stored when creating the node.
   * @param {string} name - the name of the account.
   */
  genesisAccount = (name: string) =>
    loadJSON(resolve(this.keysStateDir, `${name}.json`))

  async terminate () {
    await this.suspend()
    await this.erase() }

  async suspend () {
    if (this.container) {
      await this.container.kill() }
    else {
      try {
        info(`seeing if any container needs to be killed`)
        const { containerId } = await this.load()
        info(`to kill container ${bold(containerId)}`)
        const container = await this.docker.getContainer(containerId)
        info(`killing container ${bold(containerId)}`)
        await container.kill()
        info(`killed container ${bold(containerId)}`) }
      catch (e) {
        info("didn't kill any container") } } }

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
   *  in order to launch a cleanup container.
   */
  get cleanupContainerOptions () {
    return pulled(this.image, this.docker).then((Image:string)=>({
      Image,
      Entrypoint:   [ '/bin/rm' ],
      Cmd:          ['-rvf', '/state',],
      Tty:          true,
      AttachStdin:  true,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        NetworkMode: 'host',
        Binds: [`${this.state}:/state:rw`] }, })) }

}

function pick (obj, ...keys) {
  return Object.keys(obj).filter(key=>keys.indexOf(key)>-1).reduce((obj2,key)=>{
    obj2[key] = obj[key]
    return obj2
  }, {})
}

function required (label) {
  return () => { throw new Error(`required: ${label}`) }
}
