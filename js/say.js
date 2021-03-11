const colors = require('colors/safe')

module.exports = (function sayer (prefix = '') {

  return Object.assign(say, { tag })

  function say (x = {}) {

    if (x instanceof Object) {
      if (x.data instanceof Uint8Array) {
        x.data = new TextDecoder('utf-8').decode(x.data)
      }
      console.log(colors.yellow(`\n${prefix}`))
      if (Object.keys(x).length > 0) {
        console.log(require('prettyjson').render(x))
      }
    } else {
      console.log(colors.yellow(`\n${prefix}`), require('prettyjson').render(x))
    }

    return x
  }

  function tag (x) {
    return sayer(`${prefix}${x}`)
  }

})()

module.exports.mute = function muteSayer () {
  Object.assign(x=>x, {
    tag: () => muteSayer()
  })
}
