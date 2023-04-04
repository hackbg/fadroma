import type { 
  Address, Chain, Client, CodeHash, CodeId, Contract, Deployment, Instantiable,
  Label, Maybe, Message, Name,
} from '../index'
import Error from './Error'
import { CommandsConsole } from '@hackbg/cmds'
import { bold, colors } from '@hackbg/logs'

export default class Console extends CommandsConsole {

  constructor (label: string = 'Fadroma') {
    super(label)
    this.label = label
  }

  object (obj?: Object) {
    let report = `---`
    if (obj) {
      report += `\n${bold(obj?.constructor?.name??'Object')}:`
      for (const x in obj) {
        let k: any = colors.dim(`${x}:`.padEnd(15))
        let v: any = obj[x as keyof typeof obj]
        if (typeof v === 'function') {
          v = bold(v.name ? `[function ${v.name}]` : `[function]`)
        } if (v instanceof Array && v.length === 0) {
          v = colors.gray('[empty array]')
        } else if (v && typeof v.toString === 'function') {
          v = bold(v.toString())
        } else if (v) {
          try {
            v = bold(v)
          } catch (e) {
            v = bold('[something]')
          }
        } else {
          v = colors.gray('[empty]')
        }
        report += `\n  ` + k + ' ' + v
      }
    } else {
      report += `\n[empty]`
    }
    console.log(report)
  }

  deployment (deployment: Deployment, name = deployment?.name) {
    this.br()
    if (deployment) {
      const { state = {}, name } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.max(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      const count = Object.values(state).length
      if (count > 0) {
        this.br()
        this.info(`${bold(String(count))} contracts in deployment ${bold(name)}:`)
        for (const name of Object.keys(state).sort()) {
          this.receipt(name, state[name], len)
        }
      } else {
        this.info(`No contracts in deployment ${bold(name)}.`)
      }
    } else {
      this.info('There is no selected deployment.')
    }
    this.br()
  }

  receipt (name: string, receipt?: any, len?: number) {
    name    ||= '(unnamed)'
    receipt ||= {}
    len     ??= 35
    let {
      address    = colors.gray('(unspecified address)'),
      codeHash   = colors.gray('(unspecified code hash)'),
      codeId     = colors.gray('(unspecified code id)'),
      crate      = colors.gray('(unspecified crate)'),
      repository = colors.gray('(unspecified source)')
    } = receipt
    name = bold(name)
    if (this.indent + len + 64 < this.width - 4) {
      codeId = bold(codeId)
      crate  = bold(crate)
      this.br()
      this.info(name)
      this.info(`at ${address} : ${codeHash}`)
      this.info(`is ${crate} from ${repository} as ${codeId}`)
    } else {
      this.info()
      this.info(name)
      this.info(address)
      this.info(codeHash)
      this.info(codeId)
    }
  }

  foundDeployedContract (address: Address, name: Name) {
    this.log(
      colors.green('Found:   '),
      bold(colors.green(address)),
      'is',
      bold(colors.green(name)),
    )
  }

  beforeDeploy <C extends Client> (
    template: Contract<C>,
    label:    Label,
    codeId:   CodeId        = template?.codeId   ? bold(String(template.codeId)) : colors.red('(no code id!)'),
    codeHash: CodeHash      = template?.codeHash ? bold(template.codeHash)       : colors.red('(no code hash!)'),
    crate:    Maybe<string> = template?.crate,
    revision: Maybe<string> = template?.revision ?? 'HEAD'
  ) {
    label = label ? bold(label) : colors.red('(missing label!)')
    let info = `${bold(label)} from code id ${bold(codeId)}`
    if (crate) info += ` (${bold(crate)} @ ${bold(revision)})`
    this.log(`Init:     ${info}`)
  }

  afterDeploy <C extends Client> (contract: Partial<Contract<C>>) {
    const { red, green } = colors
    const id = contract?.name
      ? bold(green(contract.name))
      : bold(red('(no name)'))
    const deployment = contract?.prefix
      ? bold(green(contract.prefix))
      : bold(red('(no deployment)'))
    const address = bold(colors.green(contract?.address!))
    this.info('Deployed:', id, 'in', deployment)
    this.info('Address: ', address)
    this.info('Code hash', contract?.codeHash?colors.green(contract.codeHash):colors.red('(n/a)'))
    this.br()
  }

  deployFailed (e: Error, template: Instantiable, name: Label, msg: Message) {
    this.br()
    this.error(`Deploy of ${bold(name)} failed:`)
    this.error(`${e?.message}`)
    this.deployFailedContract(template)
    this.error(`Init message: `)
    this.error(`  ${JSON.stringify(msg)}`)
    this.br()
  }

  deployManyFailed (template: Instantiable, contracts: any[] = [], e: Error) {
    this.br()
    this.error(`Deploy of multiple contracts failed:`)
    this.error(bold(e?.message))
    this.error()
    this.deployFailedContract(template)
    for (const [name, init] of contracts) {
      this.br()
      this.error(`${bold(name)}: `)
      for (const key in init as object) {
        this.error(`  ${bold((key+':').padEnd(18))}`, init[key as keyof typeof init])
      }
    }
    this.br()
  }

  deployFailedContract (template?: Instantiable) {
    if (!template) return this.error(`  No template was provided.`)
    this.error(`Code hash:`, bold(template.codeHash||''))
    this.error(`Chain ID: `, bold(template.chainId ||''))
    this.error(`Code ID:  `, bold(template.codeId  ||''))
  }

  chainStatus ({ chain, deployments }: {
    chain?: Chain, deployments?: { active?: { name: string }, list (): string[] }
  } = {}) {
    if (!chain) return this.info('│ No active chain.')
    this.info('│ Chain type: ', bold(chain.constructor.name))
    this.info('│ Chain mode: ', bold(chain.mode))
    this.info('│ Chain ID:   ', bold(chain.id))
    this.info('│ Chain URL:  ', bold(chain.url.toString()))
    this.info('│ Deployments:', bold(String(deployments?.list().length)))
    if (!deployments?.active) return this.info('│ No active deployment.')
    this.info('│ Deployment: ', bold(String(deployments?.active?.name)))
  }

  warnUrlOverride (a: any, b: any) {
    this.warn(`node.url "${a}" overrides chain.url "${b}"`)
  }

  warnIdOverride (a: any, b: any) {
    this.warn(`node.chainId "${a}" overrides chain.id "${b}"`)
  }

  warnNodeNonDevnet () {
    this.warn(`"node" option is only applicable to devnets`)
  }

  warnNoAgent (name: string) {
    this.warn(`${name}: no agent; actions will fail until agent is set`)
  }

  warnNoAddress (name: string) {
    this.warn(`${name}: no address; actions will fail until address is set`)
  }

  warnNoCodeHash (name: string) {
    this.warn(`${name}: no codeHash; actions may be slow until code hash is set`)
  }

  warnNoCodeHashProvided (address: string, realCodeHash: string) {
    this.warn(`Code hash not provided for ${address}. Fetched: ${realCodeHash}`)
  }

  warnCodeHashMismatch (address: string, expected: string|undefined, fetched: string) {
    this.warn(`Code hash mismatch for ${address}: expected ${expected}, fetched ${fetched}`)
  }

  confirmCodeHash (address: string, codeHash: string) {
    this.info(`Confirmed code hash of ${address}: ${codeHash}`)
  }

  waitingForNextBlock (height: number) {
    this.info(`Waiting for block height to increment beyond ${height}...`)
  }

  warnEmptyBundle () {
    this.warn('Tried to submit bundle with no messages')
  }

}
