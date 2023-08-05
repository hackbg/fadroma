/**

  Fadroma Schema Tool Web GUI
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

import * as Marked from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js'
Marked.use({ mangle: false, headerIds: false })
const renderMD = md => {
  console.warn('Fixme: Unsafe MD->HTML render! Sanitize the output!')
  return { innerHTML: Marked.parse(md) }
}

import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs'
export const DB = new Dexie("FadromaJSONSchemaTool")
DB.version(1).stores({ schemas: 'url,added,[url+added],[name+version]' })

import Schema, { refLink, refName, isObject, isString, isNumber } from './schema.mjs'

import Dome from '../ensuite/toolbox/dome/dome.mjs'

/** Main class. */
export default class App {
  /** Container for all `SchemaViewer`s */
  schemaList = Dome.select('.schemas')
  /** Clears schema list and local storage */
  clearButton = Dome.bind(Dome.select('footer button[data-name="Clear"]'), {
    'click': () => {
      this.schemaList.innerText = ''
      for (const key in globalThis.localStorage) delete localStorage[key]
    }
  })
  /** Add a new schema viewer. */
  addSchemaViewer = (source, schema) =>
    new SchemaViewer(source, schema)
  /** Button for uploading schema from file dialog. */
  addFromFileButton = Dome.bind(Dome.select('header button[data-name="AddFromFile"]'), {
    'click': () => pickFiles(async files=>{
      for (const file of files) {
        console.debug(`Reading ${file.name}`)
        const json = await file.text()
        const data = JSON.parse(json)
        this.addSchemaViewer(file.name, data)
        const added = + new Date()
        const { contract_name: name, contract_version: version } = data
        const url = new URL(file.name, 'file:').toString()
        await DB.schemas.put({ name, version, data, url, added })
      }
    })
  })
  /** Modal for fetching schema from URL */
  addFromUrlModal = new SchemaFromURLModal(
    Dome.select('.schema-converter-modal[data-name="URL"]'),
    Dome.select('header button[data-name="AddFromURL"]')
  )
  /** Load a schema from URL programmatically. */
  loadUrl = (url) => new SchemaFromURLModal(null).upload(url) /** hack */
}

/** Open a file picker. */
const pickFiles = (cb) => Dome.bind(Dome('input', { type: 'file', multiple: true }), {
  change: (event) => cb(event.target.files)
}).click()

/** Displays a contract schema */
class SchemaViewer extends Schema {
  /** Clone of the template in the DOM. */
  root = Dome.select('.schema-template').content.cloneNode(true).firstChild
  /** Container for main content. */
  content = this.root.querySelector('.schema-content')
  /** Container element for index of definitions. */
  definitionList = this.root.querySelector('.schema-definitions')
  /** Button to show details */
  showButton = Dome.bind(this.root.querySelector('[data-name="Show"]'), {
    click: ()=>this.toggle(true)
  })
  /** Button to hide details */
  hideButton = Dome.bind(this.root.querySelector('[data-name="Hide"]'), {
    click: ()=>this.toggle(false)
  })
  /** Container for schema description */
  descriptionBox = this.root.querySelector('.schema-description')
  /** Button to open conversion menu */
  convertButton = this.root.querySelector('[data-name="Convert"]')

  constructor (source, schema) {
    super(source, schema)
    // Create a schema viewer from the template in the document.
    const template = Dome.select('.schema-template')
    // Add metadata
    for (const [name, value] of this.getOverview().entries()) this.populateField(name, value)
    // Add description
    Object.assign(this.descriptionBox, renderMD(this.description))
    // Add constructor
    this.populateInitMethod(this.instantiate)
    // Add methods and responses
    for (const section of [this.execute, this.query, this.migrate, this.sudo])
      if (section)
        this.populateMethodVariants(section)
    // Add responses
    if (this.responses)
      this.populateResponses(this.responses)
    // Add type definitions
    for (const name of [...this.definitions.keys()].sort())
      Dome.append(this.definitionList,
        Dome('div.schema-definition', name))
    // Append the hydrated template to the document
    Dome.append(Dome.select('.schemas'), this.root)
    // Bind event handlers
    Object.assign(this.showButton.style, { display: 'none', visibility: 'hidden' })
  }

