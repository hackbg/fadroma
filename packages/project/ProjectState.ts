import type Project from './Project'
import { OpaqueDirectory, TextFile } from '@hackbg/file'

export default class ProjectState {

  constructor (readonly project: Project) {
    this.artifacts = project.root.at('artifacts.sha256').as(TextFile)
    this.uploads   = project.root.in('uploads').as(OpaqueDirectory)
    this.receipts  = project.root.in('receipts').as(OpaqueDirectory)
  }

  /** File containing build artifact checksums. */
  artifacts: TextFile

  /** Directory containing upload receipts. */
  uploads: OpaqueDirectory

  /** Directory containing deployment receipts. */
  receipts: OpaqueDirectory

  create () {
    let artifacts = ``
    const sha256 = '000000000000000000000000000000000000000000000000000000000000000'
    Object.keys(this.project.contracts).forEach(contract=>{
      artifacts += `${sha256}  ${contract}.wasm`
    })
    this.artifacts.save(artifacts)

    this.uploads.make()

    this.receipts.make()
  }

}
