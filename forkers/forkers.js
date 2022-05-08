export function request (port, channel, id, op, arg, timeout) {
  return new Promise((resolve, reject)=>{

    // start listening for response
    port.addEventListener('message', receive)

    // start waiting for timeout
    let timer
    if (timeout) {
      timer = setTimeout(()=>{
        port.removeEventListener('message', receive)
        reject(`${channel}.${op}#${id}(${arg}): timed out after ${timeout}ms`)
      }, timeout)
    }

    // send the request
    port.postMessage([channel, id, op, arg])

    // if receiving a response check if it's the correct one
    function receive ({data: [rChannel, rId, error, result]}) {
      if (rChannel === channel && rId === id) {
        if (timer) clearTimeout(timer)
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
        port.removeEventListener('message', receive)
      }
    }

  })
}

export class Client {
  constructor (port, channel, timeout) {
    this.port    = port
    this.channel = channel
    this.timeout = timeout
    this.opId    = 0n
  }
  request (op, arg, timeout = this.timeout) {
    return request(this.port, this.channel, this.opId++, op, arg, timeout)
  }
}

export class Backend extends MessageChannel {
  constructor (channel) {
    super()
    this.channel = channel
    this.port2.addEventListener('message', ({ data: [channel, opId, op, arg] }) => {
      if (channel !== this.channel) return
      Promise.resolve(this.respond(op, arg))
        .then(result=>this.port2.postMessage([channel, opId, null, result]))
        .catch(error=>this.port2.postMessage([channel, opId, error, null]))
    })
  }
  respond (op, arg) {
    throw new Error(`Backend#respond(${this.channel}): not implemented`)
  }
}

export function isWorker () {
  const isWindowContext = typeof self !== "undefined" && typeof Window !== "undefined" && self instanceof Window
  return typeof self !== "undefined" && self.postMessage && !isWindowContext ? true : false
}
