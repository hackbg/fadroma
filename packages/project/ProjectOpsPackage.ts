import type Project from './Project'
import { OpaqueDirectory, JSONFile, TextFile } from '@hackbg/file'
import Case from 'case'

export default class OpsPackage {

  /** Directory containing deploy tool. */
  ops:            OpaqueDirectory

  /** Ops package manifest. */
  opsPackageJson: JSONFile<any>

  /** Main module */
  opsIndex:       TextFile

  /** Test specification. */
  opsSpec:        TextFile

  constructor (readonly project: Project) {
    this.ops = project.root.in('ops').as(OpaqueDirectory)
    this.opsPackageJson = this.ops.at('package.json').as(JSONFile)
    this.opsIndex = this.ops.at('ops.ts').as(TextFile)
    this.opsSpec = this.ops.at('ops.spec.ts').as(TextFile)
  }

  create () {
    const { name } = this.project
    const Name = Case.pascal(name)
    this.ops.make()
    this.opsPackageJson.save({
      name:    `@${name}/ops`,
      version: "0.0.0",
      private: true,
      devDependencies: {
        "@fadroma/deploy": "^2",
        [`@${name}/api`]: "workspace:*",
      }
    })
    let opsIndex = `import { DeployCommands } from '@fadroma/deploy'\n`
    opsIndex += `import ${Name} from '@${name}/api'\n\n`
    opsIndex += `export default class ${Name}Commands extends DeployCommands {}`
    this.opsIndex.save(opsIndex)
  }

}
