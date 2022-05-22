---
literate: typescript
---

# Forkers 👷🍴🥩

Isomorphic Web Workers via `MessageChannel` and `MessagePort`.

Implements a simple request/response mechanism using an auto-incrementing index.

## Basic usage

```typescript
import { Client, Backend, isWorker, forkersDebug } from './forkers'

import { equal, deepEqual } from 'assert'

enum ExampleOp { Msg1, Msg2, Msg3 }

class ExampleBackend extends Backend<ExampleOp> {
  async respond (op, arg?): Promise<string|number> {
    switch (op) {
      case ExampleOp.Msg1:
        return 'ok'
      case ExampleOp.Msg2:
        return `passed string: ${arg}`
      case ExampleOp.Msg3:
        return arg[0] + arg[1]
      default:
        super.respond(op, arg)
    }
  }
}

class ExampleClient extends Client<ExampleOp> {
  async sendMsg1 () {
    return await this.request(ExampleOp.Msg1)
  }
  async sendMsg2and3 (arg1: string, arg2: number, arg3: number, timeout?) {
    return await Promise.all([
      this.request(ExampleOp.Msg2, arg1, timeout),
      this.request(ExampleOp.Msg3, [arg2, arg3], timeout)
    ])
  }
}

;(async function simpleExample () {
  const channel = new MessageChannel()
  const backend = new ExampleBackend(channel.port1)
  const client  = new ExampleClient(channel.port2)
  equal(
    await client.sendMsg1(),
    'ok'
  )
  deepEqual(
    await client.sendMsg2and3('foo', 2, 2),
    ['passed string: foo', 4]
  )
  channel.port1.close()
  console.log('Example 1 OK.')
})()
```

## Multiple `Client`/`Backend` pairs over the same `MessageChannel`

```typescript
enum ExampleTopics { Topic1 = 'topic1', Topic2 = 'topic2' }

enum Topic1Op { Msg4, Msg5 }

class Topic1Backend extends Backend<Topic1Op> {
  topic = ExampleTopics.Topic1
  async respond (op, arg?): Promise<string|number> {
    switch (op) {
      case Topic1Op.Msg4:
        return 'msg4 ok'
      case Topic1Op.Msg5:
        return `msg5 ok`
      default:
        super.respond(op, arg)
    }
  }
}

class Topic1Client extends Client<Topic1Op> {
  topic = ExampleTopics.Topic1
  async sendMsg4 () {
    return await this.request(Topic1Op.Msg4)
  }
  async sendMsg5 () {
    return await this.request(Topic1Op.Msg5)
  }
}

enum Topic2Op { Msg6, Msg7 }

class Topic2Backend extends Backend<Topic2Op> {
  topic = ExampleTopics.Topic2
  async respond (op, arg?): Promise<string|number> {
    switch (op) {
      case Topic2Op.Msg6:
        return 'msg6 ok'
      case Topic2Op.Msg7:
        return `msg7 ok`
      default:
        super.respond(op, arg)
    }
  }
}

class Topic2Client extends Client<Topic2Op> {
  topic = ExampleTopics.Topic2
  async sendMsg6and7 () {
    return await Promise.all([
      this.request(Topic2Op.Msg6),
      this.request(Topic2Op.Msg7),
    ])
  }
}

class MultiBackend extends ExampleBackend {
  topic1 = new Topic1Backend(this.port)
  topic2 = new Topic2Backend(this.port)
}

class MultiClient extends ExampleClient {
  topic1 = new Topic1Client(this.port)
  topic2 = new Topic2Client(this.port)
  async sendManyMessages () {
    return await Promise.all([
      this.sendMsg1(),
      this.topic1.sendMsg4()
      this.topic1.sendMsg5(),
      this.topic2.sendMsg6and7(),
    ])
  }
}

;(async function multiExample () {
  const channel = new MessageChannel()
  const backend = new MultiBackend(channel.port1)
  const client  = new MultiClient(channel.port2)
  deepEqual(
    await client.sendManyMessages(),
    ['ok', 'msg4 ok', 'msg5 ok', ['msg6 ok', 'msg7 ok']]
  )
  channel.port1.close()
  console.log('Example 2 OK.')
})()
```
