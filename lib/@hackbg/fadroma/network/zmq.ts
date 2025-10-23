/// Based on code by @jjeffcaii (originally published under Apache License 2.0).
/// See https://github.com/jjeffcaii/deno-zeromq/blob/master/LICENSE.
import type { Socket } from '../deps.ts';
import { TcpServer, HttpServer, createConnection } from '../deps.ts';
import type { Net, Route, Handler } from '../index.ts';
import { pipe, reflect } from '../call.ts';
export type SocketType  = 'SUB'; // others are unsupported
export type MessageLike = Uint8Array | string;
export function zmqSub () {
  return {
    transport,
    socketType: 'SUB',
    connect,
    send,
    receive,
    subscribe,
    [Symbol.asyncIterator]() { return iter }
  };
  async function * iter (): AsyncIterableIterator<MessageLike[]> {
    const conn = mustGetConn();
    try {
      let messages: MessageLike[] = [];
      for await (const it of conn) {
        const next = new DataFrame(it.bytes());
        if (next.more()) {
          messages.push(next.payload);
        } else if (next.size > 0) {
          messages.push(next.payload);
          yield messages;
          messages = [];
        }
      }
    } catch (e) {
      if (e instanceof EOFError) return;
      throw e;
    }
  }
  async function subscribe (topic: string): Promise<void> {
    const conn = mustGetConn();
    const topicBytes = TEXT_ENCODER.encode(topic);
    const b = new Uint8Array(topicBytes.length + 1);
    b[0] = 0x01;
    b.set(topicBytes, 1);
    const sub = DataFrame.builder().payload(b).build();
    await conn.write(sub);
    await conn.flush();
  }
  function mustGetConn(): Connection {
    const conn = transport?.connected();
    if (!conn) throw new ConnectionNotReadyError();
    return conn;
  }
  async function send (...msgs: MessageLike[]): Promise<void> {
    const conn = this.transport!.connected()!;
    await conn.write(EMPTY_HAS_MORE);
    await sendMessages(conn, ...msgs);
  }
  async function receive (): Promise<MessageLike[]> {
    if (!this.transport) throw new ConnectionNotReadyError();
    const conn = (this.transport as ClientTransport).connected()!;
    const res = [];
    let hasMore = false;
    do {
      const next = await conn.read();
      hasMore = next.more();
      if (next.size > 0) {
        const data = new DataFrame(next.bytes());
        res.push(data.payload);
      }
    } while (hasMore);
    return res;
  }
  async function connect (addr: string): Promise<void> {
    if (this.transport) throw new Error("connect already!");
    this.transport = connect(addr);
    const conn = await this.transport.connect();
    await this.handshake(conn);
  }
  async function handshake (conn: Connection): Promise<void> {
    // TODO: signature + major -> rest of greeting
    await conn.write(Greeting.builder().build());
    await conn.flush();

    const greeting = await conn.readGreeting();
    log.debug(`RCV: greeting=${greeting}`);

    const first = await conn.read() as Frame;
    if (first.type !== FrameType.Command) throw new Error("handshake failed!");

    const cmd = new CommandFrame(first.bytes());
    if (cmd.name !== CommandName.Ready) throw new Error("handshake failed!");

    const ready = new ReadyCommandFrame(first.bytes());
    log.debug(`RCV: ready=${ready}`);

    const readyReply = ReadyCommandFrame.builder()
      .set(METADATA_KEY_SOCKET_TYPE, this.socketType)
      .set(METADATA_KEY_IDENTITY, "")
      .build();
    await conn.write(readyReply);
    await conn.flush();
  }
};

export class Socket implements Connector, Sender, Receiver {
  protected transport?: ClientTransport;

  constructor(private socketType: SocketType) {
  }
}

export abstract class ServerSocket implements Binder {
  #transport?: ServerTransport;
  protected conns: Set<Connection> = new Set();

  constructor(protected socketType: SocketType) {
  }

  abstract onConnect(conn: Connection): Promise<void>;

  validateSignature(sig: Uint8Array): boolean {
    return true;
  }

  private async handleConn(conn: Connection): Promise<void> {
    conn.onceClose(() => this.conns.delete(conn));

    this.conns.add(conn);

    const sig = await conn.peekSignature();
    if (!this.validateSignature(sig)) {
      conn.close();
      return;
    }

    log.debug(`RCV: sig=${sig}`);

    const greetingReply = Greeting.builder().build();
    await conn.write(greetingReply.bytes());
    await conn.flush();

    const major = await conn.peekVersionMajor();
    log.debug(`RCV: version.major=${major}`);
    const greeting = await conn.readGreeting();
    log.debug(`RCV: greeting=${greeting}`);

    const ready = ReadyCommandFrame.builder()
      .set(METADATA_KEY_SOCKET_TYPE, this.socketType)
      .build();
    await conn.write(ready);
    await conn.flush();

    const first = await conn.read() as Frame;
    if (first.type !== FrameType.Command) {
      throw new Error("Require ready command!");
    }

    const cmd = new CommandFrame(first.bytes());
    if (cmd.name !== CommandName.Ready) {
      throw new Error("Require ready command!");
    }
    const rcvReady = new ReadyCommandFrame(first.bytes());
    log.debug(`RCV: ready=${rcvReady}`);

    this.onConnect(conn);
  }