  toggle (show = this.content.style.visibility === 'hidden') {
    Object.assign(this.content.style, show
      ? { display: '', visibility: 'visible' }
      : { display: 'none', visibility: 'hidden' })
    Object.assign(this.showButton.style, !show
      ? { display: '', visibility: 'visible' }
      : { display: 'none', visibility: 'hidden' })
    Object.assign(this.hideButton.style, show
      ? { display: '', visibility: 'visible' }
      : { display: 'none', visibility: 'hidden' })
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

  populateField (name, value) {
    const selector = `[data-name="${name}"] .value`
    const element = this.root.querySelector(selector)
    if (element) {
      element.innerText = value
    } else {
      console.warn(`missing element`, { selector, root: this.root })
    }
  }

  populateInitMethod = (variant) => {
    const { title, description, definitions, properties } = variant
    Dome.append(this.content,
      Dome('.schema-body',
        ['.row.schema-message-header',
          ['h2', { style:'margin:0' }, ['span.schema-message-name', `Message: `], `${title}`],
          ['.grow'],
          ['button', 'Copy example message'],
          ['button', 'Copy JSONSchema']],
        ['p', renderMD(description)],
        this.schemaSample(properties)))
  }

  populateMethodVariants = (variant) => {
    const { title, description, definitions, oneOf } = variant
    // Add message
    const body = Dome('.schema-body',
      ['.row',
        ['h2', { style:'margin:0' }, ['span.schema-message-name', `Message: `], `${title}`],
        ['.grow'],
        ['button', 'Copy JSONSchema']]) 
    Dome.append(this.content, body)
    // Add each method
    for (const subvariant of oneOf) {
      const { title, description, properties, enum: enum_ } = subvariant
      Dome.append(body,
        Dome('.schema-message',
          ['div',
            ['h3', ['span.schema-message-name', `${variant.title}::`], `${title}`],
            ['p', renderMD(description)],
            ['.row.schema-message-example',
              ['.schema-sample-wrapper', this.schemaSample(properties, enum_)],
              ['.schema-sample-actions',
                ['button', {style:'white-space:nowrap'}, 'Copy JSON message'],
                ['button', {style:'white-space:nowrap'}, 'Copy okp4d command']]]]))
    }
  }

  populateResponses = (responses) => {}

  /** Render a box with sample message structure. Type annotations and descriptions
    * are non-selectable, so copying the contents of the box should copy just the
    * JSON keys and values, i.e. JSON template */
  schemaSample = (properties = {}, enum_) => {
    if (enum_) {
      enum_ = enum_.map(x=>`"${x}"`).join(" | ")
      return ['table.schema-sample', ['tr', ['td', enum_]]]
    }
    let rows = []
    for (const [k, v] of Object.entries(properties)) {
      rows = rows.concat(this.schemaSampleField(k, v))
    }
    return ['table.schema-sample', { cellSpacing: 0 },
      //['thead',
        //['tr',
          //['td', 'field'],
          //['td', 'type'],
          //['td', 'default'],
          //['td', 'description']]],
      ['tbody',
        ['tr', ['td', '{']],
        ...rows,
        ['tr', ['td', '}']]]]
  }

  schemaSampleField = (key, val) => {
    const isObject = (val.allOf?.length > 0) || (val.type === 'object')
    const isString = (val.type === 'string')
    const isNumber = (val.type === 'integer') || (val.type === 'float')
    // Collection of rows that will be returned
    const rows = []
    // If this field has a description, add it as a comment
    // Add the field name, type, and 1st line of default value
    rows.push(['tr',
      ['td.schema-field-key', `  "${key}": `],
      ['td', isObject ? '{' : isString ? '"",' : isNumber ? '0,' : null],
      ['td.schema-field-description.no-select',
        ['span.schema-type', this.schemaType(key, val)],
        '. ',
        ['span', val.description ? renderMD(val.description) : ['p']]]])
    // If type is object, add remaining lines of default value
    if (isObject) {
      const properties = this.resolveAllOf(val)
      for (const [k, v] of Object.entries(properties)) {
        const isObject = (v.allOf?.length > 0) || (v.type === 'object')
        const isString = (v.type === 'string')
        const isNumber = (v.type === 'integer') || (v.type === 'float')
        rows.push(['tr',
          ['td.schema-field-key', `    "${k}": `],
          ['td', `${JSON.stringify(v.default||(isObject ? {} : isString ? "" : isNumber ? 0 : null))}`],
          ['td.schema-field-description.no-select',
            ['span.schema-type', this.schemaType(k, v)],
            '. ',
            ['span', v.description ? renderMD(v.description) : ['p']]]])
      }
      rows.push(['tr', ['td', {style:'font-weight:normal;white-space:pre'}, ['p', '  },']],])
    }
    console.log('schemaSampleField', key, val, rows)
    return rows
  }

  schemaType = (key, val) => {
    switch (true) {
      case (val.type instanceof Array): return val.type.join('|')
      case (val.type === 'integer'):    return "integer"
      case (val.type === 'string'):     return "string"
      case (val.type === 'object'):     return "object"
      case (val.type === 'boolean'):    return "boolean"
      case (val.type === 'array'):      return ['span', `Array<`, refLink(val.items), '>']
      case (!!val.allOf): {
        let type = val.allOf[0].$ref.split('/').slice(-1)[0]
        if (val.allOf.length > 1) type = `${type} + ...`
        return ['a', {href:'#'}, `${type}`]
      }
      case (!!val.anyOf): {
        return val.anyOf
          .map(x=>
            x.type ? x.type :
            x.$ref ? refName(x) : ['span', { style:'color:tomato' }, 'unknown'])
          .join('|')
      }
    }
    console.warn(`Unsupported field definition: ${key} -> ${JSON.stringify(val)}`, {
      key, val
    })
    return ['span', { style:'color:tomato' }, 'unsupported']
  }
}

/** Generic togglable component that shows/hides a panel in response to a button. */
class Toggle {
  constructor (open, button, panel) {
    Object.assign(this, { open, button, panel })
    if (this.button) Dome.bind(this.button, { click: () => this.toggle() })
  }
  /** Change the visibility of the toggled panel. */
  toggle = (show = this.panel.style.visibility === 'hidden') => {
    if (!this.panel) return
    if (show) {
      Object.assign(this.panel.style, { display: '', visibility: 'visible' })
    } else {
      Object.assign(this.panel.style, { display: 'none', visibility: 'hidden' })
    }
  }
}

class PopupMenu extends Toggle {}

class CopyGuard extends Toggle {}

/** Base modal class that can be toggled, and dims everything else. */
class Modal extends Toggle {
  constructor (root, toggle) {
    // Start out closed
    super(false, toggle, root)
    this.root = root
    if (this.root) {
      this.bg = Dome.bind(root.querySelector('.schema-converter-modal-background'), {
        click: () => { this.toggle(false) }
      })
      this.cancel = Dome.bind(root.querySelector('.schema-converter-modal-cancel'), {
        click: () => { this.toggle(false) }
      })
    } else {
      console.warn('warning: awakened the dreaded rootless modal')
    }
  }
  toggle (show = this.root.style.visibility === 'hidden') {
    super.toggle(show)
    if (!show) { // Clean up
      this.root.querySelector('input').value = ''
      this.root.querySelector('.schema-converter-modal-error').innerText = ''
    }
  }
}

/** Modal for fetching a schema from URL. On error, displays error without closing. */
class SchemaFromURLModal extends Modal {
  constructor (root, toggle) {
    super(root, toggle)
    if (this.root) {
      this.error = root.querySelector('.schema-converter-modal-error')
      this.input = Dome.bind(root.querySelector('.schema-converter-modal-input'), {
        keydown: ({ key }) => { if (key === 'Enter') this.upload() }
      })
      this.button = Dome.bind(root.querySelector('.schema-converter-modal-upload'), {
        click: () => this.upload()
      })
    }
  }
  async upload (url = this.input?.value||'') {
    url = url.trim()
    if (url === '') return

    await attempt(
      () => url = new URL(url),
      e => { this.error && (this.error.innerText = `Invalid URL`) })

    let resp
    await attempt(
      async () => resp = await fetch(url),
      e => { this.error && (this.error.innerText = `Failed to fetch: ${e.message}`) })

    let data
    await attempt(
      async () => data = await resp.json(),
      e => { this.error && (this.error.innerText = `Failed to parse JSON: ${e.message}`) })

    const result = await attempt(
      () => new SchemaViewer(url, data),
      e => { this.error && (this.error.innerText = `Failed to parse the schema: ${e.message}`) })

    if (result) this.toggle(false)
    return result
  }
}

/** Try/catch wrapper. */
async function attempt (cb, onfail) {
  let result
  try {
    result = await Promise.resolve(cb())
  } catch (e) {
    console.error(e)
    onfail(e)
  }
  return result
}

const refLink = type =>
  type.type ? type.type :
  type.$ref ? ['a', { href: '#' }, refName(type)] : undefined
