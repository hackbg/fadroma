import * as Marked from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js'
import { convertSchema } from './schema.mjs'
import DOM from '../ensuite/toolbox/dome/dome.mjs'

console.log({Marked})

// https://docs.okp4.network/assets/files/okp4-cognitarium-38b87179f0c3c7c6f7b35f81306caf25.json
// https://docs.okp4.network/assets/files/okp4-objectarium-eada0cda6e11102840a1c57adfa7132e.json
// https://docs.okp4.network/assets/files/okp4-law-stone-f26aee4b82425895e7f93cb468b1b639.json

class Modal {

  constructor (root) {
    this.root = root
    this.bg = root.querySelector('.schema-converter-modal-background')
    this.bg.addEventListener('click', () => { this.toggle(false) })
    this.cancel = document.querySelector('.schema-converter-modal-cancel')
    this.cancel.addEventListener('click', () => { this.toggle(false) })
  }

  toggle (show = this.root.style.visibility === 'hidden') {
    if (show) {
      Object.assign(this.root.style, { display: '', visibility: 'visible' })
    } else {
      Object.assign(this.root.style, { display: 'none', visibility: 'hidden' })
      this.root.querySelector('input').value = ''
      this.root.querySelector('.schema-converter-modal-error').innerText = ''
    }
  }

}

class UploadModal extends Modal {
  constructor (root) {
    super(root)
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
  async upload () {
    if (this.input.value.trim() === '') return
    let url, resp, data
    await attempt(() => url = new URL(this.input.value),
      e => this.error.innerText = `Invalid URL`)
    await attempt(async () => resp = await fetch(url),
      e => this.error.innerText = `Failed to fetch: ${e.message}`)
    await attempt(async () => data = await resp.json(),
      e => this.error.innerText = `Failed to parse JSON: ${e.message}`)
    const result = await attempt(() => new SchemaViewer(url, data),
      e => this.error.innerText = `Failed to parse the schema: ${e.message}`)
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

class SchemaViewer {

  constructor (source, schema) {

    localStorage[source] = schema

    const {
      contract_name,
      contract_version,
      idl_version,
      description,
      instantiate,
      execute,
      query,
      migrate,
      sudo,
      responses
    } = schema
    const template = document.querySelector('.schema-template')
    this.root = template.content.cloneNode(true).firstChild
    this.content = this.root.querySelector('.schema-content')
    document.querySelector('.schemas').appendChild(this.root)

    this.root.querySelector('[data-name="Name"] .value').innerText = contract_name
    this.root.querySelector('[data-name="Version"] .value').innerText = contract_version
    this.root.querySelector('[data-name="Source"]').innerText = source
    this.root.querySelector('[data-name="Show"]').addEventListener('click', ()=>this.toggle(true))
    this.root.querySelector('[data-name="Hide"]').addEventListener('click', ()=>this.toggle(false))
    //document.querySelector('.schema-metadata [data-name="IDL version"] .value')
      //.innerText = idl_version
    //document.querySelector('.schema-metadata [data-name="Description"] .value')
      //.innerText = `${description.length} chars`
    this.definitionMap = new Map()
    this.body = Object.assign(this.root.querySelector('.schema-body'), { innerText: '' })
    this.body.appendChild(Object.assign(document.createElement('div'), {
      innerHTML: Marked.parse(description)
    }))
    this.body.appendChild(Object.assign(document.createElement('hr')))
    this.populateSection(instantiate,
      () => this.root.querySelector('[data-name="Instantiate"] .value'),
      () => `✔️`,
      this.populateInitMethod)
    this.populateSection(execute,
      () => this.root.querySelector('[data-name="Execute"] .value'),
      (execute) => `${execute.oneOf.length} methods`,
      this.populateMethodVariants)
    this.populateSection(query,
      () => this.root.querySelector('[data-name="Query"] .value'),
      (query) => `${query.oneOf.length} methods`,
      this.populateMethodVariants)
    this.populateSection(migrate,
      () => this.root.querySelector('[data-name="Migrate"] .value'),
      (migrate) => `${migrate.oneOf.length} methods`,
      this.populateMethodVariants)
    this.populateSection(sudo,
      () => this.root.querySelector('[data-name="Sudo"] .value'),
      (sudo) => `${sudo.oneOf.length} methods`,
      this.populateMethodVariants)
    this.populateSection(responses,
      () => this.root.querySelector('[data-name="Responses"] .value'),
      (responses) => `${Object.keys(responses).length} types`)

    const definitionList = document.querySelector('.schema-definitions')
    for (const name of [...this.definitionMap.keys()].sort()) {
      definitionList.appendChild(Object.assign(document.createElement('div'), {
        className: 'schema-definition', innerText: name
      }))}
  }

  toggle (show = this.content.style.visibility === 'hidden') {
    if (show) {
      Object.assign(this.content.style, { display: '', visibility: 'visible' })
    } else {
      Object.assign(this.content.style, { display: 'none', visibility: 'hidden' })
    }
  }

  populateSection (
    data,
    counter = () => { throw new Error('unimplemented') },
    count   = () => { throw new Error('unimplemented') },
    more
  ) {
    if (data) {
      counter().innerText = count(data)
      if (more) more(data)
    } else {
      counter().innerText = `❌`
    }
  }
  populateInitMethod = (variant) => {
    const { title, description, definitions, properties, oneOf } = variant
    if (definitions) for (const name of Object.keys(definitions).sort()) this.definitionMap.set(name)
    this.body.appendChild(Object.assign(document.createElement('h2'), { innerText: `Message: ${title}` }))
    this.body.appendChild(Object.assign(document.createElement('p'), {
      innerHTML: Marked.parse(description)
    }))
    for (const [key, value] of Object.entries(properties)) {
      console.log(key, value)
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
      console.log(title, type)
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

const modal = new UploadModal(document.querySelector('.schema-converter-modal'))

console.log('loaded')

document.querySelector('#upload-from-url').addEventListener('click', () => {
  console.log('hey')
  modal.toggle(true)
})
