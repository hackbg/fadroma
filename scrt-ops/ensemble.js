import assert from 'assert'
import { bold, resolve, relative, existsSync, taskmaster } from '@fadroma/utilities'
import {SecretNetwork} from '@fadroma/scrt-agent'
import { pull } from './net.js'
import Builder from './builder.js'

const required = label => { throw new Error(`required override: ${label}`) }

export default class ContractEnsemble {

  prefix = new Date().toISOString().replace(/[-:\.]/g, '-').replace(/[TZ]/g, '_')

  contracts = {}

  get commands () {
    return [this.localCommands, null, this.remoteCommands]
  }

  get localCommands () {
    return [ /* implement in subclass */ ]
  }

  get remoteCommands () {
    return [ /* implement in subclass */ ]
  }

  async build (options = {}) {
    const { task      = taskmaster()
          , builder   = new Builder()
          , workspace = this.workspace || required('workspace')
          , outputDir = resolve(this.workspace, 'artifacts')
          , parallel  = true } = options

    // pull build container
    await pull('enigmampc/secret-contract-optimizer:latest')

    // build all contracts
    const binaries = {}
    if (parallel) {
      await task.parallel('build project',
        ...Object.entries(this.contracts).map(([name, {crate}])=>
          task(`build ${name}`, async report => {
            binaries[name] = await builder.build({outputDir, workspace, crate})
          })))
    } else {
      for (const [name, {crate}] of Object.entries(this.contracts)) {
        await task(`build ${name}`, async report => {
          const buildOutput = resolve(outputDir, `${crate}@HEAD.wasm`)
          if (existsSync(buildOutput)) {
            console.info(`ℹ️  ${bold(relative(process.cwd(),buildOutput))} exists, delete to rebuild.`)
            binaries[name] = buildOutput
          } else {
            binaries[name] = await builder.build({outputDir, workspace, crate})
          }
        })
      }
    }

    return binaries
  }

  async upload (options = {}) {
    const { task      = taskmaster()
          , stateBase = process.cwd()
          , binaries  = await build() // if binaries are not passed, build 'em
          } = options

    let { builder
        , network = builder ? null : await SecretNetwork.localnet({stateBase}) } = options
    if (typeof network === 'string') network = await SecretNetwork[network]({stateBase})
    if (!builder) builder = network.builder

    const receipts = {}
    for (let contract of Object.keys(this.contracts)) {
      await task(`upload ${contract}`, async report => {
        const receipt = receipts[contract] = await builder.uploadCached(binaries[contract])
        console.log(`⚖️  compressed size ${receipt.compressedSize} bytes`)
        report(receipt.transactionHash) }) }

    return receipts
  }

  async deploy (options = {}) {
    const { task     = taskmaster()
          , initMsgs = {}
          } = options

    let { agent
        , builder = agent? new Builder({network: agent.network, agent})
                         : undefined
        , network = builder? builder.network
                           : await pickNetwork()
        } = options

    if (typeof network === 'string') {
      assert(['localnet','testnet','mainnet'].indexOf(network) > -1)
      const conn = await SecretNetwork[network]()
      network = conn.network
      agent   = conn.agent
      builder = conn.builder
    }

    return await task('build, upload, and initialize contracts', async () => {
      const binaries  = await this.build({ task, builder })
      const receipts  = await this.upload({ task, builder, binaries })
      const contracts = await this.initialize({ task, receipts, agent })
    })
  }

}
