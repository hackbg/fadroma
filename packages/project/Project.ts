import $, {
  Path,
  OpaqueDirectory,
  OpaqueFile,
  JSONFile,
  TOMLFile,
  TextFile
} from '@hackbg/file'

import ContractsCrate from './ProjectContractsCrate'
import APIPackage     from './ProjectAPIPackage'
import OpsPackage     from './ProjectOpsPackage'
import ProjectState   from './ProjectState'

export type ProjectContract = {
  source?:   string,
  package?:  string,
  features?: string[]
}

export default class Project {

  constructor (
    /** Name of the project. */
    readonly name: string,
    /** Root directory of the project. */
    readonly root: OpaqueDirectory,
    /** Contract definitions. */
    public contracts: Record<string, ProjectContract> = {}
  ) {
    this.gitignore   = root.at('.gitignore').as(TextFile)
    this.envfile     = root.at('.env').as(TextFile)
    this.readme      = root.at('README.md').as(TextFile)
    this.packageJson = root.at('package.json').as(JSONFile)
    this.crate       = new ContractsCrate(this)
    this.apiPackage  = new APIPackage(this)
    this.opsPackage  = new OpsPackage(this)
    this.state       = new ProjectState(this)
  }

  /** Root package manifest. */
  packageJson:    JSONFile<any>

  apiPackage:     APIPackage

  opsPackage:     OpsPackage

  crate:          ContractsCrate

  state:          ProjectState

  readme:         TextFile

  gitignore:      TextFile

  envfile:        TextFile

  dockerfile:     TextFile|null = null

  githubWorkflow: TextFile|null = null

  droneWorkflow:  TextFile|null = null

  create () {
    const { name, contracts } = this
    this.root.make()
    this.readme.save(`# ${this.name}`)
    this.gitignore.save('')
    this.envfile.save('')
    this.packageJson.save({
      name: `@${name}/workspace`,
      version: "0.0.0",
      private: true,
      scripts: {
        "build":   "fadroma build",
        "devnet":  "FADROMA_CHAIN=ScrtDevnet fadroma ./ops",
        "testnet": "FADROMA_CHAIN=ScrtTestnet fadroma ./ops",
        "mainnet": "FADROMA_CHAIN=ScrtMainnet fadroma ./ops",
      },
      devDependencies: {
        "@hackbg/fadroma": "^1",
      },
      fadroma: {
        contracts: contracts
      }
    })
    this.apiPackage.create()
    this.opsPackage.create()
    this.crate.create()
    this.state.create()
    return this
  }

  static create (
    name: string,
    root: OpaqueDirectory = $(process.cwd()).in(name).as(OpaqueDirectory),
    contracts: Record<string, ProjectContract> = {}
  ) {
    return new this(name, root, contracts).create()
  }

}
