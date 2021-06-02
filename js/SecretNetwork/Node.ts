import Docker from "https://deno.land/x/denocker/index.ts"

/** @class
 * Run a pausable Secret Network localnet in a Docker container and manage its lifecycle
 */
export default class SecretNetworkNode {

  stateBase: string        = process.cwd()
  chainId:   string        = 'enigma-pub-testnet-3';
  state:     string        = join(stateBase, chainId)
  docker:    Docker        = new Docker({ socketPath: '/var/run/docker.sock' })
  genesis:   Array<string> = ['ADMIN', 'ALICE', 'BOB', 'MALLORY']

  protocol: string = 'http'
  host:     string = 'localhost'
  port:     number = 1337

  container: any;

  constructor (options = {}) {
    // allow overrides
    Object.assign(this, pick(options, 'chainId', 'state', 'docker', 'genesis'))
  }

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

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
   *  in order to instantiate a localnet container.
   */
  get containerOptions () {
    return {
      Image: this.image,
      Entrypoint: [ '/bin/bash' ],
      Cmd:        [ '/init.sh' ],
      AttachStdin:  true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: [
        `Port=${this.port}`,
        `ChainID=${this.chainId}`,
        `GenesisAccounts=${this.genesisAccounts.join(' ')}`
      ],
      HostConfig: {
        NetworkMode: 'host',
        Binds: [
          `${this.initScript}:/init.sh:ro`
          `${this.keysStateDir}:/shared-keys:rw`
          `${this.daemonStateDir}:/root/.secretd:rw`
          `${this.cliStateDir}:/root/.secretcli:rw`
          `${this.sgxStateDir}:/root/.sgx-secrets:rw`
        ]
      } 
    }
  }

  async spawn () {
    debug('spawning a new localnet container...')

    touch(this.nodeStateFile)

    for (const dir of this.stateDirs) {
      mkdir(dir)
    }

    Object.assign(this, {
      protocol: 'http',
      host:     'localhost',
      port:     await freePort(),
      image:    await pull("enigmampc/secret-network-sw-dev", docker)
    })

    this.container = await docker.createContainer(this.containerOptions)

    // create container with the above options
    const container = await docker.createContainer(containerOptions)
    const {id: containerId} = container
    await container.start()

    // store a handle to the container
    await this.save()

    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(container, 'GENESIS COMPLETE')

    // wait for port to be open
    waitPort({
      host: this.host,
      port: this.port
    })
  }

  async save () {
    await writeFile(this.nodeStateFile, JSON.stringify(pick(this,
      'chainId',
      'containerId',
      'port"
    }, null, 2), 'utf8')
  }

  async suspend () {
    if (this.container) {
      await this.container.kill()
    } else {
      throw new Error('spawn a container first')
    }
  }

  respawn () {
  }

  terminate () {
  }

}

function pick (obj: Record<string,any>, ...keys:any) {
  return Object.keys(obj)
    .filter(key=>keys.indexOf(key)>-1)
    .reduce((obj2: Record<string,any>, key: any)=>
      Object.assign(obj2, {[key]: obj[key]}),
      {})
}

function required (label: any) {
  return () => { throw new Error(`required: ${label}`) }
}
