import type { Project } from './Project'
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

    this.cargoToml.save([
      `[package]`,
      `name = "${this.project.name}"`,
      `version = "0.0.0"`,
      `edition = "2021"`,
      `authors = []`,
      `license = "AGPL-3.0"`,
      `keywords = ["fadroma"]`,
      `description = ""`,
      `readme = "README.md"`,
      ``,
      `[lib]`,
      `crate-type = ["cdylib", "rlib"]`,
      ``,
      `[features]`,
      ...contracts.map(contract=>`${contract} = []`),
      ``,
      `[dependencies]`,
      `fadroma = { version = "0.7.0", features = ["scrt"] }`
    ].join('\n'))

    this.src.make()

    this.libRs.save([
      `//! Created by @fadroma/project 1.0.0, courtesy of [Hack.bg](https://hack.bg). See [https://fadroma.tech](https://fadroma.tech).`,
      ``,
      'pub(crate) use fadroma::prelude::*;',
      '',
      ...contracts.map(contract => [
        `#[cfg(feature = "${contract}")]`,
        `pub mod ${contract};`,
        ''
      ].join('\n'))
    ].join('\n'))

    contracts.forEach(contract=>{
      this.src.at(`${contract}.rs`).as(TextFile).save([
        `//! Build with \`cargo build -f ${contract}\``,
        '',
        `use crate::*;\n`
      ].join('\n'))
    })

  }

}
