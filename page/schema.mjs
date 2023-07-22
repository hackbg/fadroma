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
  constructor (source, {
    contract_name, contract_version, idl_version, description,
    instantiate, execute, query, migrate, sudo, responses
  }) {
    this.source = source
    Object.assign(this, {
      contract_name, contract_version, idl_version, description,
      instantiate, execute, query, migrate, sudo, responses
    })
    /** Collect type definitions used by all schemas.
      * WARNING: Duplicate definitions are silently overwritten.
      *          Contracts shouldn't contain any of those, though. */
    for (const section of [
      this.instantiate,
      this.execute,
      this.query,
      this.migrate,
      this.sudo,
      this.responses,
      ...Object.values(this.responses)
    ]) {
      this.addDefinitions(section)
    }
  }
  /** Collection of type definitions referenced by the included JSONSchemas. */
  definitions = new Map()
  /** Collect type definitions from a schema */
  addDefinitions = section => {
    if (section && section.definitions)
      for (const name of Object.keys(section.definitions).sort()) {
        this.definitions.set(name, section.definitions[name])
        if (section.definitions[name].oneOf)
          for (const definition of section.definitions[name].oneOf)
            if (!this.definitions.has(definition.title))
              this.definitions.set(definition.title, definition)
      }
  }
  /** Resolve an `allOf` schema clause against all definitions in this schema. */
  resolveAllOf = (property) =>
    allOf(this.definitions, property)
  /** Get a safe default value for a property. */
  defaultValueFor = (property) =>
    isObject(property) ? undefined :
    isString(property) ? "" :
    isNumber(property) ? 0  : ''
  /** Hardcoded overrides for a couple of types that fail to represent correctly. */
  overrides = {
    Uint128: 'A string containing a 128-bit integer in decimal representation.',
    Binary:  'A string containing Base64-encoded data.'
  }
}

