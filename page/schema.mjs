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

  toMd () {
    const fragments = [this.description]
    fragments.concat([
      `## ${this.instantiate.title}`,
      `${this.instantiate.description}`,
      this.toMdSchemaTable(this.instantitate.properties)
    ])
    for (const section of [this.execute, this.query, this.migrate, this.sudo]) {
      if (section) {
        fragments.concat([
          `## ${section.title}`,
          `${section.description}`,
        ])
        for (const variant of section.oneOf) {
          fragments.concat([
            `### ${section.title}::${variant.title}`,
            `${variant.description}`,
            this.toMdSchemaTable(variant.properties, variant['enum'])
          ])
        }
      }
    }
    return fragments.join('\n')
  }

  toMdSchemaTable = (properties = {}, enum_) => {
    if (enum_) {
      enum_ = enum_.map(x=>`"${x}"`).join(" \\| ")
      return [
        `|message|description|`,
        `|-|-|`,
        `|${enum_}||`
      ].join('\n')
    }
    const rows = [
      `|field|type|default|description|`
      `|-|-|-|-|`
    ]
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
      {existsSync, realpathSync}
    ])=>{
      const main = pathToFileURL(argv[1]).href
      if (import.meta.url === main) {
        const args = argv.slice(2)
        if (args.length > 1) {
          console.info('Converting schema:', argv.slice(2))
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
          console.info([
            `Fadroma Schema Renderer (https://fadroma.tech)`,
            `Usage:`,
            `  ${process.argv.join(' ')} CONTRACT_SCHEMA.json`
          ].join('\n'))
          process.exit(1)
        }
      }
    },
    (e)=>{
      console.info('Not running in Node.js')
    }
  )
