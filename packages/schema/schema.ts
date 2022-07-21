import { resolve, dirname, basename }               from 'path'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { execFileSync }                             from 'child_process'

import { parse as parseToml } from 'toml'
import { compileFromFile }    from 'json-schema-to-typescript'

/** Run the schema generator example binary of each contract. */
export async function generateSchema (projectRoot: string, dirs: Array<string>) {
  for (const dir of dirs) {
    //console.info(`Generating schema for ${bold(dir)}`)
    // Generate JSON schema
    const cargoToml = resolve(projectRoot, 'contracts', dir, 'Cargo.toml')
    const {package:{name}} = parseToml(readFileSync(cargoToml, 'utf8'))
    execFileSync('cargo', ['run', '-p', name, '--example', 'schema'], { stdio: 'inherit' })

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

/** Convert JSON schema to TypeScript types */
export function schemaToTypes (...schemas: Array<string>) {
  return Promise.all(schemas.map(schema=>
    compileFromFile(schema).then((ts: any)=>{
      const output = `${dirname(schema)}/${basename(schema, '.json')}.d.ts`
      writeFileSync(output, ts)
      //console.info(`Generated ${output}`)
    })))
}