/** Resolve an `allOf` schema clause against a pre-existing map of definitions. */
export const allOf = (definitions, property) => {
  let { properties = {}, allOf = [] } = property
  for (const type of allOf) {
    if (!type.$ref) throw new Error('Unsupported', { type })
    const name = refName(type)
    const definition = definitions.get(name)
    if (!definition) throw new Error(`Missing definition: ${name}`, { name })
    Object.assign(properties, definition.properties)
  }
  return properties
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

/** Converts a contract schema to a Markdown document. */
export class SchemaToMarkdown extends Schema {
  /** Convert to Markdown. */
  toMd = () => {
    const fragments = [this.description]
    // Add init message
    for (const f of this.toMdInstantiate()) fragments.push(f)
    // Add other messages
    for (const section of [this.execute, this.query, this.migrate, this.sudo]) {
      for (const f of this.toMdSection(section)) fragments.push(f)
    }
    // Add responses
    for (const f of this.toMdResponses(this.responses)) fragments.push(f)
    // Add definitions
    for (const f of this.toMdDefinitions(this.definitions)) fragments.push(f)
    return fragments.join('\n')
  }
  /** Render init message section. */
  toMdInstantiate = (section = this.instantiate) => {
    if (!section) return []
    return [
      ``, `## ${section.title}`,
      ``, `${section.description}`,
      ``, this.toMdSchemaTable(section.title, section).join('\n')
    ]
  }
  /** Render non-init message section. */
  toMdSection = (section) => {
    if (!section || section.oneOf.length < 1) return []
    return [
      ``, `## ${section.title}`,
      ``, `${section.description}`,
      ...section.oneOf.map(variant=>this.toMdSectionVariant(section, variant).join('\n'))
    ]
  }
  /** Render non-init message variant. */
  toMdSectionVariant = (section, variant) => [
    ``, `### ${section.title}::${variant.title}`,
    ``, `${variant.description}`,
    ``, this.toMdSchemaTable(variant.title, variant).join('\n')
  ]
  /** Render response section. */
  toMdResponses = (responses = this.responses) => {
    if (!this.responses || Object.keys(this.responses).length < 1) return []
    return [
      ``, `## Responses`,
      ...Object.entries(this.responses)
        .map(([name, response])=>this.toMdResponseVariant(name, response).join('\n'))
    ]
  }
  /** Render response variant. */
  toMdResponseVariant = (name, response) => [
    ``, `### ${name}`,
    ``, `${response.description}`,
    ``, this.toMdSchemaTable(name, response).join('\n')
  ]
  /** Render definitions section. */
  toMdDefinitions = () => {
    if (!this.definitions || this.definitions.size < 1) return []
    return [
      ``, `## Definitions`,
      ...[...this.definitions.keys()].sort().map(k=>this.toMdDefinitionVariant(k).join('\n'))
    ]
  }
  /** Render definitions variant. */
  toMdDefinitionVariant = (name, definition = this.definitions.get(name)) => [
    ``, `### ${name}`,
    ...(!definition.description||['Uint128', 'Binary'].includes(name))
      ? [] : [``, `${definition.description}`],
    ``, this.toMdSchemaTable(name, definition).join('\n')
  ]
  /** Render table with the fields of a type. */
  toMdSchemaTable = (name, definition) => {

    const { type, properties, enum: enum_, oneOf } = definition

    if (enum_) return [
      `|message|`,
      `|-------|`,
      `|${enum_.map(x=>`\`"${x}"\``).join(" \\| ")}|`
    ]

    if (properties) return [
      `|parameter|description|`,
      `|---------|-----------|`,
      Object.entries(properties)
        .map(([name, property])=>{
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
            for (const [name, property] of Object.entries(properties)) row(
              `\`${parentName}.${name}\``,
              `**${this.toMdSchemaType(name, property)}**. ${(property.description||'')}` +
              (property.default?`<br>**Default:** \`${JSON.stringify(property.default)}\``:'')
            )
          }
          return rows.join('\n')
        })
        .join('\n')
    ]

    if (oneOf) return [
      `|variant|description|`,
      `|-------|-----------|`,
      oneOf.map(variant=>{
        let {title, type, enum: enum_, description} = variant
        if (this.definitions.has(title)) title = `[**${title}**](#${title})`
        type = enum_
          ? `**${type}**: ${enum_.map(x=>`\`${x}\``).join('\\|')}.`
          : `**${type}**.`
        return `|${title}|${type} ${description}|`
      }).join('\n'),
      oneOf.map(variant=>{
        let {title, type, enum: enum_, description} = variant
        if (this.definitions.has(title)) return
        if (enum_) return
        return `\n#### ${definition.title} as ${title}`
      }).join('\n'),

    ]

    if (type) return [
      `|type|`,
      `|----|`,
      `|**${type}**. ${['Uint128', 'Binary'].includes(name)?'':description}|`
    ]

    return []

  }
  /** Return a representation of the a property's type */
  toMdSchemaType = (key, val) => {
    if (val.type instanceof Array) return val.type.join('\\|')

    if (val.type === 'integer') return "integer"

    if (val.type === 'string') return "string"

    if (val.type === 'object') return "object"

    if (val.type === 'boolean') return "boolean"

    if (val.type === 'array') return `Array<${`[${refName(val.items)}](#${refName(val.items)})`}>`

    if (!!val.allOf) {
      let type = val.allOf[0].$ref.split('/').slice(-1)[0]
      if (val.allOf.length > 1) type = `${type} + ...`
      return type
    }

    if (!!val.anyOf) {
      return val.anyOf
        .map(x=>x.type ? x.type : x.$ref ? `[${refName(x)}](#${refName(x)})` : '(unknown)')
        .join('\\|')
    }

    process.stderr.write(`Warning: unsupported field definition: ${key} -> ${JSON.stringify(val)}`)
    return '(unsupported)'
  }
}

// CLI entry point when running as a standalone script:
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
