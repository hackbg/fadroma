/**

  Fadroma
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

import { resolve, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

import $ from '@hackbg/kabinet'

export * from '@hackbg/konzola'
import {
  Console,
  bold,
  colors,
  timestamp
} from '@hackbg/konzola'

export * from '@hackbg/komandi'
import {
  getFromEnv,
  Commands,
  CommandContext
} from '@hackbg/komandi'

export * from '@fadroma/client'
import {
  Address,
  Agent,
  AgentOpts,
  Artifact,
  Chain,
  ChainMode,
  Client,
  ClientCtor,
  ClientOpts,
  Instance,
  Message,
  Template,
} from '@fadroma/client'

export * from '@fadroma/scrt'
import {
  ScrtConfig,
  getScrtConfig,
  ScrtGrpc
} from '@fadroma/scrt'

export * from '@fadroma/scrt-amino'
import {
  ScrtAmino
} from '@fadroma/scrt-amino'

export * from '@fadroma/build'
import {
  BuildContext,
  Builder,
  BuilderConfig,
  IntoArtifact,
  IntoSource,
  Source,
  Workspace,
  getBuilder,
  getBuilderConfig,
} from '@fadroma/build'

export * from '@fadroma/deploy'
import {
  CachingFSUploader,
  DeployContext,
  Deployment,
  Deployments,
  FSUploader,
  IntoTemplate,
  Uploader,
  DeployConfig,
  getDeployConfig
} from '@fadroma/deploy'

import {
  DevnetConfig,
  getDevnetConfig,
  getDevnet
} from '@fadroma/devnet'

export * from '@fadroma/mocknet'
import {
  Mocknet
} from '@fadroma/mocknet'

export * from '@fadroma/connect'
import {
  ChainConfig,
  getChainConfig
} from '@fadroma/connect'

export * from '@fadroma/client'
export * from '@fadroma/tokens'

export * from '@hackbg/komandi'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'

/** Update `process.env` with value from `.env` file */
import dotenv from 'dotenv'
dotenv.config()

export function getFadromaConfig (cwd: string, env: Record<string, string> = {}): FadromaConfig {
  const { Str, Bool } = getFromEnv(env)
  const config = {
    project: Str('FADROMA_PROJECT', ()=>cwd),
    ...getBuilderConfig(cwd, env),
    ...getChainConfig(cwd, env),
    ...getDeployConfig(cwd, env),
    ...getDevnetConfig(cwd, env),
    ...getScrtConfig(cwd, env),
  }
  return config
}

export type FadromaConfig =
  BuilderConfig &
  ChainConfig   &
  DeployConfig  &
  DevnetConfig  &
  ScrtConfig    &
  DevnetConfig

export type Context =
  CommandContext
  & BuildContext
  & DeployContext
  & { config: FadromaConfig }
