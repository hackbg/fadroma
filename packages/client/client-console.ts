import { CommandsConsole } from '@hackbg/komandi'
import { bold } from '@hackbg/konzola'
import type { Contract, Label, DeployArgs, Message, Chain } from './client'

/** Logging. */
export class ClientConsole extends CommandsConsole {
  beforeDeploy = (template: Contract<any>, label: Label) => this.info(
    'Deploy   ', bold(label),
    'from code id', bold(String(template.codeId ||'(unknown)')),
    'hash', bold(String(template.codeHash||'(unknown)'))
  )
  afterDeploy = (contract: Partial<Contract<any>>) => this.info(
    'Deployed ', bold(contract.name!), 'is', bold(contract.address!),
    'from code id', bold(contract.codeId!)
  )
  deployFailed = (e: Error, template: Contract<any>, name: Label, msg: Message) => {
    this.error()
    this.error(`  Deploy of ${bold(name)} failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedContract(template)
    this.error()
    this.error(`  Init message: `)
    this.error(`    ${JSON.stringify(msg)}`)
    this.error()
  }
  deployManyFailed = (template: Contract<any>, contracts: DeployArgs[] = [], e: Error) => {
    this.error()
    this.error(`  Deploy of multiple contracts failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedContract(template)
    this.error()
    this.error(`  Configs: `)
    for (const [name, init] of contracts) {
      this.error(`    ${bold(name)}: `, JSON.stringify(init))
    }
    this.error()
  }
  deployFailedContract = (template?: Contract<any>) => {
    this.error()
    if (!template) return this.error(`  No template was provided.`)
    this.error(`  Contract:   `)
    this.error(`    Chain ID: `, bold(template.chainId ||''))
    this.error(`    Code ID:  `, bold(template.codeId  ||''))
    this.error(`    Code hash:`, bold(template.codeHash||''))
  }
  chainStatus = ({ chain, deployments }: {
    chain?: Chain, deployments?: { active?: { name: string }, list (): string[] }
  }) => {
    if (!chain) return this.info('│ No active chain.')
    this.info('│ Chain type: ', bold(chain.constructor.name))
    this.info('│ Chain mode: ', bold(chain.mode))
    this.info('│ Chain ID:   ', bold(chain.id))
    this.info('│ Chain URL:  ', bold(chain.url.toString()))
    this.info('│ Deployments:', bold(String(deployments?.list().length)))
    if (!deployments?.active) return this.info('│ No active deployment.')
    this.info('│ Deployment: ', bold(String(deployments?.active?.name)))
  }
  warnUrlOverride = (a: any, b: any) =>
    this.warn(`node.url "${a}" overrides chain.url "${b}"`)
  warnIdOverride = (a: any, b: any) =>
    this.warn(`node.chainId "${a}" overrides chain.id "${b}"`)
  warnNodeNonDevnet = () =>
    this.warn(`"node" option is only applicable to devnets`)
  warnNoAgent = (name: string) =>
    this.warn(`${name}: no agent; actions will fail until agent is set`)
  warnNoAddress = (name: string) =>
    this.warn(`${name}: no address; actions will fail until address is set`)
  warnNoCodeHash = (name: string) =>
    this.warn(`${name}: no codeHash; actions may be slow until code hash is set`)
  warnNoCodeHashProvided = (address: string, realCodeHash: string) =>
    this.warn(`Code hash not provided for ${address}. Fetched: ${realCodeHash}`)
  warnCodeHashMismatch = (address: string, expected: string|undefined, fetched: string) =>
    this.warn(`Code hash mismatch for ${address}: expected ${expected}, fetched ${fetched}`)
  confirmCodeHash = (address: string, codeHash: string) =>
    this.info(`Confirmed code hash of ${address}: ${codeHash}`)
  waitingForNextBlock = () => this.info('Waiting for next block...')
}
