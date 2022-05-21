export function isWorker (): boolean {
  const isWindowContext = typeof self !== "undefined" && typeof Window !== "undefined" && self instanceof Window
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

  private opId = 0n

  request <Arg, Ret> (
    op:      Op,
    arg?:    Arg,
    timeout: number = this.timeout
  ): Promise<Ret> {
    return request(this.port, this.channel, this.opId++, op, arg, timeout)
  }

}

export abstract class Backend <Op> extends MessageChannel {

  channels: Record<string, Backend<unknown>>

  constructor (readonly channel: string) {
    super()
    this.channels = { [channel]: this }
    this.port2.addEventListener('message', async ({ data: [channel, opId, op, arg] }) => {
      const backend = this.channels[channel]
      if (!backend) return
      try {
        const result = await Promise.resolve(backend.respond(op, arg))
        this.port2.postMessage([channel, opId, null, result])
      } catch (error) {
        this.port2.postMessage([channel, opId, error, null])
      }
    })
  }

  abstract respond <Arg, Ret> (op: Op, arg?: Arg): Promise<Ret>

}
