# `@fadroma/ops/Deploy` test suite

```typescript
const DeploySpec = {}
const test = tests => Object.assign(DeploySpec, tests)
export default DeploySpec
```

## Deployment

```typescript
import { Deployment } from './Deploy'
import { tmp, rimraf, basename } from '@hackbg/toolbox'
test({
  'Deployment chainable methods' ({ equal, deepEqual }) {
    withTmpFile(f=>{
      const d = new Deployment(f)
      equal(d.prefix, basename(f))
      deepEqual(d.receipts, {})
      equal(d, d.save('test', 'test'))
      equal(d, d.set('foo'))
      equal(d, d.setMany({bar:{},baz:{}}))
    })
  },
  async 'Deployment#init' ({ equal, deepEqual }) {
    await withTmpFile(async f=>{
      const agent      = mockAgent()
      const deployment = new Deployment(f)
      const codeId     = 0
      const template   = { codeId }
      const initMsg    = Symbol()
      const name       = 'contract'
      const label      = `${basename(f)}/${name}`
      deepEqual(await deployment.init(agent, template, name, initMsg), { codeId, label })
      deepEqual(deployment.get(name), { name, codeId, label })
    })
  },
  async 'Deployment#initMany' ({ equal, deepEqual }) {
    await withTmpFile(async f=>{
      const agent      = mockAgent()
      const deployment = new Deployment(f)
      const codeId     = 1
      const template   = { codeId }
      const initMsg    = Symbol()
      const configs    = [['contract1', Symbol()], ['contract2', Symbol()]]
      const receipts   = await deployment.initMany(agent, template, configs)
      deepEqual(receipts, [
        { codeId, label: `${basename(f)}/contract1` },
        { codeId, label: `${basename(f)}/contract2` },
      ])
      deepEqual(deployment.get('contract1'), {
        name: 'contract1',
        label: `${basename(f)}/contract1`,
        codeId,
      })
      deepEqual(deployment.get('contract2'), {
        name: 'contract2',
        label: `${basename(f)}/contract2`,
        codeId,
      })
    })
  },
  async 'Deployment#initVarious' ({ equal, deepEqual }) {
    await withTmpFile(async f=>{
      const agent      = mockAgent()
      const deployment = new Deployment(f)
      const templateA  = { codeId: 2 }
      const templateB  = { codeId: 3 }
      const configs    = [[templateA, 'contractA', Symbol()], [templateB, 'contractB', Symbol()]]
      const receipts   = await deployment.initVarious(agent, configs)
      deepEqual(receipts, [
        { codeId: 2, label: `${basename(f)}/contractA`, },
        { codeId: 3, label: `${basename(f)}/contractB`, },
      ])
      deepEqual(deployment.get('contractA'), {
        name: 'contractA',
        label: `${basename(f)}/contractA`,
        codeId: 2
      })
      deepEqual(deployment.get('contractB'), {
        name: 'contractB',
        label: `${basename(f)}/contractB`,
        codeId: 3
      })
    })
  },

})

const mockAgent = () => ({
  instantiate ({ codeId }, label, msg) {
    return { codeId, label }
  },
  instantiateMany (configs, prefix) {
    const receipts = {}
    for (const [{codeId}, name] of configs) {
      let label = name
      if (prefix) label = `${prefix}/${label}`
      receipts[name] = { codeId, label }
    }
    return receipts
  }
})

const withTmpFile = fn => {
  const {name} = tmp.fileSync()
  try {
    return fn(name)
  } finally {
    rimraf(name)
  }
}
```

## Deployments directory

```typescript
import { Deployments } from './Deploy'
test({
  async 'Deployments' () {
    await withTmpDir(async dir=>{
      const d = new Deployments(dir)
      await d.create()
      await d.select()
      d.active
      d.get()
      d.list()
      d.save('test', 'test')
    })
  },
  async 'Deployments integrations' ({ equal }) {
    const prefixOfActiveDeployment = Symbol()
    const context = {
      chain: {
        deployments: {
          active: { prefix: prefixOfActiveDeployment, receipts: [] },
          printActive () {},
          list () { return [
            {prefix: '.active.yml'},
            {prefix: prefixOfActiveDeployment},
            {prefix:'somethingelse'}]
          },
          async create () {},
          async select () {}
        }
      }
    }
    await Deployments.new(context)
    const { deployment, prefix } = await Deployments.activate(context)
    equal(deployment, context.chain.deployments.active)
    equal(prefix,     context.chain.deployments.active.prefix)
    await Deployments.status(context)
    await Deployments.select(context)
  }
})

const withTmpDir = fn => {
  const {name} = tmp.dirSync()
  try {
    return fn(name)
  } finally {
    rimraf(name)
  }
}
```
