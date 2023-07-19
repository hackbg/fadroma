import { convertSchema } from './schema.mjs'

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
      this.root.style.display = ''
      this.root.style.visibility = 'visible'
    } else {
      this.root.style.display = 'none'
      this.root.style.visibility = 'hidden'
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
    this.button.addEventListener('click', ()=>this.upload())
  }

  async upload () {
    console.log('asdf')
    let url, resp, data
    try {
      url = new URL(this.input.value)
    } catch (e) {
      this.error.innerText = `Invalid URL`
      return
    }
    try {
      resp = await fetch(url)
    } catch (e) {
      this.error.innerText = `Failed to fetch: ${e.message}`
      return
    }
    try {
      data = await resp.json()
    } catch (e) {
      this.error.innerText = `Failed to parse JSON: ${e.message}`
      return
    }
    console.log({url, resp, data})
    this.toggle(false)
  }

}

const modal = new UploadModal(document.querySelector('.schema-converter-modal'))

console.log('loaded')

document.querySelector('#upload-from-url').addEventListener('click', () => {
  console.log('hey')
  modal.toggle(true)
})
