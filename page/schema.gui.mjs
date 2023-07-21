// TODO: in null state, center logo and toolbar in the middle of the screen!

import Dome from '../ensuite/toolbox/dome/dome.mjs'
import Schema from './schema.mjs'
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.mjs'
import * as Marked from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js'

Marked.use({ mangle: false, headerIds: false })

export const DB = new Dexie("FadromaJSONSchemaTool")
DB.version(1).stores({ schemas: 'url,timestamp' })

export default class App {

  uploadModal  = new UploadModal(document.querySelector('.schema-converter-modal'))
  uploadButton = document.querySelector('#upload-from-url')
  clearButton  = document.querySelector('footer button[data-name="Clear"]')
  schemaList   = document.querySelector('.schemas')

  constructor () {
    this.uploadButton.addEventListener('click', () => {
      console.log('hey')
      this.uploadModal.toggle(true)
    })
    this.clearButton.addEventListener('click', () => {
      this.schemaList.innerText = ''
      for (const key in globalThis.localStorage) delete localStorage[key]
    })
    this
  }

  loadUrl (url) {
    return new UploadModal(null).upload(url) /** hack */
  }

}

class Toggle {
  constructor (open, button, panel) {
    Object.assign(this, { open, button, panel })
    if (this.button) this.button.addEventListener('click', () => this.toggle())
  }
  toggle = (show = this.panel.style.visibility === 'hidden') => {
    if (!this.panel) return
    if (show) {
      Object.assign(this.panel.style, { display: '', visibility: 'visible' })
    } else {
      Object.assign(this.panel.style, { display: 'none', visibility: 'hidden' })
    }
  }
}

