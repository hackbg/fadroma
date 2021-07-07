//import assert from 'assert'
import Docker from 'dockerode'
import {bold, resolve, relative, existsSync, taskmaster} from '@fadroma/utilities'
import {SecretNetwork} from '@fadroma/scrt-agent'
import {pull} from '../netutil.js'
import Builder from '../builder/Builder.js'

const required = label => { throw new Error(`required override: ${label}`) }

export const ContractEnsembleErrors = {
  NOTHING: "Please specify a network, agent, or builder",
  AGENT:   "Can't use agent with different network",
  BUILDER: "Can't use builder with different network",
}

export default class ScrtEnsemble {

  static Errors = ContractEnsembleErrors

  docker = new Docker({ socketPath: '/var/run/docker.sock' })

  buildImage = 'enigmampc/secret-contract-optimizer:latest'

  prefix = new Date().toISOString().replace(/[-:\.]/g, '-').replace(/[TZ]/g, '_')

  contracts = {}

  /** Commands to expose to the CLI. */
  get commands () {
    return [this.localCommands, null, this.remoteCommands]
  }

  /** Commands that can be executed locally. */
  get localCommands () {
    return [
      ["build", '👷 Compile contracts from working tree',
        (context, sequential) => this.build({...context, parallel: !sequential})],
      /* implement other commands in subclass */
    ]
  }

  /** Commands that require a connection to a network. */
  get remoteCommands () {
    // TODO return empty array (or handles to network commands)
    // if this Ensemble instance does not have a network */
    return [
      ["deploy", '🚀 Build, init, and deploy this component',
        (context) => this.deploy(context).then(console.info)]
      /* implement other commands in subclass */
    ]
  }

  /** Composition goes `builder { agent { network } }`.
    * `agent` and `builder` can be different if you want the contract
    * to be uploaded from one address and instantiated from another,
    * but obviously they both need to reference the same network.
    *
    * It is also possible to instantiate an Ensemble without network,
    * agent, or builder; it would only be able to run local commands. */
  constructor (options = {}) {
    let { network, agent, builder = this.builder, workspace } = options
    Object.assign(this, { network, agent, builder, workspace })
  }

  async build (options = {}) {
    const { task      = taskmaster()
          , builder   = this.builder   || new Builder({ docker: this.docker })
          , workspace = this.workspace || required('workspace')
          , outputDir = resolve(workspace, 'artifacts')
          , parallel  = true } = options
    // pull build container
    await pull(this.buildImage, this.docker)
    // build all contracts
    const { contracts, constructor: { name: myName } } = this
    return await (parallel ? buildInParallel() : buildInSeries())

    async function buildInParallel () {
      const binaries = {}
      await task.parallel(`build ${myName}`,
        ...Object.entries(contracts).map(([name, {crate}])=>
          task(`build ${name}`, async () => {
            binaries[name] = await builder.build({...options, outputDir, workspace, crate})
          })
        )
      )
      return binaries
    }

    async function buildInSeries () {
      const binaries = {}
      for (const [name, {crate}] of Object.entries(contracts)) {
        await task(`build ${myName}.contracts.${name}`, async () => {
          const buildOutput = resolve(outputDir, `${crate}@HEAD.wasm`)
          if (existsSync(buildOutput)) {
            const path = relative(process.cwd(), buildOutput)
            console.info(`ℹ️  ${bold(path)} exists, delete to rebuild.`)
            binaries[name] = buildOutput
          } else {
            binaries[name] = await builder.build({outputDir, workspace, crate})
          }
        })
      }
      return binaries
    }
  }

  async upload (options = {}) {
    const { task     = taskmaster()
          , network  = this.network
          , builder  = this.builder
          , binaries = await build() // if binaries are not passed, build 'em
          } = options
    const receipts = {}
    for (const contract of Object.keys(this.contracts)) {
      await task(`upload ${contract}`, async report => {
        const receipt = receipts[contract] = await builder.uploadCached(binaries[contract])
        console.log(`⚖️  compressed size ${receipt.compressedSize} bytes`)
        report(receipt.transactionHash)
      })
    }
    return receipts
  }

  async deploy (options = {}) {
    let network = SecretNetwork.hydrate(options.network || this.network)
    if (!(network instanceof SecretNetwork)) {
      throw new Error('need a SecretNetwork connection to deploy')
    }
    const { agent, builder } = await network.connect()
    const { task = taskmaster(), initMsgs = {} } = options
    return await task('build, upload, and initialize contracts', async () => {
      const binaries = await this.build({ ...options, task, builder, workspace: options.workspace || this.workspace })
      const receipts  = await this.upload({ task, network, builder, binaries })
      const contracts = await this.initialize({ task, network, receipts, agent })
      return contracts
    })
  }

  /** Stub to be implemented by the subclass.
   *  In the future it might be interesting to see if we can add some basic dependency resolution.
   *  It just needs to be standardized on the Rust side (in scrt-callback)? */
  async initialize () {
    throw new Error('You need to implement a custom initialize() method.')
  }

}
