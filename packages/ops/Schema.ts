import { writeFileSync, readdirSync, readFileSync } from 'fs'
import { resolve, basename, dirname } from 'path'

import { Agent } from '@fadroma/client'
import { Console, bold } from '@hackbg/konzola'
import { cargo } from '@hackbg/toolbox'
import { compileFromFile } from 'json-schema-to-typescript'

import TOML from 'toml'

const console = Console('@fadroma/ops/schema')

export async function generateSchema (projectRoot: string, dirs: Array<string>) {
  for (const dir of dirs) {
    console.info(`Generating schema for ${bold(dir)}`)
    // Generate JSON schema
    const cargoToml = resolve(projectRoot, 'contracts', dir, 'Cargo.toml')
    const {package:{name}} = TOML.parse(readFileSync(cargoToml, 'utf8'))
    cargo('run', '-p', name, '--example', 'schema')

    // Collect generated schema definitions
    const schemaDir = resolve(projectRoot, 'contracts', dir, 'schema')
    const schemas = readdirSync(schemaDir)
      .filter(x=>x.endsWith('.json'))
      .map(x=>resolve(schemaDir, x))

    // Remove `For_HumanAddr` suffix from generic structs
    // This does a naive find'n' replace, not sure what it'll do for
    // types that are genericized over HumanAddr AND something else?
    for (const schema of schemas) {
      const content = readFileSync(schema, 'utf8')
      writeFileSync(schema, content.replace(/_for_HumanAddr/g, ''), 'utf8')
    }

    // Generate type definitions from JSON schema
    await schemaToTypes(...schemas)
  }
}

export function schemaToTypes (...schemas: Array<string>) {
  return Promise.all(schemas.map(schema=>
    compileFromFile(schema).then((ts: any)=>{
      const output = `${dirname(schema)}/${basename(schema, '.json')}.d.ts`
      writeFileSync(output, ts)
      console.info(`Generated ${output}`)
    })))
}
