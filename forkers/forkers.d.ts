declare module '@hackbg/forkers' {

  export function request <Id, Op, Arg, Ret> (
    port:     MessagePort,
    channel:  string,
    id:       Id,
    op:       Op,
    arg:      Arg,
    timeout?: number,
  ): Promise<Ret>

  export class Client<Op> {
    constructor (port: MessagePort, channel: string, timeout?: number)
    private port:    MessagePort
    private channel: string
    private timeout: number
    private opId:    bigint
    request <Arg, Ret> (op: Op, arg?: Arg, timeout?: number): Promise<Ret>
  }

  export abstract class Backend<Op> extends MessageChannel {
    constructor (channel: string)
    abstract respond <Arg, Ret> (op: Op, arg: Arg): Promise<Ret>
  }

}
