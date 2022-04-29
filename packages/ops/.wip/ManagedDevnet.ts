/** Parameters for the HTTP API-based implementation of Devnet. */
export type ManagedDevnetOptions = DevnetOptions & {
  /** Base URL of the API that controls the managed node. */
  managerURL: string
}

/** When running in docker-compose, Fadroma needs to request
  * from the devnet container to spawn a chain node with the
  * given chain id and identities via a HTTP API. */
export class ManagedDevnet extends Devnet {

  /** Makes sure that the latest devnet is reused,
    * unless explicitly specified otherwise. */
  static getOrCreate (
    managerURL: string,
    chainId?:   string,
    prefix?:    string
  ) {
    // If passed a chain id, use that;
    // this makes a passed prefix irrelevant.
    if (chainId && prefix) {
      console.warn(
        'Passed both chainId and prefix to ManagedDevnet.get: ignoring prefix'
      )
    }
    // Establish default prefix.
    // Chain subclasses should define this.
    if (!prefix) {
      prefix = 'devnet'
    }
    // If no chain id passed, try to reuse the
    // last created devnet; if there isn't one,
    // create a new one and symlink it as active.
    if (!chainId) {
      const active = resolve(config.projectRoot, 'receipts', `${prefix}-active`)
      if (existsSync(active)) {
        chainId = basename(readlinkSync(active))
        console.info('Reusing existing managed devnet with chain id', bold(chainId))
      } else {
        chainId = `${prefix}-${randomHex(4)}`
        const devnet = resolve(config.projectRoot, 'receipts', chainId)
        mkdirp.sync(devnet)
        symlinkSync(devnet, active)
        console.info('Creating new managed devnet with chain id', bold(chainId))
      }
    }
    return new ManagedDevnet({ managerURL, chainId })
  }

  constructor (options) {
    super(options)
    console.info(
      'Constructing', bold('remotely managed'), 'devnet'
    )
    const { managerURL = config.devnetManager } = options
    this.manager = new Endpoint(managerURL)
  }

  manager: Endpoint

  apiURL: URL = new URL('http://devnet:1317')

  async spawn () {
    const port = await freeportAsync()
    this.apiURL.port = port
    console.info(
      bold('Spawning managed devnet'), this.chainId,
      'on port', port
    )
    await this.manager.get('/spawn', {
      id:      this.chainId,
      genesis: this.genesisAccounts.join(','),
      port
    })
    await this.ready()
    return this
  }

  save () {
    const shortPath = relative(config.projectRoot, this.nodeState.path)
    console.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }

  async respawn () {
    const shortPath = relative(config.projectRoot, this.nodeState.path)
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
      await new Promise(resolve=>setTimeout(resolve, 1000))
    }
  }

  async getGenesisAccount (name: string): Promise<object> {
    return this.manager.get('/identity', { name })
  }

  async erase () { throw new Error('not implemented') }

  async kill () { throw new Error('not implemented') }

}
