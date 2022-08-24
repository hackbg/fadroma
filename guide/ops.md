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
import Fadroma from '@hackbg/fadroma'
const console = Fadroma.Console('MyDeploy')
export default new Fadroma.DeployCommands('deploy')
  .command('deploy', 'deploy an instance of my-contract', deployMyContract)
  .command('status', 'print status of deployed contract', statusOfContract)

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
The `commands.command(...)` method returns `commands`, so it supports chaining.
:::

:::info
Don't forget to `export default commands`, otherwise Fadroma will not be able to find the commands.
:::

## Deployment context

### How deployments are stored

The **deployment receipt system** keeps track of the addresses, code ids, code hashes, and other
info about the smart contracts that you deployed, in the form of files under
`receipts/$CHAIN_ID/$DEPLOYMENT.yml`.

* `context.deployments: Deployments`: list of all deployments for the current project and chain.
* `context.deployment: Deployment`: handle to currently selected deployment.


:::info
It is recommended to keep receipts for mainnet and testnet in your VCS
in order to keep track of the contracts that you deploy to public networks.
:::

:::info
The deployments system prefixes all contract labels with the name of the deployment.
This is because labels are expected to be both meaningful and globally unique.
So if you `name` your contracts `ALICE` and `BOB`, and your deployment is called `20220706`,
the on-chain labels of the contracts will be `20220706/ALICE` and `20220706/BOB`.
:::

:::info
The timestamp here corresponds to the moment the deployment was created, and not the moment
when a particular contract was deployed. You can get the latter by looking at `initTx` in the
deployment receipt, and querying that transaction in the transaction explorer.
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
`init` can be either an init message, or a function returning an init message.
This is useful when there is extra preparation needed when deploying a contract,
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
can be expressed as classes, inheriting from `Fadroma.DeployTask<Promise<Result>>`.

:::warning
This API is a work in progress.
* Wrapper function `deployGroup` is necessary to preserve naming in final operation report
* `this.subtask(()=>this.context.contract)` should become just `this.contract()`
* same for `template`
:::

```typescript
interface MyContractGroup {
  contract1:  Client
  contract2:  Client
}
export default new FadromaCommands('deploy')
  .command('group', 'run DeployMyContractGroup', deployGroup)
async function deployGroup (context): Promise<MyContractGroup> {
  return await new DeployMyContractGroup(context)
})
class DeployMyContractGroup extends Fadroma.DeployTask<Promise<MyContractGroup>> {
  constructor (context, args = context.cmdArgs) {
    super(context, async function deployMyContract () {
      return {
        contract1: await this.contract1,
        contract2: await this.contract2,
      }
    }
  }
  contract1 = this.subtask(async getOrDeployContract1 () {
    return this.context.contract('Contract1').getOrDeploy('contract-1', {})
  })
  contract2 = this.subtask(async getOrDeployContract2 () {
    const contract1 = await this.contract1
    return this.context.contract('Contract2')
      .getOrDeploy('contract-2', {
        dependencies: [
          { address: contract1.address, code_hash: contract1.codeHash }
        ]
      })
  })
}
```