// Base modal class that can be toggled and dims everything else
class Modal extends Toggle {
  constructor (root) {
    super(false, null, root) // Closed toggle of modal root with no button
    this.root = root
    if (this.root) {
      this.bg = root.querySelector('.schema-converter-modal-background')
      this.bg.addEventListener('click', () => { this.toggle(false) })
      this.cancel = document.querySelector('.schema-converter-modal-cancel')
      this.cancel.addEventListener('click', () => { this.toggle(false) })
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

// Modal for fetching from URL
class UploadModal extends Modal {
  constructor (root) {
    super(root)
    if (this.root) {
      this.input  = root.querySelector('.schema-converter-modal-input')
      this.error  = root.querySelector('.schema-converter-modal-error')
      this.button = root.querySelector('.schema-converter-modal-upload')
      this.button.addEventListener('click', ()=>{
        this.upload()
      })
      this.input.addEventListener('keydown', ({ key }) => {
        if (key === 'Enter') this.upload()
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

/** Displays a contract schema */
class SchemaViewer {
  definitionMap = new Map()

  constructor (source, schema) {
    // Validate input by constructing the data object
    // Run-time type checking can be implemented in `Schema`
    schema = new Schema(source, schema)
    // Create a schema viewer from the template in the document.
    const template = document.querySelector('.schema-template')
    this.root = template.content.cloneNode(true).firstChild
    // Hydrate the template
    this.content = this.root.querySelector('.schema-content')
    for (const [name, value] of schema.getOverview().entries()) {
      const selector = `[data-name="${name}"] .value`
      const element  = this.root.querySelector(selector)
      if (element) {
        element.innerText = value
      } else {
        console.warn(`missing element`, { selector, root: this.root })
      }
    }
    // Add description
    this.body = Object.assign(this.root.querySelector('.schema-body'), { innerText: '' })
    const descriptionHTML = Marked.parse(schema.description)
    this.body.appendChild(Object.assign(document.createElement('div'), { innerHTML: descriptionHTML }))
    this.body.appendChild(Object.assign(document.createElement('hr')))
    // Add method lists
    this.populateSection(schema.instantiate, this.populateInitMethod)
    this.body.appendChild(Object.assign(document.createElement('hr')))
    this.populateSection(schema.execute, this.populateMethodVariants)
    this.body.appendChild(Object.assign(document.createElement('hr')))
    this.populateSection(schema.query, this.populateMethodVariants)
    this.body.appendChild(Object.assign(document.createElement('hr')))
    this.populateSection(schema.migrate, this.populateMethodVariants)
    this.body.appendChild(Object.assign(document.createElement('hr')))
    this.populateSection(schema.sudo, this.populateMethodVariants)
    this.body.appendChild(Object.assign(document.createElement('hr')))
    this.populateSection(schema.responses)
    const definitionList = this.root.querySelector('.schema-definitions')
    for (const name of [...this.definitionMap.keys()].sort()) {
      definitionList.appendChild(Object.assign(document.createElement('div'), {
        className: 'schema-definition', innerText: name
      }))}
    // Append the hydrated template to the document
    document.querySelector('.schemas').appendChild(this.root)
    // Bind event handlers
    this.root.querySelector('[data-name="Show"]')
      .addEventListener('click', ()=>this.toggle(true))
    this.root.querySelector('[data-name="Hide"]')
      .addEventListener('click', ()=>this.toggle(false))
  }

  toggle (show = this.content.style.visibility === 'hidden') {
    if (show) {
      Object.assign(this.content.style, { display: '', visibility: 'visible' })
    } else {
      Object.assign(this.content.style, { display: 'none', visibility: 'hidden' })
    }
  }

  populateSection (data, render) {
    if (data && render) render(data)
  }

  schemaSample = (properties) => Dome('table.schema-sample',
    ['tr', ['td', '{']],
    ...Object.entries(properties).map(([key, val])=>[
      'tr', ['td'],
      ['td', `"${key}":`],
      [`td.schema-type`, this.schemaType(val)],
      val.description?['td.schema-type', '//']:null,
      val.description?['td.schema-type', { innerHTML: Marked.parse(val.description) }]:null,
    ]),
    ['tr', ['td', '}']],
  )

  schemaType = val =>
    val.type || val.allOf?.map(x=>x.$ref.split('/').slice(-1)).join(' | ')

  populateInitMethod = (variant) => {
    const { title, description, definitions, properties, oneOf } = variant
    if (definitions)
      for (const name of Object.keys(definitions).sort())
        this.definitionMap.set(name)
    Dome.append(this.body,
      Dome('h2',
        ['span', { style:'opacity:0.5'},`Message: `],
        `${title}`),
      Dome('p', { innerHTML: Marked.parse(description) }),
      this.schemaSample(properties))
  }

  populateMethodVariants = (variant) => {
    const { title, description, definitions, oneOf } = variant
    if (definitions)
      for (const name of Object.keys(definitions).sort())
        this.definitionMap.set(name)
    Dome.append(this.body,
      Dome('.row',
        ['h2', { style:'margin:0' }, ['span', { style:'opacity:0.5'},`Message: `], `${title}`],
        ['.grow'],
        ['button', 'Copy JSONSchema']))
    for (const subvariant of oneOf) {
      const { type, title, description, properties, enum: _enum } = subvariant
      const content = Dome('div')
      Dome.append(this.body, Dome('div',
        ['div',
          ['h3', ['span', {style:'opacity:0.5'}, `${variant.title}::`], `${title}`],
          ['p', { innerHTML: Marked.parse(description) }]],
        content,
        this.schemaSample(properties)))
      //if (type === 'object') {
        //for (const [key, value] of Object.entries(properties)) {
          //const properties = Object.entries(value.properties)
            //.map(([key,val])=>`"${key}": ${JSON.stringify(val,null,2)}`)
            //.join(',\n    ')
          //Dome.append(content, Dome('.row', { style: 'align-items:flex-start' },
            //['h4', {style:'white-space:pre;font-family:monospace;font-size:1rem'},
              //`{\n`,
              //`  "${key}": `,
              //['span.schema-type', `<${value.type}> `],
              //`{\n    ${properties}\n  }\n}`],
            //['.grow'],
            //['span.schema-type', '<object>']))
        //}
      //}
      //switch (type) {
        //case 'object':
          ////Dome.append(this.body, this.schemaSample(properties))
          ////for (const [key, value] of Object.entries(properties)) {
            ////console.log(key, value)
            ////Dome.append(this.body, Dome('h4', {style:'white-space:pre;font-family:monospace;font-size:1rem'},
              ////`{\n`,
              ////`  "${key}": `,
              ////['span.schema-type', `<${value.type}> `],
              ////`{\n    ${Object.keys(value.properties).map(x=>`"${x}": `).join(',\n    ')}\n  }\n}`))
            ////console.log(variant.title, title, key, value)
          ////}
          //continue
        //case 'string':
          //Dome.append(this.body, )
          //continue
        //default:
          //throw Object.assign(new Error(`Unsupported: type of ${title} was ${type}`), { variant })
      //}

      //Dome.append(this.body,
        //Dome('p', { innerHTML: Marked.parse(description) }))

    }
  }
}
