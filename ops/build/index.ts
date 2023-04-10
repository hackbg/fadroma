import type { TOMLFile } from '@hackbg/file'

/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = TOMLFile<{ package: { name: string } }>

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

import { Builder } from '@fadroma/agent'
import LocalBuilder     from './LocalBuilder'
import RawBuilder       from './RawBuilder'
import ContainerBuilder from './ContainerBuilder'

Object.assign(Builder.variants, { 'container': ContainerBuilder, 'raw': RawBuilder })

export { Builder }

import BuilderConfig from './BuilderConfig'
import type { Buildable, Built } from '@fadroma/agent'

/** @returns Builder configured as per environment and options */
export function getBuilder (options: Partial<BuilderConfig> = {}): Builder {
  return new BuilderConfig(options).getBuilder()
}

/** Compile a single contract with default settings. */
export async function build (source: Buildable): Promise<Built> {
  return getBuilder().build(source)
}

/** Compile multiple single contracts with default settings. */
export async function buildMany (sources: Buildable[]): Promise<Built[]> {
  return getBuilder().buildMany(sources)
}
