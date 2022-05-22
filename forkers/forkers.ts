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
  port:     MessagePort,
  topic:    string,
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
        reject(`${topic}.${op}#${id}(${arg}): timed out after ${timeout}ms`)
      }, timeout)
    }

    // send the request
    port.postMessage([topic, id, op, arg])

    // if receiving a response check if it's the correct one
    function receive ({data: [rChannel, rId, error, result]}) {
      if (rChannel === topic && rId === id) {
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
    readonly topic:   string,
    readonly timeout: number
  ) {}

  private opId = 0

  request <Arg, Ret> (
    op:      Op,
    arg?:    Arg,
    timeout: number = this.timeout
  ): Promise<Ret> {
    return request(this.port, this.topic, this.opId++, op, arg, timeout)
  }

}

export class Backend <Op> {

  topics: Record<string, Backend<unknown>>

  constructor (
    readonly port:  MessagePort,
    readonly topic: string
  ) {
    this.port   = port
    this.topic  = topic
    this.topics = { [this.topic]: this }
    this.port.addEventListener('message', async ({ data: [topic, opId, op, arg] }) => {
      const backend = this.topics[this.topic]
      if (!backend) return
      try {
        const result = await Promise.resolve(backend.respond(op, arg))
        this.port.postMessage([topic, opId, null, result])
      } catch (error) {
        this.port.postMessage([topic, opId, error, null])
      }
    })
  }

  respond <Arg, Ret> (op: Op, arg?: Arg): Promise<Ret> {
    throw new Error(`${this.constructor.name}#respond: unsupported op ${op}(${arg})`)
  }

}
