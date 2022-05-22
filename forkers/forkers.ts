export function isWorker (): boolean {
  const isWindowContext = (
    typeof self   !== "undefined" &&
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
  port:     MessagePort,
  channel:  string,
  id:       Id,
  op:       Op,
  arg:      Arg,
  timeout?: number
): Promise<Ret> {

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

export class Client <Op> {

  constructor (
    readonly port:    MessagePort,
    readonly channel: string,
    readonly timeout: number
  ) {}

  private opId = 0

  request <Arg, Ret> (
    op:      Op,
    arg?:    Arg,
    timeout: number = this.timeout
  ): Promise<Ret> {
    return request(this.port, this.channel, this.opId++, op, arg, timeout)
  }

}

export class Backend <Op> {

  channels: Record<string, Backend<unknown>>

  constructor (
    readonly port:    MessagePort,
    readonly channel: string
  ) {
    this.port     = port
    this.channel  = channel
    this.channels = { [this.channel]: this }
    this.port.addEventListener('message', async ({ data: [channel, opId, op, arg] }) => {
      const backend = this.channels[this.channel]
      if (!backend) return
      try {
        const result = await Promise.resolve(backend.respond(op, arg))
        this.port.postMessage([channel, opId, null, result])
      } catch (error) {
        this.port.postMessage([channel, opId, error, null])
      }
    })
  }

  respond <Arg, Ret> (op: Op, arg?: Arg): Promise<Ret> {
    throw new Error(`${this.constructor.name}#respond: unsupported op ${op}(${arg})`)
  }

}
