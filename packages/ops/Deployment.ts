import { Console, resolve, bold, writeFileSync } from '@hackbg/tools'
import { IContract, ContractConstructor, IAgent } from './Model'

const console = Console('@fadroma/ops/Deployment')

export class Deployment {

  constructor (
    public readonly prefix: string,
    public readonly path:   string,
    public readonly contracts: Record<string, any>
  ) {}

  resolve (...fragments: Array<string>) {
    return resolve(this.path, ...fragments)
  }

  save (data: any, ...fragments: Array<string>) {
    if (data instanceof Object) data = JSON.stringify(data, null, 2)
    writeFileSync(`${this.resolve(...fragments)}.json`, data)
  }

  getContract <T extends IContract> (
    Class:        ContractConstructor<T>,
    contractName: string,
    admin:        IAgent
  ): T {
    if (!this.contracts[contractName]) {
      throw new Error(
        `@fadroma/ops: no contract ${bold(contractName)}` +
        ` in deployment ${bold(this.prefix)}`
      )
    }

    return new Class({
      address:  this.contracts[contractName].initTx.contractAddress,
      codeHash: this.contracts[contractName].codeHash,
      codeId:   this.contracts[contractName].codeId,
      prefix:   this.prefix,
      admin,
    })
  }

  getContracts <T extends IContract> (
    Class:        ContractConstructor<T>,
    nameFragment: string,
    admin:        IAgent
  ): T[] {
    const contracts = []
    for (const [name, contract] of Object.entries(this.contracts)) {
      if (name.includes(nameFragment)) {
        contracts.push(new Class({
          address:  this.contracts[name].initTx.contractAddress,
          codeHash: this.contracts[name].codeHash,
          codeId:   this.contracts[name].codeId,
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
    console.trace(
      bold('Save data to:'), name
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
