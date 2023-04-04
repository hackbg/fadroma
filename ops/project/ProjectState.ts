import type { Project } from './Project'
import { OpaqueDirectory, TextFile } from '@hackbg/file'

export default class ProjectState {

  /** Crate manifest. */
  dir: OpaqueDirectory

  /** File containing build artifact checksums. */
  artifacts: TextFile

  /** Directory containing upload receipts. */
  uploads: OpaqueDirectory

  /** Directory containing deployment receipts. */
  receipts: OpaqueDirectory

  constructor (readonly project: Project) {
    this.dir = project.root.in('state').as(OpaqueDirectory)
    this.artifacts = this.dir.at('artifacts.sha256').as(TextFile)
    this.uploads   = this.dir.in('uploads').as(OpaqueDirectory)
    this.receipts  = this.dir.in('receipts').as(OpaqueDirectory)
  }

  create () {
    let artifacts = ``
    const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
    const contracts = Object.keys(this.project.contracts)
    this.artifacts.save(contracts.map(contract=>`${sha256}  ${contract}@HEAD.wasm`).join('\n'))
    this.uploads.make()
    this.receipts.make()
  }

}
