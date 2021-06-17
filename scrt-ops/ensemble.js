import assert from 'assert'
import { bold, resolve, relative, existsSync, taskmaster } from '@fadroma/utilities'
import {SecretNetwork} from '@fadroma/scrt-agent'
import { pull } from './net.js'
import Builder from './builder.js'

const required = label => { throw new Error(`required override: ${label}`) }

export const ContractEnsembleErrors = {
  NOTHING: "Please specify a network, agent, or builder",
  AGENT:   "Can't use agent with different network",
  BUILDER: "Can't use builder with different network",
}

export default class ContractEnsemble {

  static Errors = ContractEnsembleErrors

  prefix = new Date().toISOString().replace(/[-:\.]/g, '-').replace(/[TZ]/g, '_')

  builder = new Builder()

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
    let { network, agent, builder = this.builder } = options

    if (network) {
      if (typeof network === 'string') {
        assert(['localnet','testnet','mainnet'].indexOf(network) > -1)
        network = SecretNetwork[network]()
      }
      if (!agent && !builder) {
        agent = network.agent
        builder = network.getBuilder(agent)
      } else if (!agent) {
        agent = builder.agent
      } else if (!builder) {
        builder = network.getBuilder(agent)
      }
    } else if (agent) {
      network = agent.network
      if (!builder) {
        builder = network.getBuilder(agent)
      }
    } else if (builder && builder.agent) {
      network = builder.agent.network
      agent = builder.agent
    }/* else {
      throw new Error(ContractEnsembleErrors.NOTHING)
    }*/

    if (agent && agent.network !== network) {
      throw new Error(ContractEnsembleErrors.AGENT)
    }
    if (builder && builder.agent && builder.agent.network !== network) {
      throw new Error(ContractEnsembleErrors.BUILDER)
    }

    Object.assign(this, { network, agent, builder })
  }

  buildImage = 'enigmampc/secret-contract-optimizer:latest'

  async build (options = {}) {
    const { task      = taskmaster()
          , builder   = this.builder
          , workspace = this.workspace || required('workspace')
          , outputDir = resolve(this.workspace, 'artifacts')
          , parallel  = true } = options
    // pull build container
    await pull(this.buildImage)
    // build all contracts
    const { contracts, constructor: { name: myName } } = this
    return await (parallel ? buildParallel() : buildSeries())

    async function buildParallel () {
      const binaries = {}
      await task.parallel(`build ${myName}`,
        ...Object.entries(contracts).map(([name, {crate}])=>
          task(`build ${name}`, async report => {
            binaries[name] = await builder.build({outputDir, workspace, crate})
          })
        )
      )
      return binaries
    }

    async function buildSeries () {
      const binaries = {}
      for (const [name, {crate}] of Object.entries(contracts)) {
        await task(`build ${myName}.contracts.${name}`, async report => {
          const buildOutput = resolve(outputDir, `${crate}@HEAD.wasm`)
          if (existsSync(buildOutput)) {
            console.info(`ℹ️  ${bold(relative(process.cwd(),buildOutput))} exists, delete to rebuild.`)
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
    const { builder   = this.builder
          , task      = taskmaster()
          , stateBase = resolve(process.cwd(), 'artifacts')
          , binaries  = await build() // if binaries are not passed, build 'em
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
    const { network, builder, agent } = this
    const { task = taskmaster(), initMsgs = {} } = options
    return await task('build, upload, and initialize contracts', async () => {
      const binaries  = await this.build({ task, builder })
      const receipts  = await this.upload({ task, network, builder, binaries })
      const contracts = await this.initialize({ task, network, receipts, agent })
      return contracts
    })
  }

  async initialize () {
    throw new Error('You need to implement a custom initialize() method.')
  }

}
