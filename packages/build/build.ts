/**

  Fadroma Build System
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

export * from './BuildConsole'
export { default as BuildConsole } from './BuildConsole'

export * from './BuildError'
export { default as BuildError } from './BuildError'

export * from './BuilderConfig'
export { default as BuilderConfig } from './BuilderConfig'

export * from './BuildCommands'
export { default as BuildCommands } from './BuildCommands'

export * from './LocalBuilder'
export { default as LocalBuilder } from './LocalBuilder'

export * from './RawBuilder'
export { default as RawBuilder } from './RawBuilder'

export * from './ContainerBuilder'
export { default as ContainerBuilder } from './ContainerBuilder'

export * from './getGitDir'
export { default as getGitDir } from './getGitDir'

import type { Buildable } from '@fadroma/core'
import BuilderConfig from './BuilderConfig'
import { ContractTemplate, HEAD } from '@fadroma/core'
export default async function buildCrates (
  crates:   string[]               = [],
  revision: string                 = HEAD,
  config:   Partial<BuilderConfig> = new BuilderConfig(),
  builder:  Builder                = config.getBuilder!()
) {
  return await builder.buildMany(crates.map(crate=>new ContractTemplate({
    repository: config.project,
    workspace:  config.project,
    crate,
    revision
  }) as Buildable))
}

import type { TOMLFile } from '@hackbg/file'

/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = TOMLFile<{ package: { name: string } }>

export { Builder }

import { Builder } from '@fadroma/core'
import LocalBuilder from './LocalBuilder'
import RawBuilder from './RawBuilder'
import ContainerBuilder from './ContainerBuilder'
Object.assign(Builder.variants, {
  'docker-local': ContainerBuilder,
  'raw-local':    RawBuilder
})
