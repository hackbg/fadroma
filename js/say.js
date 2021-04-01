// https://en.wikipedia.org/wiki/Pointing_and_calling

import colors from 'colors/safe.js'
import { render } from 'prettyjson'

export function sayer (prefixes = []) {

  return Object.assign(say, { tag })

  function say (x = {}) {

    const prefix = `#` + prefixes.map(renderPrefix).join(` #`)

    if (x instanceof Object) {
      if (x.data instanceof Uint8Array) {
        x.data = new TextDecoder('utf-8').decode(x.data)
      }
      console.log(colors.yellow(`${prefix}`))
      if (Object.keys(x).length > 0) {
        console.log(render(x))
      }
    } else {
      console.log(colors.yellow(`${prefix}`), render(x))
    }

    return x
  }

  function tag (x) {
    return sayer([...prefixes, x])
  }

  function renderPrefix (x) {
    if (x instanceof Function) {
      return x()
    } else {
      return x
    }
  }

}

const say = sayer()

export default say

export function muted () {
  return Object.assign(x=>x, {
    tag: () => muted()
  })
}

