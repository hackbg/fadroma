// TODO: in null state, center logo and toolbar in the middle of the screen!

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
    this.loadUrl('https://docs.okp4.network/assets/files/okp4-cognitarium-38b87179f0c3c7c6f7b35f81306caf25.json')
    this.loadUrl('https://docs.okp4.network/assets/files/okp4-objectarium-eada0cda6e11102840a1c57adfa7132e.json')
    this.loadUrl('https://docs.okp4.network/assets/files/okp4-law-stone-f26aee4b82425895e7f93cb468b1b639.json')
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
    this.populateSection(schema.execute,     this.populateMethodVariants)
    this.populateSection(schema.query,       this.populateMethodVariants)
    this.populateSection(schema.migrate,     this.populateMethodVariants)
    this.populateSection(schema.sudo,        this.populateMethodVariants)
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

  populateInitMethod = (variant) => {
    const { title, description, definitions, properties, oneOf } = variant
    if (definitions) for (const name of Object.keys(definitions).sort()) this.definitionMap.set(name)
    this.body.appendChild(Object.assign(document.createElement('h2'), { innerText: `Message: ${title}` }))
    this.body.appendChild(Object.assign(document.createElement('p'), {
      innerHTML: Marked.parse(description)
    }))
    for (const [key, value] of Object.entries(properties)) {
      this.body.appendChild(Object.assign(document.createElement('h4'), { innerText: `Parameter: ${key}` }))
      this.body.appendChild(Object.assign(document.createElement('div'), {
        innerHTML: Marked.parse(description)
      }))
    }
  }
  populateMethodVariants = (variant) => {
    const { title, description, definitions, oneOf } = variant
    if (definitions) for (const name of Object.keys(definitions).sort()) this.definitionMap.set(name)
    this.body.appendChild(Object.assign(document.createElement('h2'), { innerText: `Message: ${title}` }))
    this.body.appendChild(Object.assign(document.createElement('p'), {
      innerHTML: Marked.parse(description)
    }))
    for (const subvariant of oneOf) {
      const { type, title, description, properties, enum: _enum } = subvariant
      this.body.appendChild(Object.assign(document.createElement('h3'), { innerText: `Variant: ${title}` }))
      this.body.appendChild(Object.assign(document.createElement('p'), {
        innerHTML: Marked.parse(description)
      }))
      switch (type) {
        case 'object':
          for (const [key, value] of Object.entries(properties)) {
            this.body.appendChild(Object.assign(document.createElement('h4'), { innerText: `Parameter: ${key}` }))
          }
          continue
        case 'string':
          for (const key of _enum) {
            this.body.appendChild(Object.assign(document.createElement('h4'), { innerText: `Parameter: ${key}` }))
          }
          continue
        default:
          throw Object.assign(new Error(`Unsupported: type of ${title} was ${type}`), { variant })
      }
    }
  }
}
