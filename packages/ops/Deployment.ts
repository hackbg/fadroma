import { Console, resolve, bold, writeFileSync, relative, timestamp } from '@hackbg/tools'
import { Contract, ContractConstructor, Agent } from './Model'

const console = Console('@fadroma/ops/Deployment')

export type ContractConstructor<T extends Contract> =
  new (args: ContractConstructorArguments) => T

export type ContractConstructorArguments = {
  address?:  string
  codeHash?: string
  codeId?:   number
  admin?:    Agent,
  prefix?:   string
}

export class Deployment {

  constructor (
    public readonly prefix: string,
    public readonly path:   string,
    public readonly receipts: Record<string, any>
  ) {}

  getContract <T extends Contract> (
    Class:        ContractConstructor<T>,
    contractName: string,
    admin:        Agent
  ): T {
    console.info(
      bold('Looking for contract'), Class.name,
      bold('named'),                contractName,
      bold('in deployment'),        this.prefix
    )
    if (!this.receipts[contractName]) {
      throw new Error(
        `@fadroma/ops: no contract ${bold(contractName)}` +
        ` in deployment ${bold(this.prefix)}`
      )
    }
    return new Class({
      address:  this.receipts[contractName].initTx.contractAddress,
      codeHash: this.receipts[contractName].codeHash,
      codeId:   this.receipts[contractName].codeId,
      prefix:   this.prefix,
      admin,
    })
  }

  getContracts <T extends Contract> (
    Class:        ContractConstructor<T>,
    nameFragment: string,
    admin:        Agent
  ): T[] {
    console.info(
      bold('Looking for contracts of type'), Class.name,
      bold('named like'),                    nameFragment,
      bold('in deployment'),                 this.prefix
    )
    const contracts = []
    for (const [name, contract] of Object.entries(this.receipts)) {
      if (name.includes(nameFragment)) {
        contracts.push(new Class({
          address:  this.receipts[name].initTx.contractAddress,
          codeHash: this.receipts[name].codeHash,
          codeId:   this.receipts[name].codeId,
        }))
      }
    }
    return contracts
  }

  requireContracts (
    requirements: Record<string, ContractConstructor<any>>,
    options:      any
  ): Record<string, any> {
    const contracts = {}
    for (const [name, Class] of Object.entries(requirements)) {
      contracts[name] = new Class(options)
    }
    return contracts
  }

  resolve (...fragments: Array<string>) {
    return resolve(this.path, ...fragments)
  }

  save (data: any, ...fragments: Array<string>) {
    this.receipts[fragments.join('')] = data
    if (data instanceof Object) data = JSON.stringify(data, null, 2)
    const name = `${this.resolve(...fragments)}.json`
    writeFileSync(name, data)
    console.info(
      bold('Deployment writing:'), relative(process.cwd(), name)
    )
  }

}

import {
  colors,
  existsSync,
  basename,
  readlinkSync,
  readdirSync,
  statSync,
  readFileSync,
  unlinkSync,
  symlinkDir,
  mkdirp,
  Directory
} from '@hackbg/tools'

export class DeploymentDir extends Directory {

  KEY = '.active'

  printActive () {
    if (this.active) {
      console.log(`\nSelected deployment:`)
      console.log(`  ${bold(this.active.prefix)}`)
      for (const contract of Object.keys(this.active.contracts)) {
        console.log(`    ${colors.green('✓')}  ${contract}`)
      }
    } else {
      console.log(`\nNo selected deployment.`)
    }
  }

  get active (): Deployment|null {
    return this.get(this.KEY)
  }

  get (name: string): Deployment|null {

    const path = resolve(this.path, name)

    if (!existsSync(path)) {
      return null
    }

    let prefix: string

    try {
      prefix = basename(readlinkSync(path))
    } catch (e) {
      prefix = basename(path)
    }

    const contracts = {}

    for (const contract of readdirSync(path).sort()) {
      const [contractName, _version] = basename(contract, '.json').split('+')
      const location = resolve(path, contract)
      if (statSync(location).isFile()) {
        contracts[contractName] = JSON.parse(readFileSync(location, 'utf8'))
      }
    }

    return new Deployment(prefix, path, contracts)
  }

  async create (id: string) {
    const path = resolve(this.path, id)
    if (existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} already exists`)
    }
    console.info(
      bold('Creating new deployment'),
      id
    )
    await mkdirp(path)
  }

  // selected deployment shouldn't be implemented with symlinks...
  async select (id: string) {
    const path = resolve(this.path, id)
    if (!existsSync(path)) {
      throw new Error(`[@fadroma/ops/Deployment] ${id} does not exist`)
    }
    const active = resolve(this.path, this.KEY)
    if (existsSync(active)) unlinkSync(active)
    await symlinkDir(path, active)
  }

  list () {
    if (!existsSync(this.path)) {
      console.info(`\n${this.path} does not exist, creating`)
      mkdirp.sync(this.path)
      return []
    }
    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>statSync(resolve(this.path, x)).isDirectory())
  }

  save (name: string, data: any) {

    name = `${name}.json`

    console.info(
      bold('DeploymentDir writing:'), relative(process.cwd(), this.resolve(name))
    )

    if (data instanceof Object) {
      data = JSON.stringify(data, null, 2)
    }

    return super.save(name, data)

  }

  /** List of contracts in human-readable from */
  table () {
    const rows = []
    rows.push([bold('  label')+'\n  address', 'code id', 'code hash\ninit tx\n'])
    if (this.exists()) {
      for (const name of this.list()) {
        const { codeId, codeHash, initTx: {contractAddress, transactionHash} } = this.load(name)
        rows.push([
          `  ${bold(name)}\n  ${contractAddress}`,
          String(codeId),
          `${codeHash}\n${transactionHash}\n`
        ])
      }
    }
    return rows
  }

}

export async function createNewDeployment ({ chain, cmdArgs = [] }) {
  const [ prefix = timestamp() ] = cmdArgs
  await chain.deployments.create(prefix)
  await chain.deployments.select(prefix)
  return needsActiveDeployment({ chain })
}

export function needsActiveDeployment ({ chain }): {
  deployment: Deployment|undefined,
  prefix:     string|undefined
} {
  const deployment = chain.deployments.active
  const prefix     = deployment?.prefix
  if (deployment) {
    console.info(bold('Active deployment:'), deployment.prefix)
    const contracts = Object.values(deployment.receipts).length
    if (contracts === 0) {
      console.info(bold('This is a clean deployment.'))
    } else {
      console.info(bold('This deployment contains'), contracts, 'contracts')
      const byCodeID = ([_, x],[__,y]) => (x.codeId > y.codeId)?1:(x.codeId < y.codeId)?-1:0
      for (
        const [name, {codeId, initTx:{contractAddress}}] of
        Object.entries(deployment.receipts).sort(byCodeID)
      ) {
        console.info(bold(`Code ID ${codeId}:`), contractAddress, bold(name))
      }
    }
  }
  return {
    deployment,
    prefix
  }
}
