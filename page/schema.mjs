/**

  Fadroma Headless Schema Tool
  Copyright (C) 2023 Hack.bg

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

/** The set of JSONSchemas describing a certain CosmWasm contract. */
export default class Schema {
  /** Collection of type definitions referenced by the included JSONSchemas. */
  definitions = new Map()

  constructor (source, {
    contract_name, contract_version, idl_version, description,
    instantiate, execute, query, migrate, sudo, responses
  }) {
    this.source = source
    Object.assign(this, {
      contract_name, contract_version, idl_version, description,
      instantiate, execute, query, migrate, sudo, responses
    })
    /** Collect type definitions used by all schemas. */
    for (const section of [
      this.instantiate,
      this.execute,
      this.query,
      this.migrate,
      this.sudo
    ]) {
      this.addDefinitions(section)
    }
  }

  /** Collect type definitions from a schema */
  addDefinitions = section => {
    if (section && section.definitions)
      for (const name of Object.keys(section.definitions).sort())
        this.definitions.set(name, section.definitions[name])
  }

  resolveAllOf = (property) => {
    let { properties = {}, allOf = [] } = property
    for (const type of allOf) {
      if (!type.$ref) throw new Error('Unsupported', { type })
      const name = refName(type)
      const definition = this.definitions.get(name)
      if (!definition) throw new Error('Missing definition', { name })
      Object.assign(properties, definition.properties)
    }
    return properties
  }

  defaultValueFor = (property) =>
    isObject(property) ? undefined :
    isString(property) ? "" :
    isNumber(property) ? 0  : ''

}

export const isObject = property =>
  (property.type === 'object') || (property.allOf?.length > 0)

export const isString = property =>
  (property.type === 'string')

export const isNumber = property =>
  (property.type === 'integer') || (property.type === 'float')

export const refName = type =>
  type.type ? type.type :
  type.$ref ? type.$ref.split('/').slice(-1)[0] : undefined

export const refLink = type =>
  type.type ? type.type :
  type.$ref ? ['a', { href: '#' }, refName(type)] : undefined

export class SchemaToMarkdown extends Schema {

  toMd = () => {
    let fragments = [this.description]
    // Add init message
    fragments = fragments.concat(this.toMdInstantiate(this.instantiate))
    // Add other messages
    for (const section of [this.execute, this.query, this.migrate, this.sudo]) {
      const rendered = this.toMdSection(section)
      fragments = fragments.concat(rendered)
    }
    return fragments.join('\n')
  }

  toMdInstantiate = ({ title, description, properties }) => [
    ``,
    `## ${title}`,
    ``,
    `${description}`,
    ``,
    this.toMdSchemaTable(properties)
  ]

  toMdSection = section => section ? [
    ``,
    `## ${section.title}`,
    ``,
    `${section.description}`,
    ...section.oneOf.map(variant=>[
      ``,
      `### ${section.title}::${variant.title}`,
      ``,
      `${variant.description}`,
      ``,
      this.toMdSchemaTable(variant.properties, variant['enum'], variant.description)
    ].join('\n'))
  ] : []

  toMdSchemaTable = (properties = {}, enum_) => {
    if (enum_)
      return this.toMdSchemaTableEnum(enum_).join('\n')
    if (properties)
      return this.toMdSchemaTableWithProperties(properties).join('\n')
    return '(unsupported type!)'
  }

  toMdSchemaTableEnum = enum_ => [
    `|message|`, `|-|`, `|${enum_.map(x=>`"${x}"`).join(" \\| ")}|`
  ]

  toMdSchemaTableWithProperties = properties => [
    `|field|description|`, `|-|-|`, this.toMdSchemaTableProperties(properties).join('\n')
  ]

  toMdSchemaTableProperties = properties =>
    Object.entries(properties).map(([name, property])=>
      this.toMdSchemaTableProperty(name, property))

  toMdSchemaTableProperty = (name, property) => {
    // Collection of rows that will be returned
    const rows = []
    // Turn values into a table row and add it to the table.
    const row = (...args) => rows.push(['', ...args, '']
      // Replaces newlines with <br> tags.
      .map(x=>String(x).replace(/\n/g,'<br>'))
      // Table cells are terminated by pypes
      .join('|'))
    // Add the field name, type, and 1st line of default value
    row(
      `\`${name}\``,
      `**${this.toMdSchemaType(name, property)}**. ${(property.description||'')}`
    )
    // If this property is an object, add its keys on an indented level
    const parentName = name
    if (isObject(property)) {
      const properties = this.resolveAllOf(property)
      for (const [name, property] of Object.entries(properties)) {
        row(
          `\`${parentName}.${name}\``,
          `**${this.toMdSchemaType(name, property)}**. ${(property.description||'')}` +
          (property.default?`<br>**Default:** \`${JSON.stringify(property.default)}\``:'')
        )
      }
    }
    return rows.join('\n')
  }

  toMdSchemaType = (key, val) => {
    switch (true) {
      case (val.type instanceof Array):
        return val.type.join('\\|')
      case (val.type === 'integer'):
        return "integer"
      case (val.type === 'string'):
        return "string"
      case (val.type === 'object'):
        return "object"
      case (val.type === 'boolean'):
        return "boolean"
      case (val.type === 'array'):
        return `Array<${refName(val.items)}>`
      case (!!val.allOf): {
        let type = val.allOf[0].$ref.split('/').slice(-1)[0]
        if (val.allOf.length > 1) type = `${type} + ...`
        return type
      }
      case (!!val.anyOf): {
        return val.anyOf
          .map(x=>x.type ? x.type : x.$ref ? refName(x) : '(unknown)')
          .join('\\|')
      }
    }
    process.stderr.write(`unsupported field definition`)
    return '(unsupported)'
  }

  toHtml () {
    throw new Error('unimplemented')
  }

  toJsonCompact () {
    throw new Error('unimplemented')
  }

  toJsonPretty () {
    throw new Error('unimplemented')
  }

  toYaml () {
    throw new Error('unimplemented')
  }

}

Promise.all([
  import('node:process'),
  import('node:url'),
  import('node:path'),
  import('node:fs'),
])
  .then(
    ([
      {argv, env, cwd},
      {pathToFileURL},
      {dirname, basename, resolve, relative},
      {existsSync, realpathSync, readFileSync}
    ])=>{
      const main = pathToFileURL(argv[1]).href
      if (import.meta.url === main) {
        if (argv.length > 2) {
          process.stderr.write(`Converting schema: ${argv[2]}\n`)
          const source = readFileSync(argv[2], 'utf8')
          const parsed = JSON.parse(source)
          const schema = new SchemaToMarkdown(argv[2], parsed)
          process.stdout.write(schema.toMd())
        } else {
          // Shorten paths for usage
          const paths = (env.PATH||'').split(':')
          if (paths.includes(dirname(argv[0]))) {
            argv[0] = basename(argv[0])
          } else {
            const resolvedPaths = paths
              .map(path=>resolve(path, basename(argv[0])))
              .filter(path=>existsSync(path))
              .map(path=>realpathSync(path))
            if (resolvedPaths.includes(argv[0])) {
              argv[0] = basename(argv[0])
            }
          }
          argv[1] = relative(cwd(), argv[1])
          // Print usage
          process.stderr.write([
            `Fadroma Schema Renderer (https://fadroma.tech)`,
            `Usage:`,
            `  ${process.argv.join(' ')} CONTRACT_SCHEMA.json`,
            ''
          ].join('\n'))
          process.exit(1)
        }
      }
    },
    (e)=>{
      console.info('Not running in Node.js')
    }
  )
