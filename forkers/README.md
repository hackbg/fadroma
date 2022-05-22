---
literate: typescript
---

# Forkers 👷🍴🥩

Isomorphic Web Workers via `MessageChannel` and `MessagePort`.

Implements a simple request/response mechanism using an auto-incrementing index.

## Simple example

```typescript
import { equal, deepEqual } from 'assert'
import { Client, Backend, isWorker } from './forkers'

enum ExampleOp {
  Msg1,
  Msg2,
  Msg3
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

const channel = new MessageChannel()
const backend = new ExampleBackend(channel.port1)
const client  = new ExampleClient(channel.port2)

client.sendMsg1().then(async result=>{
  equal(
    result,
    'ok'
  )
  deepEqual(
    await client.sendMsg2and3('foo', 2, 2),
    ['passed string: foo', 4]
  )
  channel.port1.close()
  console.log('Example 1 done.')
})
```
