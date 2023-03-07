import type Project from './Project'
import { OpaqueDirectory, JSONFile, TextFile } from '@hackbg/file'
import Case from 'case'

export default class APIPackage {

  /** Directory containing api library. */
  api:            OpaqueDirectory

  /** API package manifest. */
  apiPackageJson: JSONFile<any>

  /** Main module */
  apiIndex:       TextFile

  /** Test specification. */
  apiSpec:        TextFile

  constructor (readonly project: Project) {
    this.api = project.root.in('api').as(OpaqueDirectory)
    this.apiPackageJson = this.api.at('package.json').as(JSONFile)
    this.apiIndex = this.api.at('api.ts').as(TextFile)
    this.apiSpec = this.api.at('api.spec.ts').as(TextFile)
  }

  create () {
    const name = this.project.name
    const Name = Case.pascal(name)
    const contracts = Object.keys(this.project.contracts)
    const Contracts = contracts.map(Case.pascal)
    this.api.make()
    this.apiPackageJson.save({
      name: `@${name}/api`,
      version: "0.0.0",
      devDependencies: {
        "@fadroma/core": "^2",
      }
    })
    let apiIndex = `import { Client, Deployment } from '@fadroma/core'\n\n`
    apiIndex += `export default class ${Name} extends Deployment {\n`
    contracts.forEach(contract => {
      apiIndex += `  ${contract} = this.contract(`
      apiIndex += `{ name: "${contract}", crate: "${contract}", client: ${contract} })\n`
    })
    apiIndex += `}\n\n`
    Contracts.forEach(Contract => {
      apiIndex += `export class ${Contract} extends Client {\n`
      apiIndex += `  // myTx    = (arg1, arg2) => this.execute({myTx:{arg1, arg2}})`
      apiIndex += `  // myQuery = (arg1, arg2) => this.query({myQuery:{arg1, arg2}})`
      apiIndex += `}\n\n`
    })
    this.apiIndex.save(apiIndex)
  }

}
