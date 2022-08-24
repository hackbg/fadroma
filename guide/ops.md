# Deploying and configuring smart contracts with Fadroma Ops

The following is a guide to understanding and using the smart contract
deployment system, Fadroma Ops.

## Example: deploying a contract

* `project/package.json`:

```json
{
  "devDependencies": {
    "fadroma": "^1.0.0"
  }
}
```

* `project/ops.ts`:

```typescript
#!/usr/bin/env fadroma-deploy
import Fadroma from '@hackbg/fadroma'

export default new Fadroma.DeployCommands('deploy')
  .command('deploy', 'deploy an instance of my-contract', deployMyContract)
  .command('status', 'print status of deployed contract', statusOfContract)

const console = Fadroma.Console('MyDeploy')

async function deployMyContract (context) {
  console.info('Deploying...')
  await context.contract('MyContract').deploy('my-contract')
}

async function statusOfContract (context) {
  console.info('Querying status...')
  const contract = await context.contract('MyContract').get('Deploy the contract first.').populate()
  console.debug(contract)
}
/** add more commands here */
```

* run with `npx fadroma <SCRIPT> <COMMAND> <ARGUMENTS>`

```shell
npx fadroma ops.ts deploy
npx fadroma ops.ts status
```

* or add to `package.json` scripts to run with e.g. `npm run ops`:

```json
{
  "scripts": {
    "ops": "fadroma ops.ts"
  }
}
```

:::info
### TypeScript

Fadroma will use [Ganesha](https://github.com/hackbg/ganesha) to compile
deployment scripts on each run. You can use TypeScript seamlessly in your
deploy procedures.
:::

## How to define commands

The **Commands#command(name, info, ...steps)** method declares commands.

  * **name** is the string used to invoke the command from the shell
  * **info** is a short help description
  * **...steps** is one or more synchronous or asynchronous functions that constitute the command.

**Steps** are run sequentially. The first argument to each step is a `context: DeployContext`.
If a step returns an `Object`, the object's entries are added to the `context` for subsequent
steps.

:::info
### Commands

* The `commands.command(...)` method returns `commands`, so it supports chaining.
* Don't forget to `export default commands`, otherwise Fadroma will not be able to find the commands.
* Fadroma uses [`@hackbg/komandi`](https://github.com/hackbg/toolbox/blob/main/komandi/komandi.ts)
  to parse commands. This is a simple and loose command parser which does not support flags.
  Arguments to a command are available in `context.cmdArgs` so you can define your own flags.
:::

## How to deploy contracts

The `context.contract(name, Client?)` method, which returns a `ContractSlot` - a placeholder
representing a contract that might or might not already be deployed. You can optionally specify
a custom `Client` class used to interact with the deployed contract.

  * `await context.contract(name, Client?).getOrDeploy(source, init)` is the most handy method
    of `ContractSlot`: if a contract is found by `name` in the current deployment, it returns that;
    otherwise, it deploys `source` with the specified `init` message and auto-generated label.
  * `await context.contract(name, Client?).deploy(source, init)` deploys a contract from `source`
    with the specified `init` msg and an auto-generated label; but if a contract with the same
    label already exists on the chain, the call will fail.
  * `context.contract(name, Client?).get(message)` looks up a contract by `name` in the current
    deployment; if the contract is not found in the deployment, `message` is thrown.

:::info
### Receipts

The **deployment receipt system** keeps track of the addresses, code ids, code hashes, and other
info about the smart contracts that you deployed, in the form of files under
`receipts/$CHAIN_ID/$DEPLOYMENT.yml`.

Besides `context.contract.get()` and `.getOrDeploy()`, you can access it directly via:
* `context.deployment: Deployment`: handle to currently selected deployment.
* `context.deployments: Deployments`: deployment directory for current project and chain,
  listing other deployments.

The deployments system prefixes all contract labels with the name of the deployment.
This is because labels are expected to be both meaningful and globally unique.

* So if you `name` your contracts `ALICE` and `BOB`, and your deployment is called `20220706`,
  the on-chain labels of the contracts will be `20220706/ALICE` and `20220706/BOB`.

* The timestamp here corresponds to the moment the deployment was created, and not the moment
  when a particular contract was deployed. You can get the latter by looking at `initTx` in the
  deployment receipt, and querying that transaction in the transaction explorer.

* We recommend that you keep receipts of your primary mainnet and testnet deployments in your
  VCS system, in order to keep track of your project's footprint on public networks.
:::

:::info
`init` can be either an init message, or a function returning an init message.

This is useful when there is [extra preparation](#templates-and-factories) needed when deploying a contract,
but you don't want to repeat those steps if the contract is already deployed.
:::

## Templates and factories

Sometimes you want to upload a contract to the chain, but not instantiate it. For example,
one of your contracts serves a factory and deploys new instances of another contract.
Fadroma calls a contract in that state (deployed, but not instantiated) a `Template`.
It doesn't have an `address`, just an `id` and `codeHash` that can be used to instantiate it.

You can use the `context.template(source)` method to get a `TemplateSlot` representing a
template; similar to `ContractSlot`, its methods are `get(message)`, `async upload()` and
`async getOrUpload()`.

### Example: deploying a factory contract with a template

The following function only deploys the factory context if it's not already deployed,
and uploads its template only if needed.

```typescript
async function idempotentlyDeployFactoryAndTemplate (context) {
  await context.contract('Factory').getOrDeploy('factory', () => {
    const { id, codeHash } = await context.template('product').getOrUpload()
    return { id, code_hash: codeHash }
  })
}
```

## Deploying in bulk

Sometimes it is useful to deploy multiple contracts in a single transaction.

* `context.contracts(Client?).deployMany(source, inits: [name, init][])`
  deploys multiple instances of the same `source`, each with a different `name` and `init`.
* `context.templates([template1, template2]).uploadMany()` uploads multiple different templates,
  as in the case when a factory contract is able to instantiate multiple different contracts.

## Class-based deployments

More complex deployments (such as that of a whole subsystem consisting of multiple contracts)
can be expressed as classes, by inheriting from `Fadroma.DeployTask`.

The semantics of class-based deployments approach a declarative workflow: by using `this.subtask`
to wrap the individual stages of the deployment and awaiting the result of the deployment in the
main function defined in the constructor, the structure of the deployment procedure becomes a
directed acyclic graph.

In other words:
* Subtasks only execute when `await`ed.
* Subtasks can `await` each other to define inter-contract dependencies as well as dependencies on
  other data sources.
* Instances of `DeployTask` can also be `await`ed, returning an object the ultimate result of the
  deployment.

Here's an example script containing one class-based deployment procedure:

```typescript
#!/usr/bin/env fadroma-deploy
import Fadroma from '@hackbg/fadroma'
export default new FadromaCommands('deploy')
  .command('group', 'deploy multiple interdependent contracts', DeployPair.run)

class DeployPair extends DeployTask<Promise<[Fadroma.Client, Fadroma.Client]>> {
  constructor (context, ...args) {
    super(context, async () => [await this.contract1, await this.contract2])
  }
  contract1 = this.contract('Contract1').getOrDeploy('contract-1', {})
  contract2 = this.contract('Contract2').getOrDeploy('contract-2', async () => ({
    dependency: (await this.contract1).asLink
  }))
}
```

:::warning
This API is a work in progress.
* Wrapper function `deployGroup` is necessary to preserve naming in final operation report
* `this.subtask(()=>this.context.contract)` should become just `this.contract()`; same for template
:::
