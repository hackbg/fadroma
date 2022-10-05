/*
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

import type { TOMLFile } from '@hackbg/kabinet'
import { Contract, Builder, HEAD } from '@fadroma/client'

import { BuilderConfig, LocalBuilder, buildPackage } from './build-base'
import { BuildConsole }  from './build-events'
import { RawBuilder }    from './build-raw'
import { DockerBuilder } from './build-docker'

Object.assign(Builder.variants, {
  'local-docker': DockerBuilder,
  'local-raw':    RawBuilder
})

export async function buildCrates (
  crates:   string[]               = [],
  revision: string                 = HEAD,
  config:   Partial<BuilderConfig> = new BuilderConfig(),
  builder:  Builder                = config.getBuilder!()
) {
  return await builder.buildMany(crates.map(crate=>new Contract({
    repository: config.project,
    workspace:  config.project,
    crate,
    revision
  })))
}

/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = TOMLFile<{ package: { name: string } }>

export {
  BuilderConfig,
  BuildConsole,
  LocalBuilder,
  RawBuilder,
  DockerBuilder,
  buildPackage
}

export {
  getGitDir,
  DotGit
} from './build-history'
