import Docker from 'dockerode'
import colors from 'colors/safe.js'

import { loadJSON } from '../schema.js'
import {
  resolve, mkdir, existsSync, touch, dirname, fileURLToPath, readFile, writeFile, rimraf,
  readFileSync
} from '../sys.js'
import { waitPort, freePort, pull, waitUntilLogsSay } from '../net.js'
import { defaultStateBase } from './index.js'

const { bold } = colors
const { warn, log, info, debug } = console
const __dirname = dirname(fileURLToPath(import.meta.url))

/** @class
 * Run a pausable Secret Network localnet in a Docker container and manage its lifecycle.
 * State is stored as a pile of files in directories.
 */
export default class SecretNetworkNode {

  constructor (options = {}) {
    const {
      docker          = new Docker({ socketPath: '/var/run/docker.sock' }),
      chainId         = 'enigma-pub-testnet-3',
      state           = resolve(defaultStateBase, chainId),
      genesisAccounts = ['ADMIN', 'ALICE', 'BOB', 'MALLORY'],
      image           = pull("enigmampc/secret-network-sw-dev", docker)
    } = options

    Object.assign(this, {
      state,
      docker,
      chainId,
      genesisAccounts,
      image: Promise.resolve(image)
        .catch(e=>error('failed to pull image', e))
    })
    debug('new', this)

    if (existsSync(this.state) && existsSync(this.nodeStateFile)) this.load()
  }

  load () {
    const data = JSON.parse(readFileSync(this.nodeStateFile, 'utf8'))
    debug('load', data)
    return data
  }

  async save () {
    await writeFile(this.nodeStateFile, JSON.stringify({
      containerId: this.container.id,
      chainId:     this.chainId,
      port:        this.port,
    }, null, 2), 'utf8')
  }

  /** Outside environment needs to be returned to a pristine state via Docker.
   *  (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.)
   */
  async erase () {
    try {
      // try without root first
      if (existsSync(this.state)) {
        info(`erasing ${bold(this.state)}`)
        await rimraf(this.state)
      } else {
        info(`${bold(this.state)} does not exist`)
      }
    } catch (e) {
      warn(`failed to delete ${bold(this.state)}, because:`)
      warn(e)
      warn(`running cleanup container`)
      const container = await this.docker.createContainer(await this.cleanupContainerOptions)
      await container.start()
      info('waiting for erase to finish')
      await container.wait()
      info(`erased ${bold(this.state)}`)
    }
  }

  // pile of files:

  get initScript () {
    return resolve(__dirname, 'init.sh')
  }

  get nodeStateFile () {
    return resolve(this.state, 'node.json')
  }

  get keysStateDir () {
    return resolve(this.state, 'wallets')
  }

  get daemonStateDir () {
    return resolve(this.state, '.secretd')
  }

  get cliStateDir () {
    return resolve(this.state, '.secretcli')
  }

  get sgxStateDir () {
    return resolve(this.state, '.sgx-secrets')
  }

  get stateDirs () {
    return [this.keysStateDir, this.daemonStateDir, this.cliStateDir, this.sgxStateDir]
  }

  get binds () {
    return [
      `${this.initScript}:/init.sh:ro`,
      `${this.keysStateDir}:/shared-keys:rw`,
      `${this.daemonStateDir}:/root/.secretd:rw`,
      `${this.cliStateDir}:/root/.secretcli:rw`,
      `${this.sgxStateDir}:/root/.sgx-secrets:rw`
    ]
  }

  get env () {
    return [
      `Port=${this.port}`,
      `ChainID=${this.chainId}`,
      `GenesisAccounts=${this.genesisAccounts.join(' ')}`
    ]
  }

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
   *  in order to launch a localnet container.
   */
  get spawnContainerOptions () {
    return this.image.then(Image=>({
      Image,
      Entrypoint:   [ '/bin/bash' ],
      Cmd:          [ '/init.sh' ],
      Tty:          true,
      AttachStdin:  true,
      AttachStdout: true,
      AttachStderr: true,
      Env:          this.env,
      HostConfig: {
        NetworkMode: 'host',
        Binds:       this.binds
      },
    }))
  }

  async respawn () {
    debug(`⏳ respawning localnet at ${bold(this.nodeStateFile)}...`)

    if (!existsSync(this.nodeStateFile)) {
      debug(`✋ no localnet found at ${bold(this.nodeStateFile)}`)
      return this.spawn()
    }

    let restored
    try {
      restored = await this.load()
    } catch (e) {
      warn(e)
      warn(`✋ reading ${bold(this.nodeStateFile)} failed`)
      return this.spawn(options)
    }

    const { containerId, port } = restored
    let container, Running
    try {
      container = docker.getContainer(containerId)
      ;({State:{Running}} = await container.inspect())
    } catch (e) {
      warn(`✋ getting container ${bold(containerId)} failed, trying to spawn a new node...`)
      info(`⏳ cleaning up outdated state`)
      await this.erase()
      return this.spawn()
    }

    if (!Running) await container.start({})
    process.on('beforeExit', async ()=>{
      const {State:{Running}} = await container.inspect()
      if (Running) {
        debug(`killing ${bold(container.id)}`)
        await container.kill()
        debug(`killed ${bold(container.id)}`)
        process.exit()
      }
    })
  }

  async spawn () {
    debug(`⏳ spawning new localnet at ${bold(this.nodeStateFile)}...`)

    touch(this.nodeStateFile)
    for (const dir of this.stateDirs) {
      mkdir(dir)
    }

    Object.assign(this, {
      protocol: 'http',
      host:     'localhost',
      port:     await freePort(),
    })
    this.container = await this.docker.createContainer(
      await this.spawnContainerOptions
    )
    const {id: containerId} = this.container
    await this.container.start()
    await this.save()

    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(this.container, 'GENESIS COMPLETE')

    // wait for port to be open
    await waitPort({
      host: this.host,
      port: this.port
    })
  }

  /**Return one of the genesis accounts stored when creating the node.
   * @param {string} name - the name of the account.
   */
  genesisAccount = name =>
    loadJSON(resolve(this.keysStateDir, `${name}.json`))

  async suspend () {
    if (this.container) {
      await this.container.kill()
    } else {
      try {
        info(`seeing if any container needs to be killed`)
        const { containerId } = await load()
        info(`to kill container ${bold(containerId)}`)
        const container = await docker.getContainer(containerId)
        info(`killing container ${bold(containerId)}`)
        await container.kill()
        info(`killed container ${bold(containerId)}`)
      } catch (e) {
        info("didn't kill any container")
      }
    }
  }

  async terminate () {
    await this.suspend()
    await this.erase()
  }

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
   *  in order to launch a cleanup container.
   */
  get cleanupContainerOptions () {
    const Cmd = [
      '-rvf',
      '/shared-keys',
      '/root/.secretd',
      '/root/.secretcli',
      '/root/.sgx-secrets'
    ]
    return this.image.then(Image=>({
      Image,
      Entrypoint: [ '/bin/rm' ],
      Cmd,
      Tty:          true,
      AttachStdin:  true,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        NetworkMode: 'host',
        Binds:       this.binds
      },
    }))
  }

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
