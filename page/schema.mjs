/** Renderer

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
  }

  getOverview () {
    const props = new Map()
    props.set('Source',
      this.source || `❌`)
    props.set('Name',
      this.contract_name || `❌`)
    props.set('Version',
      this.contract_version || `❌`)
    props.set('IDL version',
      this.idl_version || `❌`)
    props.set('Description',
      this.description || `❌`)
    props.set('Instantiate',         this.instantiate?.properties
      ? `${Object.keys(this.instantiate.properties).length} parameter(s)` : `❌`)
    props.set('Transaction methods', this.execute?.oneOf?.length
      ? `${this.execute.oneOf.length} method(s)`   : `❌`)
    props.set('Query methods',       this.query?.oneOf?.length
      ? `${this.query?.oneOf?.length} method(s)`   : `❌`)
    props.set('Migrate methods',     this.migrate?.oneOf?.length
      ? `${this.migrate?.oneOf?.length} method(s)` : `❌`)
    props.set('Sudo methods',        this.sudo?.oneOf?.length
      ? `${this.sudo?.oneOf?.length} method(s)`    : `❌`)
    props.set('Responses',           this.responses
      ? `${Object.keys(this.responses).length}`    : `❌`)
    return props
  }

  toMd = () => {
    let fragments = [this.description]
    // Add init message
    fragments = fragments.concat(this.toMdInstantiate(this.instantiate))
    // Add other messages
    for (const section of [this.execute, this.query, this.migrate, this.sudo]) {
      const rendered = this.toMdSection(section)
      process.stderr.write(JSON.stringify(rendered))
      process.stderr.write('\n')
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
    if (enum_) return this.toMdSchemaTableEnum(enum_)
    if (properties) return this.toMdSchemaTableProperties(properties)
    return '(unsupported type!)'
  }

  toMdSchemaTableEnum = enum_ => [
    `|message|`,
    `|-------|`,
    `|${enum_.map(x=>`"${x}"`).join(" \\| ")}|`
  ].join('\n')

  toMdSchemaTableProperties = properties => [
    `|field|default|description|`,
    `|-----|-------|-----------|`,
    ...Object.entries(properties).map(([name, property])=>
      this.toMdSchemaTableProperty(name, property))
  ].join('\n')

  toMdSchemaTableProperty = (name, property) => {
    const isObject = (property.allOf?.length > 0) || (property.type === 'object')
    const isString = (property.type === 'string')
    const isNumber = (property.type === 'integer') || (property.type === 'float')
    // Collection of rows that will be returned
    const rows = []
    // If this field has a description, add it as a comment
    // Add the field name, type, and 1st line of default value
    rows.push([
      '',
      `\`${name}\``,
      isObject ? '{' : isString ? '""' : isNumber ? '0' : '',
      `**${this.toMdSchemaType(name, property)}**`
        + '. '
        + (property.description||'').replace(/\n/g,'<br>'),
      ''
    ].join('|'))
    return rows
  }

  toMdSchemaType = (key, val) => {
    switch (true) {
      case (val.type instanceof Array):
        return val.type.join('|')
      case (val.type === 'integer'):
        return "integer"
      case (val.type === 'string'):
        return "string"
      case (val.type === 'object'):
        return "object"
      case (val.type === 'boolean'):
        return "boolean"
      case (val.type === 'array'):
        return ['span', `Array<`, this.refLink(val.items), '>']
      case (!!val.allOf): {
        let type = val.allOf[0].$ref.split('/').slice(-1)[0]
        if (val.allOf.length > 1) type = `${type} + ...`
        return type
      }
      case (!!val.anyOf): {
        return val.anyOf
          .map(x=>x.type ? x.type : x.$ref ? this.refName(x) : '(unknown)')
          .join('|')
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
          const schema = new Schema(argv[2], parsed)
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
