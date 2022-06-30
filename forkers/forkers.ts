export function isWorker (): boolean {
  const isWindowContext = (
    typeof self !== "undefined" &&
    typeof Window !== "undefined" &&
    self instanceof Window
  )
  return (
    typeof self !== "undefined" &&
    self.postMessage &&
    !isWindowContext ? true : false
  )
}

export function request <Id, Op, Arg, Ret> (
  port:      MessagePort,
  topic:     string,
  id:        Id,
  op:        Op,
  arg:       Arg,
  transfer?: Transferable[],
  timeout?:  number,
): Promise<Ret> {

  return new Promise((resolve, reject)=>{

    // start listening for response
    port.addEventListener('message', receive)

    // start waiting for timeout
    let timer
    if (timeout && timeout > 0 && timeout < Infinity) {
      timer = setTimeout(()=>{
        port.removeEventListener('message', receive)
        reject(`${topic}.${op}#${id}(${arg}): timed out after ${timeout}ms`)
      }, timeout)
    }

    // send the request
    port.postMessage([topic, id, op, arg], transfer)

    // if receiving a response check if it's the correct one
    function receive ({data: [rTopic, rId, error, result]}) {
      if (rTopic === topic && rId === id) {
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

export class Client <Op> {

  constructor (
    readonly port:      MessagePort,
    readonly topic:     string,
    readonly callback?: Function,
    readonly timeout?:  number
  ) {
    if (callback) {
      this.port.addEventListener('message', ({ data: [rTopic, rId, error, notification] })=>{
        if (rTopic === this.topic && rId === null) {
          callback(error, notification)
        }
      })
    }
  }

  opId = 0

  request <Arg, Ret> (
    op:        Op,
    arg?:      Arg,
    transfer?: Transferable[],
    timeout:   number = this.timeout,
  ): Promise<Ret> {
    return request(this.port, this.topic, this.opId++, op, arg, transfer, timeout)
  }

  terminate () {
    if (this.port.terminate) {
      this.port.terminate()
    } else if (this.port.close) {
      this.port.close()
    } else {
      throw new Error('Client#terminate: no terminate or close method on port')
    }
  }

}

export class Backend <Op> {

  topic: string

  constructor (
    readonly port:  MessagePort,
    topic?: string
  ) {
    this.port  = port
    this.topic = topic || this.topic
    this.port.addEventListener('message', this.dispatch.bind(this))
  }

  async dispatch ({ data: [topic, opId, op, arg] }) {
    if (topic !== this.topic) return
    try {
      const result = await Promise.resolve(this.respond(op, arg))
      this.port.postMessage([topic, opId, null, result])
    } catch (error) {
      this.port.postMessage([topic, opId, error, null])
    }
  }

  notify (...args: any[]): void {
    this.port.postMessage([this.topic, null, null, args])
  }

  respond <Arg, Ret> (op: Op, arg?: Arg): Promise<Ret> {
    throw new Error(`${this.constructor.name}#respond: unsupported op ${op}(${arg})`)
  }

}

export function forkersDebug (Class: typeof Client|typeof Backend) {

  if (Class.prototype instanceof Client) {
    console.debug('Forkers: debugging client', Class)
    return class DebuggedClient<Op> extends Class {
      request <Arg, Ret> (op: Op, arg?: Arg, timeout?: number): Promise<Ret> {
        const self = this as unknown as Client<Op>
        self.opId++
        console.debug(
          `Forkers: debug client=${Class.name}`,
          `request(topic=${self.topic} opId=${self.opId} op=${op} arg=${arg} timeout=${timeout})`
        )
        return super.request(op, arg, timeout)
      }
    }
  }

  if (Class.prototype instanceof Backend) {
    console.debug('Forkers: debugging backend', Class)
    return class DebuggedBackend<Op> extends Class {
      async dispatch ({ data: [topic, opId, op, arg] }) {
        console.debug(
          `Forkers: debug backend=${Class.name}`,
          `dispatch(topic=${topic} opId=${opId} op=${op} arg=${arg})`
        )
        return await super.dispatch({data: [ topic, opId, op, arg ]})
      }
      async respond <Arg, Ret> (op: Op, arg?: Arg): Promise<Ret> {
        const result = await super.respond(op, arg)
        console.debug(
          `Forkers: debug backend=${Class.name}`,
          `respond(op=${op} arg=${arg} result=${result})`
        )
        return result
      }
    }
  }

  console.warn(
    'Forkers debug: tried to debug class', Class, 'which is neither Client not Backend'
  )
  return Class

}
