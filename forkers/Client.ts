import Observable from 'zen-observable'

export default class WorkerClient {

  /** Allows a different Promise implementation to be used */
  Promise = Promise

  /** Allows a different Observable implementation to be used */
  Observable = Observable

  /** Wrap a Worker object. */
  constructor (
    readonly name:   string,
    readonly worker: Worker
  ) {
    this.worker.addEventListener('message', this.respond.bind(this))
  }

  /** Incremented on every RPC */
  private id      = 0n

  /** Map of request id to response callback */
  private requests: Map<BigInt, Function> = new Map()

  /** Default timeout, can be overridden via request options. */
  private timeout = 1000

  /** Send a message to a worker, and return either a Promise or an Observable. */
  request (
    message:   Array<any>,
    options?: {
      transfer?: Transferable[],
      timeout?:  number,
      observe?:  boolean
    }
  ): Promise<any>|Observable<any> {

    const id = this.id++
    if (this.requests.has(id)) {
      throw new Error(`${this.name}: id ${id} was reused. This can't happen.`)
    }

    const primitive = (options?.observe)

      ? new Observable((observer: any)=>{
          this.requests.set(id, (response: any) => {
            observer.next(response)
          })
        })

      : new Promise((resolve, reject)=>{
          this.requests.set(id, (response: any) => {
            clearTimeout(timeout)
            resolve(response)
          })
          const t = options?.timeout || this.timeout
          const timeout = setTimeout(()=>{
            reject(new Error(`${this.name}: RPC#${id} timed out after ${t}ms.`))
          }, t)
        })

    this.worker.postMessage(
      [id, message, !!options?.observe],
      {transfer: options?.transfer}
    )

    return primitive

  }

  /** Resolve a promise, or feed data into an Observable. */
  private respond (event: { data: [BigInt, any, any, boolean] }) {

    let id: BigInt
    let error: any
    let response: any
    let done = false

    try {
      [id, error, response, done] = event.data
    } catch (e) {
      throw new Error(`${this.name}: got malformed RPC response`)
    }

    if (error) {
      throw error
    }

    const callback = this.requests.get(id)

    if (callback) {
      callback(response)
      if (done) this.requests.delete(id)
    } else {
      throw new Error(`${this.name}: got RPC response for uncalled RPC#${id}`)
    }

  }

}
