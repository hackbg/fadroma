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

import { execSync } from 'node:child_process'

export * from './projectWizard'

export type ProjectContract = {
  /** Source crate/workspace. Defaults to root crate of project. */
  source?: string,
  /** -p flag that selects the contract to compile, if the source is a workspace. */
  package?: string,
  /** One or more -f flags that select the contract to compile, if the source is a multi-contract crate. */
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
    this.shellNix    = root.at('shell.nix').as(TextFile)
    this.pnpmWorkspace = root.at('pnpm-workspace.yaml').as(TextFile)
    this.crate       = new ContractsCrate(this)
    this.apiPackage  = new APIPackage(this)
    this.opsPackage  = new OpsPackage(this)
    this.state       = new ProjectState(this)
  }

  crate:          ContractsCrate
  apiPackage:     APIPackage
  opsPackage:     OpsPackage
  state:          ProjectState

  /** Root package manifest. */
  packageJson:    JSONFile<any>
  /** Empty file that enables PNPM workspaces. */
  pnpmWorkspace:  TextFile
  /** Root of documentation. */
  readme:         TextFile
  /** List of files to be ignored by Git. */
  gitignore:      TextFile
  /** List of environment variables to set. */
  envfile:        TextFile
  /** Nix dependency manifest. */
  shellNix:       TextFile
  /** A custom Dockerfile for building the project. */
  dockerfile:     TextFile|null = null
  /** A GitHub Actions CI workflow. */
  githubWorkflow: TextFile|null = null
  /** A Drone CI workflow. */
  droneWorkflow:  TextFile|null = null

  create () {
    const { name, contracts } = this
    this.root.make()
    this.readme.save(`# ${name}`)
    this.gitignore.save([
      '.env',
      'node_modules',
      'target'
    ].join('\n'))
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
        "@hackbg/fadroma": "latest",
      },
      fadroma: {
        contracts: contracts
      }
    })
    this.pnpmWorkspace.save('')
    this.shellNix.save([
      `{ pkgs ? import <nixpkgs> {}, ... }: let name = "${name}"; in {`,
      `  inherit name;`,
      `  nativeBuildInputs = with pkgs; [ git nodejs nodePackages_latest.pnpm rustup ];`,
      `  shellHook = ''`,
      `    export PS1="$PS1[\${name}] "`,
      `    export PATH="$PATH:$HOME/.cargo/bin:\${./.}/node_modules/.bin"`,
      `  '';`,
      `}`,
    ].join('\n'))
    this.apiPackage.create()
    this.opsPackage.create()
    this.crate.create()
    this.state.create()
    return this
  }

  static create (
    name: string,
    root: string|Path = $(process.cwd()).in(name),
    contracts: Record<string, ProjectContract> = {}
  ) {
    if (typeof root === 'string') root = $(root)
    return new this(name, root.as(OpaqueDirectory), contracts).create()
  }

}
