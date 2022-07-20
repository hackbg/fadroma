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

/** Update `process.env` with value from `.env` file */
import dotenv from 'dotenv'
dotenv.config()

//@ts-ignore
export const __dirname = dirname(fileURLToPath(import.meta.url))

/// # Reexport the core platform vocabulary:

export * from '@hackbg/komandi'
export * from '@hackbg/kabinet'
export * from '@hackbg/formati'
export * from '@fadroma/client'
export * from '@fadroma/tokens'

/// # Define the top-level conventions and idioms:

export const console = Console('Fadroma')

export interface FadromaConfig {
  build:  BuilderConfig
  devnet: DevnetConfig
  scrt:   ScrtConfig
  /** Project settings. */
  project: {
    /** The project's root directory. */
    root:       string
    /** The selected chain backend. */
    chain:      string|null
  }
  /** System settings. */
  system: {
    /** The user's home directory. */
    homeDir:    string
    /** Address of Docker socket to use. */
    dockerHost: string
  }
  /** Upload settings. */
  upload: {
    /** Whether to ignore existing upload receipts and reupload contracts. */
    reupload:   boolean
  }
}

export function getFadromaConfig (cwd: string, env: Record<string, string> = {}): FadromaConfig {
  const { Str, Bool } = getFromEnv(env)
  const config = {
    build:        getBuilderConfig(cwd, env),
    devnet:       getDevnetConfig(cwd, env),
    scrt:         getScrtConfig(cwd, env),
    project: {
      root:       Str('FADROMA_PROJECT', ()=>cwd),
      chain:      Str('FADROMA_CHAIN', ()=>'')
    },
    system: {
      homeDir:    Str('HOME', ()=>homedir()),
      dockerHost: Str('DOCKER_HOST', ()=>'/var/run/docker.sock')
    },
    upload: {
      reupload:   Bool('FADRPOMA_REUPLOAD', ()=>false)
    }
  }
  validateScrtConfig()
  return config

  function validateScrtConfig () {
    const { project: { chain }, scrt } = config
    if (chain.includes('Scrt')) {
      if (chain.endsWith('Legacy')) {
        if (chain.includes('Mainnet') && !scrt.mainnet.apiUrl) throw new Error('set SCRT_MAINNET_API_URL')
        if (chain.includes('Testnet') && !scrt.testnet.apiUrl) throw new Error('set SCRT_TESTNET_API_URL')
      } else {
        scrt.mainnet.apiUrl ??= 'https://secret-4.api.trivium.network:9091'
        scrt.testnet.apiUrl ??= 'https://testnet-web-rpc.roninventures.io'
      }
    }
  }
}

export type Context =
  { config: FadromaConfig }
  & BuildContext
  & DeployContext

export async function resetDevnet ({ chain }: { chain: Chain }) {
  if (!chain) {
    console.info('No active chain.')
  } else if (!chain.isDevnet) {
    console.info('This command is only valid for devnets.')
  } else {
    await chain.node.terminate()
  }
}