  async bind(addr: string): Promise<void> {
    if (this.#transport) throw new Error("bind already!");
    const tp = bind(addr);
    this.#transport = tp;
    await tp.bind();
    (async () => {
      for await (const conn of tp) {
        this.handleConn(conn);
      }
    })();
  }
}

export interface Builder {
  hasMore(more?: boolean): Builder;
  payload(data: Uint8Array | string): Builder;
  build(): DataFrame;
}

export class DataBuilder implements Builder {
  #more = false;
  #data?: Uint8Array;

  payload(data: string | Uint8Array): Builder {
    if (data instanceof Uint8Array) {
      this.#data = data;
    } else if (typeof data === "string") {
      this.#data = TEXT_ENCODER.encode(data);
    }
    return this;
  }

  hasMore(more = true): Builder {
    this.#more = more;
    return this;
  }

  build(): DataFrame {
    let flag = 0;
    if (this.#more) {
      flag |= FLAG_MORE;
    }
    let enc;
    const len = this.#data?.length || 0;
    if (len > 0xFF) {
      flag |= FLAG_LONG;
      enc = new Encoder(1 + 8 + len);
      enc.writeByte(flag);
      enc.writeUint64(BigInt(len));
    } else {
      enc = new Encoder(1 + 1 + len);
      enc.writeByte(flag);
      enc.writeByte(len);
    }
    if (len > 0) {
      enc.writeUint8Array(this.#data!);
    }
    return new DataFrame(enc.freeze());
  }
}

const frame = ({ body }) => ({
  body,
  size:          (): number    => frameIsLong(body)    ? Number(new Decoder(body).readUint64(1)) : new Decoder(body).readByte(1),
  type:          (): FrameType => frameIsCommand(body) ? FrameType.Command : FrameType.Message,
  more:          (): boolean   => frameHasMore(body),
  payloadOffset: (): number    => 1 + ((frameIsLong(body)) ? 8 : 1),
});
export const FLAG_COMMAND = 1 << 2;
export const FLAG_LONG = 1 << 1;
export const FLAG_MORE = 1;
export enum FrameType { Command, Message, }
const frameIsCommand = (body: Uint8Array) => (body[0] & FLAG_COMMAND) !== 0;
const frameHasMore   = (body: Uint8Array) => (body[0] & FLAG_MORE)    !== 0;
const frameIsLong    = (body: Uint8Array) => (body[0] & FLAG_LONG)    !== 0;
const EMPTY_HAS_MORE = frame(new Uint8Array([FLAG_MORE, 0]));
const dataFrame = ({ body }) => ({
  ...frame({ body }),
  payload (): Uint8Array {
    const isLong = (this.flags & FLAG_LONG) !== 0;
    const dec = new Decoder(body);
    let n = 0;
    let offset = 1;
    if (isLong) {
      n = Number(dec.readUint64(offset));
      offset += 4;
    } else {
      n = dec.readByte(offset);
      offset++;
    }
    return dec.readUint8Array(n, offset);
  }
});
export const decode = (b: Uint8Array, {
  byte = (off = 0): number => b[off],
  i64 = (off = 0): bigint => new DataView(b.buffer).getBigUint64(off),
  u64 = (off = 0): bigint => new DataView(b.buffer).getBigInt64(off),
  i32 = (off = 0): number => new DataView(b.buffer).getUint32(off),
  u32 = (off = 0): number => new DataView(b.buffer).getInt32(off),
  i16 = (off = 0): number => new DataView(b.buffer).getInt16(off),
  u16 = (off = 0): number => new DataView(b.buffer).getUint16(off),
  buf = (len: number, off = 0): Uint8Array => b.subarray(off, off + len),
  str = (len: number, off = 0, dec = UTF8_DECODER): string => dec.decode(buf(len, off)),
} = {}) => ({ byte, u64, u32, u64, i64, i32, i16 });

export const TEXT_ENCODER  = new TextEncoder();
export const ASCII_DECODER = new TextDecoder("ascii");
export const UTF8_DECODER  = new TextDecoder("utf8");
