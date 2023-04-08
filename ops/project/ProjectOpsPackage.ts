import type { Project } from './Project'
import { OpaqueDirectory, JSONFile, TextFile } from '@hackbg/file'
import Case from 'case'

export default class OpsPackage {

  /** Directory containing deploy tool. */
  dir:         OpaqueDirectory

  /** Ops package manifest. */
  packageJson: JSONFile<any>

  /** Main module */
  index:       TextFile

  /** Test specification. */
  spec:        TextFile

  constructor (readonly project: Project) {
    this.dir = project.root.in('ops').as(OpaqueDirectory)
    this.packageJson = this.dir.at('package.json').as(JSONFile)
    this.index = this.dir.at('ops.ts').as(TextFile)
    this.spec = this.dir.at('ops.spec.ts').as(TextFile)
  }

  create () {
    this.dir.make()

    const { name } = this.project
    this.packageJson.save({
      name:    `@${name}/ops`,
      version: "0.0.0",
      private: true,
      devDependencies: {
        "@fadroma/ops": "^2",
        [`@${name}/api`]: "workspace:*",
      }
    })

    const Name = Case.pascal(name)
    this.index.save([
      `import ${Name} from '@${name}/api'`,
      `import { DeployCommands } from '@fadroma/ops'`,
      ``,
      `export default class ${Name}Commands extends DeployCommands {`,
      ``,
      `  deploy () {}`,
      ``,
      `}`
    ].join('\n'))
  }

}
