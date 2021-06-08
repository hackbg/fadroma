import taskmaster from '@fadroma/utilities/taskmaster.js'
import { resolve, relative, existsSync } from '@fadroma/utilities/sys.js'
import { pull } from '@fadroma/utilities/net.js'

import { SecretNetwork } from '@fadroma/scrt-agent'

import colors from 'colors/safe.js'
import assert from 'assert'
const {bold} = colors

const required = label => { throw new Error(`required override: ${label}`) }

export default class ContractEnsemble {

  static contracts = {}

  static async build (options = {}) {
    const { task      = taskmaster()
          , builder   = new SecretNetwork.Builder()
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

  static async upload (options = {}) {
    const { task     = taskmaster()
          , binaries = await build() // if binaries are not passed, build 'em
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

  static initialize = async () => { throw new Error('not implemented!') }

  static async deploy (options = {}) {
    const { task     = taskmaster()
          , initMsgs = {}
          , schedule = getDefaultSchedule()
          } = options

    let { agent
        , builder = agent ? agent.getBuilder() : undefined
        , network = builder ? builder.network : await pickNetwork()
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
      const contracts = await this.initialize({ task, receipts, agent, schedule })
    })
  }

  static configure = async () => { throw new Error('not implemented!') }

  static transferOwnership = async () => { throw new Error('not implemented!') }

}
