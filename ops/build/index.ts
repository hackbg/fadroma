import type { TOMLFile } from '@hackbg/file'

import Config from '../Config'
import type { BuilderConfig } from '../Config'

import LocalBuilder from './LocalBuilder'
import RawBuilder from './RawBuilder'
import ContainerBuilder from './ContainerBuilder'

import { Builder } from '@fadroma/agent'
import type { Buildable, Built } from '@fadroma/agent'

Object.assign(Builder.variants, { 'container': ContainerBuilder, 'raw': RawBuilder })

/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = TOMLFile<{ package: { name: string } }>

export * from './LocalBuilder'
export { default as LocalBuilder } from './LocalBuilder'

export * from './RawBuilder'
export { default as RawBuilder } from './RawBuilder'

export * from './ContainerBuilder'
export { default as ContainerBuilder } from './ContainerBuilder'

export * from './getGitDir'
export { default as getGitDir } from './getGitDir'

export { Builder }


/** @returns Builder configured as per environment and options */
export function getBuilder (options: Partial<BuilderConfig> = {}): Builder {
  return new Config({ build: options }).getBuilder()
}

/** Compile a single contract with default settings. */
export async function build (source: Buildable): Promise<Built> {
  return getBuilder().build(source)
}

/** Compile multiple single contracts with default settings. */
export async function buildMany (sources: Buildable[]): Promise<Built[]> {
  return getBuilder().buildMany(sources)
}
