import type { Project } from './Project'
import { OpaqueDirectory, JSONFile, TextFile } from '@hackbg/file'
import Case from 'case'

export default class APIPackage {

  /** Directory containing api library. */
  dir:         OpaqueDirectory

  /** API package manifest. */
  packageJson: JSONFile<any>

  /** Main module */
  index:       TextFile

  /** Test specification. */
  spec:        TextFile

  constructor (readonly project: Project) {
    this.dir = project.root.in('api').as(OpaqueDirectory)
    this.packageJson = this.dir.at('package.json').as(JSONFile)
    this.index = this.dir.at('api.ts').as(TextFile)
    this.spec = this.dir.at('api.spec.ts').as(TextFile)
  }

  create () {
    this.dir.make()

    const name = this.project.name
    this.packageJson.save({
      name: `@${name}/api`,
      version: "0.0.0",
      devDependencies: {
        "@fadroma/scrt": "^8",
        "@fadroma/tokens": "^7",
      }
    })

    const Name = Case.pascal(name)
    const contracts = Object.keys(this.project.contracts)
    const Contracts = contracts.map(Case.pascal)
    this.index.save([
      `import { Client, Deployment } from '@fadroma/agent'`,
      '',
      `export default class ${Name} extends Deployment {`,
      ...contracts.map(contract => [
        `  ${contract} = this.contract(`,
        `{ name: "${contract}", crate: "${contract}", client: ${Case.pascal(contract)} })`
      ].join('')),
      '}',
      '',
      ...Contracts.map(Contract => [
        `export class ${Contract} extends Client {`,
        `  // myTx    = (arg1, arg2) => this.execute({myTx:{arg1, arg2}})`,
        `  // myQuery = (arg1, arg2) => this.query({myQuery:{arg1, arg2}})`,
        `}\n`
      ].join('\n'))
    ].join('\n'))
  }

}
