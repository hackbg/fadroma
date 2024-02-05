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
        for (const definition of [
          ...section.definitions[name].oneOf||[],
          ...section.definitions[name].anyOf||[],
          ...section.definitions[name].allOf||[],
        ])
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

const primitiveTypes = new Set([
  'integer', 'float', 'string', 'boolean', 'object', 'null'
])

const refLink = ref =>
  (primitiveTypes.has(ref) || !ref) ? ref : `[${ref}](#${slugify(ref)})`

const slugify = ref =>
  ref.replace(/ /g, '-').toLowerCase()

const formatDescription = (definition) =>
  (definition?.description||'')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const formatDescriptionInTable = (definition) =>
  formatDescription(definition)
    .replace(/\n/g, '<br />')

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
      ``, `${formatDescription(section)}`,
      ``, this.toMdSchemaTable(section.title, section, 'parameter').join('\n')
    ]
  }
  /** Render non-init message section. */
  toMdSection = (section) => {
    if (!section || section.oneOf.length < 1) return []
    return [
      ``, `## ${section.title}`,
      ``, `${formatDescription(section)}`,
      ...section.oneOf.map(variant=>this.toMdSectionVariant(section, variant).join('\n'))
    ]
  }
  /** Render non-init message variant. */
  toMdSectionVariant = (section, variant) => [
    ``, `### ${section.title}::${variant.title}`,
    ``, `${formatDescription(variant)}`,
    ``, this.toMdSchemaTable(variant.title, variant, 'parameter').join('\n')
  ]
  /** Render responses section. */
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
    ``, `${formatDescription(response)}`,
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
  /** Render definition. */
  toMdDefinitionVariant = (name, definition = this.definitions.get(name)) => [
    ``, `### ${name}`,
    ``, this.overrides[name]||definition.description||'',
    ``, this.toMdSchemaTable(name, definition).join('\n')
  ]
  /** Render table with the fields of a type. */
  toMdSchemaTable = (name, definition, keyName = 'property') => {

    const { type, properties, enum: enum_, oneOf, description, required } = definition

    if (enum_) return [
      `|literal|`,
      `|-------|`,
      `|${enum_.map(x=>`\`"${x}"\``).join(" \\| ")}|`
    ]

    if (properties) return [
      `|${keyName}|description|`,
      `|----------|-----------|`,
      Object.entries(properties)
        .map(([name, property])=>{
          // Collection of rows that will be returned
          const rows = []
          // Turn values into a table row and add it to the table.
          const row = (...args) => rows.push(['', ...args, '']
            // Replaces newlines with <br> tags.
            .map(x=>String(x).replace(/\n/g,'<br />'))
            // Table cells are terminated by pypes
            .join('|'))
          // Add the field name, type, and 1st line of default value
          row(
            `\`${name}\``,
            ``
            + (required?.includes(name)?`*(Required.) * `:'')
            + `**${this.toMdSchemaType(name, property)}**. `
            + `${formatDescriptionInTable(property)}`
          )
          // If this property is an object, add its keys on an indented level
          if (isObject(property)) {
            const parentName = name
            const parentProp = property
            const properties = this.resolveAllOf(property)
            for (const [name, property] of Object.entries(properties)) row(
              `\`${parentName}.${name}\``,
              ``
              + (parentProp.required?.includes(name)?`*(Required.) * `:'')
              + `**${this.toMdSchemaType(name, property)}**. ${formatDescriptionInTable(property)}`
              + (property.default?`<br />**Default:** \`${JSON.stringify(property.default)}\``:'')
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
        let {title, type, enum: enum_} = variant
        if (this.definitions.has(title)) title = refLink(title)
        type = enum_
          ? `**${type}**: ${enum_.map(x=>`\`${x}\``).join('\\|')}.`
          : `**${type}**.`
        return `|${title}|${type} ${formatDescriptionInTable(variant)}|`
      }).join('\n'),
    ]

    if (type) return [
      `|type|`,
      `|----|`,
      `|**${type}**.|`
    ]

    return []

  }
  /** Return a representation of the a property's type */
  toMdSchemaType = (key, val) => {
    if (val.$ref) return (this.toMdSchemaType(
      refName(val), this.definitions.get(refName(val)) || {}))

    const resolveRef = x =>
      x.type ? refLink(x.title||x.type) :
      x.$ref ? refLink(refName(x)) : '(unknown)'
    const joinOr = '\\|'
    const joinAnd = '&'

    if (val.anyOf) return val.anyOf.map(resolveRef).join(joinOr)
    if (val.oneOf) return val.oneOf.map(resolveRef).join(joinOr)
    if (val.allOf) return val.allOf.map(resolveRef).join(joinAnd)
    if (val.type instanceof Array) return val.type.join(joinOr)

    if (val.type === 'integer') return "integer"
    if (val.type === 'string')  return "string"
    if (val.type === 'boolean') return "boolean"
    if (val.type === 'array')   return `Array&lt;${refLink(refName(val.items))}&gt;`
    if (val.type === 'object')  return "object"

    process.stderr.write(`Warning: unsupported field definition: ${key} -> ${JSON.stringify(val)}`)
    return '(unsupported)'
  }
}
