import type Project from './Project'
import { OpaqueDirectory, TextFile } from '@hackbg/file'
import Case from 'case'

export default class ContractsCrate {

  /** Crate manifest. */
  cargoToml: TextFile

  /** Directory containing crate sources. */
  src:       OpaqueDirectory

  /** Root module of Rust crate. */
  libRs:     TextFile

  constructor (readonly project: Project) {
    this.cargoToml = project.root.at('Cargo.toml').as(TextFile)
    this.src = project.root.in('src').as(OpaqueDirectory)
    this.libRs = this.src.at('lib.rs').as(TextFile)
  }

  create () {
    const contracts = Object.keys(this.project.contracts).map(Case.snake)
    let cargoToml = ''
    cargoToml += `[package]`
    cargoToml += `\nname = "${this.project.name}"`
    cargoToml += `\nversion = "0.0.0"`
    cargoToml += `\nedition = "2021"`
    cargoToml += `\nauthors = []`
    cargoToml += `\nlicense = "AGPL-3.0"`
    cargoToml += `\nkeywords = ["fadroma"]`
    cargoToml += `\ndescription = ""`
    cargoToml += `\nreadme = "README.md"`
    cargoToml += `\nall-features = true`
    cargoToml += `\n`
    cargoToml += `\n[lib]`
    cargoToml += `\ncrate-type = ["cdylib", "rlib"]`
    cargoToml += `\n`
    cargoToml += `\n[features]`
    contracts.forEach(contract=>cargoToml += `\n${contract} = []`)
    cargoToml += `\n`
    cargoToml += `\n[dependencies]`
    cargoToml += `\nfadroma = "0.7.0"`
    cargoToml += `\n`
    cargoToml += `\n[package.metadata.docs.rs]`
    cargoToml += `\nrustc-args = ["--cfg", "docsrs"]`
    cargoToml += `\nall-features = true`
    this.cargoToml.save(cargoToml)
    this.src.make()
    let libRs = 'pub(crate) use fadroma::prelude::*;\n'
    contracts.forEach(contract => {
      libRs += `#[cfg(feature = "${contract}")]\n`
      libRs += `mod ${contract};\n\n`
      // ?async builder that takes parameters in any order and only executes on await/then?
    })
    this.libRs.save(libRs)
    contracts.forEach(contract=>{
      this.src.at(`${contract}.rs`).as(TextFile).save(`use crate::*;\n`)
    })
  }

}
