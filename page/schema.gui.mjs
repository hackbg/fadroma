import { convertSchema } from './schema.mjs'

const modal = document.querySelector('.schema-converter-modal')

document.querySelector('.schema-converter-modal-background').addEventListener('click', () => {
  toggleModal(false)
})

const toggleModal = (show = modal.style.visibility === 'hidden') => {
  if (show) {
    modal.style.display    = ''
    modal.style.visibility = 'visible'
  } else {
    modal.style.display    = 'none'
    modal.style.visibility = 'hidden'
  }
}

console.log('loaded')
document.querySelector('#upload-from-url').addEventListener('click', () => {
  console.log('hey')
  toggleModal()
})
