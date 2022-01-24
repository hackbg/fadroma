import { Directory, resolve, bold, } from '@hackbg/tools'
import { IContract, ContractConstructor, IAgent } from './Model'

export class Deployment {
  constructor (
    public readonly name: string,
    public readonly path: string,
    public readonly contracts: Record<string, any>
  ) {}

  resolve (...fragments: Array<string>) {
    return resolve(this.path, ...fragments)
  }

  getContract <T extends IContract> (
    Class:        ContractConstructor<T>,
    contractName: string,
    admin:        IAgent
  ): T {
    if (!this.contracts[contractName]) {
      throw new Error(
        `@fadroma/ops: no contract ${bold(contractName)}` +
        ` in deployment ${bold(this.name)}`
      )
    }

    return new Class({
      address:  this.contracts[contractName].initTx.contractAddress,
      codeHash: this.contracts[contractName].codeHash,
      codeId:   this.contracts[contractName].codeId,
      prefix:   this.name,
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
  mkdirp
} from '@hackbg/tools'

export class DeploymentDir extends Directory {

  KEY = '.active'

  printActive () {
    if (this.active) {
      console.log(`\nSelected deployment:`)
      console.log(`  ${bold(this.active.name)}`)
      for (const contract of Object.keys(this.active.contracts)) {
        console.log(`    ${colors.green('✓')}  ${contract}`)
      }
    } else {
      console.log(`\nNo selected deployment.`)
    }
  }

  get active (): Deployment {

    const path = resolve(this.path, this.KEY)
    if (!existsSync(path)) {
      return null
    }

    const deploymentName = basename(readlinkSync(path))

    const contracts = {}
    for (const contract of readdirSync(path).sort()) {
      const [contractName, _version] = basename(contract, '.json').split('+')
      const location = resolve(path, contract)
      if (statSync(location).isFile()) {
        contracts[contractName] = JSON.parse(readFileSync(location, 'utf8'))
      }
    }

    return new Deployment(deploymentName, path, contracts)

  }

  async select (id: string) {
    const selection = resolve(this.path, id)
    if (!existsSync(selection)) throw new Error(
      `@fadroma/ops: ${id} does not exist`)
    const active = resolve(this.path, this.KEY)
    if (existsSync(active)) unlinkSync(active)
    await symlinkDir(selection, active)
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
    if (data instanceof Object) data = JSON.stringify(data, null, 2)
    return super.save(`${name}.json`, data)
  }

  /** List of contracts in human-readable from */
  table () {

    const rows = []
    rows.push([bold('  label')+'\n  address', 'code id', 'code hash\ninit tx\n'])

    if (this.exists()) {
      for (const name of this.list()) {
        const {
          codeId,
          codeHash,
          initTx: {contractAddress, transactionHash}
        } = this.load(name)
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
