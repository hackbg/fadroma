import { Chain, Agent, Bundle } from '@fadroma/agent'
import assert from 'node:assert'

let chain: Chain = Chain.mocknet()
let agent: Agent = await chain.getAgent({ address: 'testing1agent0' })
let bundle: Bundle

class TestBundle extends Bundle {
  async submit () { return 'submitted' }
  async save   () { return 'saved' }
}

assert.equal(await new TestBundle(agent, async bundle=>{
  assert(bundle instanceof TestBundle)
}).run(), 'submitted')

assert.equal(await new TestBundle(agent, async bundle=>{
  assert(bundle instanceof TestBundle)
}).save(), 'saved')

bundle = new TestBundle(agent)
assert.deepEqual(bundle.msgs, [])
assert.equal(bundle.id, 0)
assert.throws(()=>bundle.assertMessages())

bundle.add({})
assert.deepEqual(bundle.msgs, [{}])
assert.equal(bundle.id, 1)
assert.ok(bundle.assertMessages())

bundle = new TestBundle(agent)
assert.equal(await bundle.run(""),       "submitted")
assert.equal(await bundle.run("", true), "saved")
assert.equal(bundle.depth, 0)

bundle = bundle.bundle()
assert.equal(bundle.depth, 1)
assert.equal(await bundle.run(), null)

agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
bundle = agent.bundle()
assert(bundle instanceof Bundle)

agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
//await agent.instantiateMany(new Contract(), [])
//await agent.instantiateMany(new Contract(), [], 'prefix')

// Make sure each error subclass can be created with no arguments:
import { Error } from '@fadroma/agent'
for (const subtype of [
  'Unimplemented',

  'UploadFailed',

  'InitFailed',

  'CantInit_NoName',
  'CantInit_NoAgent',
  'CantInit_NoCodeId',
  'CantInit_NoLabel',
  'CantInit_NoMessage',

  'BalanceNoAddress',
  'DeployManyFailed',
  'DifferentHashes',

  'EmptyBundle',

  'ExpectedAddress',
  'ExpectedAgent',

  'InvalidLabel',
  'InvalidMessage',

  'LinkNoAddress',
  'LinkNoCodeHash',
  'LinkNoTarget',

  'NameOutsideDevnet',

  'NoAgent',
  'NoArtifact',
  'NoArtifactURL',
  'NoBuilder',
  'NoBuilderNamed',
  'NoBundleAgent',
  'NoChain',
  'NoChainId',
  'NoCodeHash',
  'NoContext',
  'NoCrate',
  'NoCreator',
  'NoDeployment',
  'NoName',
  'NoPredicate',
  'NoSource',
  'NoTemplate',
  'NoUploader',
  'NoUploaderAgent',
  'NoUploaderNamed',
  'NoVersion',

  'NotFound',
  'NotInBundle',

  'ProvideBuilder',
  'ProvideUploader',

  'Unpopulated',
  'ValidationFailed'
]) {
  assert(new Error[subtype]() instanceof Error, `error ${subtype}`)
}

// Make sure each log message can be created with no arguments:
import { Console } from '@fadroma/agent'
const log = new Console()

log.object()
log.object({foo:'bar',baz(){},quux:[],xyzzy:undefined,fubar:{}})

log.deployment()
log.deployment({ state: { foo: {}, bar: {} } })
log.receipt()
log.foundDeployedContract()
log.beforeDeploy()
log.afterDeploy()
log.deployFailed()
log.deployManyFailed()
log.deployFailedContract()
log.confirmCodeHash()
log.waitingForNextBlock()

log.warnUrlOverride()
log.warnIdOverride()
log.warnNodeNonDevnet()
log.warnNoAgent()
log.warnNoAddress()
log.warnNoCodeHash()
log.warnNoCodeHashProvided()
log.warnCodeHashMismatch()
log.warnEmptyBundle()
