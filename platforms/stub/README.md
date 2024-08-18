Example (stub) implementation of a Fadroma chain adapter.

<!-- @hackbg/docs: begin -->

# class *StubBlock*
The building block of a blockchain, as obtained by
[the `fetchBlock` method of `Connection`](#method-connectionfetchblock)

Contains zero or more transactions.

<pre>
<strong>const</strong> stubBlock = new StubBlock(properties: Partial&lt;Block&gt;)
</pre>

<table><tbody>
<tr><td valign="top">
<strong>chain</strong></td>
<td><strong>Connection</strong>. Connection to the chain to which this block belongs.</td></tr>
<tr><td valign="top">
<strong>hash</strong></td>
<td><strong>string</strong>. Content-dependent ID of block.</td></tr>
<tr><td valign="top">
<strong>height</strong></td>
<td><strong>number</strong>. Monotonically incrementing ID of block.</td></tr></tbody></table>

## method [*stubBlock.fetchTransactions*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L702)
<pre>
<strong>const</strong> result: <em><a href="#">Transaction</a>[]</em> = <strong>await</strong> stubBlock.fetchTransactions()
</pre>
<pre>
<strong>const</strong> result: <em>Record&lt;string, Transaction&gt;</em> = <strong>await</strong> stubBlock.fetchTransactions(options: {
  byId,
})
</pre>

## method [*stubBlock.getTransactionsById*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L18)
<pre>
<strong>const</strong> result: <em>Record&lt;string, Transaction&gt;</em> = <strong>await</strong> stubBlock.getTransactionsById()
</pre>

## method [*stubBlock.getTransactionsInOrder*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L21)
<pre>
<strong>const</strong> result: <em><a href="#">Transaction</a>[]</em> = <strong>await</strong> stubBlock.getTransactionsInOrder()
</pre>

# class *StubConnection*
Represents a connection to a blockchain via a given endpoint.
* Use one of its subclasses in `@fadroma/scrt`, `@fadroma/cw`, `@fadroma/namada`
to connect to the corresponding chain.
* Or, extend this class to implement
support for new kinds of blockchains.

<pre>
<strong>const</strong> stubConnection = new StubConnection({
  alive,
  api,
  backend,
  blockInterval,
  chainId,
  log,
  mode,
  url,
  gasToken,
})
</pre>

<table><tbody>
<tr><td valign="top">
<strong>alive</strong></td>
<td><strong>boolean</strong>. Setting this to false stops retries.</td></tr>
<tr><td valign="top">
<strong>api</strong></td>
<td><strong>unknown</strong>. Instance of platform SDK. This must be provided in a subclass.

Since most chain SDKs initialize asynchronously, this is usually a `Promise`
that resolves to an instance of the underlying client class (e.g. `CosmWasmClient` or `SecretNetworkClient`).

Since transaction and query methods are always asynchronous as well, well-behaved
implementations of Fadroma Agent begin each method that talks to the chain with
e.g. `const { api } = await this.api`, making sure an initialized platform SDK instance
is available.</td></tr>
<tr><td valign="top">
<strong>backend</strong></td>
<td><strong>StubBackend</strong>. </td></tr>
<tr><td valign="top">
<strong>blockInterval</strong></td>
<td><strong>number</strong>. Time to ping for next block.</td></tr>
<tr><td valign="top">
<strong>chainId</strong></td>
<td><strong>string</strong>. Chain ID. This is a string that uniquely identifies a chain.
A project's mainnet and testnet have different chain IDs.</td></tr>
<tr><td valign="top">
<strong>log</strong></td>
<td><strong>Console</strong>. </td></tr>
<tr><td valign="top">
<strong>mode</strong></td>
<td><strong>undefined</strong>. Chain mode.</td></tr>
<tr><td valign="top">
<strong>url</strong></td>
<td><strong>string</strong>. Connection URL.

The same chain may be accessible via different endpoints, so
this property contains the URL to which requests are sent.</td></tr>
<tr><td valign="top">
<strong>gasToken</strong></td>
<td><strong>NativeToken</strong>. Native token of chain.</td></tr>
<tr><td valign="top">
<strong>defaultDenom</strong></td>
<td></td></tr>
<tr><td valign="top">
<strong>height</strong></td>
<td></td></tr>
<tr><td valign="top">
<strong>nextBlock</strong></td>
<td></td></tr></tbody></table>

## method [*stubConnection.authenticate*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L95)
<pre>
<strong>const</strong> result: <em><a href="#">StubAgent</a></em> = stubConnection.authenticate(identity: Identity)
</pre>

## method [*stubConnection.batch*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L36)
Construct a transaction batch.
<pre>
<strong>const</strong> result: <em><a href="#">Batch&lt;StubConnection, StubAgent&gt;</a></em> = stubConnection.batch()
</pre>

## method [*stubConnection.fetchBalance*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L261)
Fetch balance of 1 or many addresses in 1 or many native tokens.
<pre>
<strong>const</strong> result: <em>string</em> = <strong>await</strong> stubConnection.fetchBalance(
  address: <em>string</em>,
  token: <em>string</em>,
)
</pre>
<pre>
<strong>const</strong> result: <em>Record&lt;string, string&gt;</em> = <strong>await</strong> stubConnection.fetchBalance(
  address: <em>string</em>,
  tokens: <em>string</em>,
)
</pre>
<pre>
<strong>const</strong> result: <em>Record&lt;string, string&gt;</em> = <strong>await</strong> stubConnection.fetchBalance(
  addresses: <em>string</em>,
  token: <em>string</em>,
)
</pre>
<pre>
<strong>const</strong> result: <em>Record&lt;string, Record&gt;</em> = <strong>await</strong> stubConnection.fetchBalance(
  addresses: <em>string</em>,
  tokens: <em>string</em>,
)
</pre>

## method [*stubConnection.fetchBlock*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L213)
Get info about the latest block.
<pre>
<strong>const</strong> result: <em><a href="#">Block</a></em> = <strong>await</strong> stubConnection.fetchBlock()
</pre>
Get info about the block with a specific height.
<pre>
<strong>const</strong> result: <em><a href="#">Block</a></em> = <strong>await</strong> stubConnection.fetchBlock({
  height,
})
</pre>
Get info about the block with a specific hash.
<pre>
<strong>const</strong> result: <em><a href="#">Block</a></em> = <strong>await</strong> stubConnection.fetchBlock({
  hash,
})
</pre>

## method [*stubConnection.fetchCodeInfo*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L339)
Fetch info about all code IDs uploaded to the chain.
<pre>
<strong>const</strong> result: <em>Record&lt;string, unknown&gt;</em> = <strong>await</strong> stubConnection.fetchCodeInfo()
</pre>
Fetch info about a single code ID.
<pre>
<strong>const</strong> result: <em>unknown</em> = <strong>await</strong> stubConnection.fetchCodeInfo(id: string)
</pre>
Fetch info about multiple code IDs.
<pre>
<strong>const</strong> result: <em>Record&lt;string, unknown&gt;</em> = <strong>await</strong> stubConnection.fetchCodeInfo(ids: Iterable&lt;string&gt;)
</pre>

## method [*stubConnection.fetchCodeInstances*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L432)
Fetch all instances of a code ID.
<pre>
<strong>const</strong> result: <em>Record&lt;string, Contract&gt;</em> = <strong>await</strong> stubConnection.fetchCodeInstances(id: string)
</pre>
Fetch all instances of a code ID, with custom client class.
<pre>
<strong>const</strong> result: <em>Record&lt;string, InstanceType&gt;</em> = <strong>await</strong> stubConnection.fetchCodeInstances(
  $C: <em>C</em>,
  id: <em>string</em>,
)
</pre>
Fetch all instances of multple code IDs.
<pre>
<strong>const</strong> result: <em>Record&lt;string, Record&gt;</em> = <strong>await</strong> stubConnection.fetchCodeInstances(ids: Iterable&lt;string&gt;)
</pre>
Fetch all instances of multple code IDs, with custom client class.
<pre>
<strong>const</strong> result: <em>Record&lt;string, Record&gt;</em> = <strong>await</strong> stubConnection.fetchCodeInstances(
  $C: <em>C</em>,
  ids: <em>Iterable&lt;string&gt;</em>,
)
</pre>
Fetch all instances of multple code IDs, with multiple custom client classes.
<pre>
<strong>const</strong> result: <em>Record&lt;string, &gt;</em> = <strong>await</strong> stubConnection.fetchCodeInstances(ids: ???)
</pre>

## method [*stubConnection.fetchContractInfo*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L383)
<pre>
<strong>const</strong> result: <em>unknown</em> = <strong>await</strong> stubConnection.fetchContractInfo(address: string)
</pre>
<pre>
<strong>const</strong> result: <em>Record&lt;string, unknown&gt;</em> = <strong>await</strong> stubConnection.fetchContractInfo(addresses: string)
</pre>

## method [*stubConnection.getContract*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L415)
Get a client handle for a specific smart contract, authenticated as as this agent.
<pre>
<strong>const</strong> result: <em><a href="#">Contract</a></em> = stubConnection.getContract(options: string | {
  address,
})
</pre>

## method [*stubConnection.query*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L242)
Query a contract.
<pre>
<strong>const</strong> result: <em>Q</em> = <strong>await</strong> stubConnection.query(
  contract: <em>string</em>,
  message: <em>Message</em>,
)
</pre>
<pre>
<strong>const</strong> result: <em>Q</em> = <strong>await</strong> stubConnection.query(
  contract: <em>{
    address,
  }</em>,
  message: <em>Message</em>,
)
</pre>

## method [*stubConnection.gas*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L122)
Native token of chain.
<pre>
<strong>const</strong> result: <em><a href="#">TokenAmount</a></em> = stubConnection.gas(amount: string | number)
</pre>

# class *StubAgent*
<pre>
<strong>const</strong> stubAgent = new StubAgent(properties: Partial&lt;Agent&gt;)
</pre>

<table><tbody>
<tr><td valign="top">
<strong>connection</strong></td>
<td><strong>StubConnection</strong>. </td></tr>
<tr><td valign="top">
<strong>fees</strong></td>
<td><strong>undefined</strong>. Default transaction fees.</td></tr>
<tr><td valign="top">
<strong>identity</strong></td>
<td><strong>Identity</strong>. </td></tr>
<tr><td valign="top">
<strong>log</strong></td>
<td><strong>Console</strong>. </td></tr>
<tr><td valign="top">
<strong>address</strong></td>
<td></td></tr></tbody></table>

## method [*stubAgent.execute*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L656)
Call a given program's transaction method.
<pre>
<strong>const</strong> result: <em>unknown</em> = <strong>await</strong> stubAgent.execute(
  contract: <em>string | Partial&lt;ContractInstance&gt;</em>,
  message: <em>Message</em>,
  options: <em>{
    execFee,
    execMemo,
    execSend,
  }</em>,
)
</pre>

## method [*stubAgent.fetchBalance*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L522)
<pre>
<strong>const</strong> result: <em>void</em> = <strong>await</strong> stubAgent.fetchBalance(tokens: string | string)
</pre>

## method [*stubAgent.instantiate*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L612)
Instantiate a new program from a code id, label and init message.
<pre>
stubAgent.instantiate(
  contract: <em>string | Partial&lt;UploadedCode&gt;</em>,
  options: <em>Partial&lt;ContractInstance&gt;</em>,
)
</pre>

## method [*stubAgent.send*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L527)
Send native tokens to 1 recipient.
<pre>
<strong>const</strong> result: <em>unknown</em> = <strong>await</strong> stubAgent.send(
  recipient: <em>string | {
    address,
  }</em>,
  amounts: <em>ICoin | TokenAmount</em>,
  options: <em>{
    sendFee,
    sendMemo,
  }</em>,
)
</pre>

## method [*stubAgent.upload*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/chain.ts#L557)
Upload a contract's code, generating a new code id/hash pair.
<pre>
stubAgent.upload(
  code: <em>string | Uint8Array | URL | Partial&lt;CompiledCode&gt;</em>,
  options: <em>{
    reupload,
    uploadFee,
    uploadMemo,
    uploadStore,
  }</em>,
)
</pre>

# class *StubBackend*
Provides control over the service backing an [`Endpoint`](#abstract-class-endpoint), such as:

  * Local devnet RPC endpoint.
  * Stub/mock implementation of chain.

You shouldn't need to instantiate this class directly.
Instead, see `Connection`, `Devnet`, and their subclasses.

<pre>
<strong>const</strong> stubBackend = new StubBackend(properties: Partial&lt;&gt;)
</pre>

<table><tbody>
<tr><td valign="top">
<strong>accounts</strong></td>
<td><strong>Map</strong>. </td></tr>
<tr><td valign="top">
<strong>alive</strong></td>
<td><strong>boolean</strong>. </td></tr>
<tr><td valign="top">
<strong>balances</strong></td>
<td><strong>Map</strong>. </td></tr>
<tr><td valign="top">
<strong>chainId</strong></td>
<td><strong>string</strong>. The chain ID that will be passed to the devnet node.</td></tr>
<tr><td valign="top">
<strong>gasToken</strong></td>
<td><strong>NativeToken</strong>. Denomination of base gas token for this chain.</td></tr>
<tr><td valign="top">
<strong>instances</strong></td>
<td><strong>Map</strong>. </td></tr>
<tr><td valign="top">
<strong>lastCodeId</strong></td>
<td><strong>number</strong>. </td></tr>
<tr><td valign="top">
<strong>log</strong></td>
<td><strong>Console</strong>. </td></tr>
<tr><td valign="top">
<strong>prefix</strong></td>
<td><strong>string</strong>. </td></tr>
<tr><td valign="top">
<strong>uploads</strong></td>
<td><strong>Map</strong>. </td></tr>
<tr><td valign="top">
<strong>url</strong></td>
<td><strong>string</strong>. </td></tr></tbody></table>

## method [*stubBackend.connect*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L208)
<pre>
<strong>const</strong> result: <em><a href="#">Connection</a></em> = <strong>await</strong> stubBackend.connect()
</pre>
<pre>
<strong>const</strong> result: <em><a href="#">Agent</a></em> = <strong>await</strong> stubBackend.connect(parameter: string | Partial&lt;&gt;)
</pre>

## method [*stubBackend.execute*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L277)
<pre>
<strong>const</strong> result: <em>unknown</em> = <strong>await</strong> stubBackend.execute(args: unknown)
</pre>

## method [*stubBackend.export*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L248)
<pre>
<strong>const</strong> result: <em>unknown</em> = <strong>await</strong> stubBackend.export(args: unknown)
</pre>

## method [*stubBackend.getIdentity*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L227)
<pre>
<strong>const</strong> result: <em><a href="#">Identity</a></em> = <strong>await</strong> stubBackend.getIdentity(name: string)
</pre>

## method [*stubBackend.import*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L244)
<pre>
<strong>const</strong> result: <em>unknown</em> = <strong>await</strong> stubBackend.import(args: unknown)
</pre>

## method [*stubBackend.instantiate*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L262)
<pre>
stubBackend.instantiate(
  creator: <em>string</em>,
  codeId: <em>string</em>,
  options: <em>unknown</em>,
)
</pre>

## method [*stubBackend.pause*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L239)
<pre>
<strong>const</strong> result: <em><a href="#">StubBackend</a></em> = <strong>await</strong> stubBackend.pause()
</pre>

## method [*stubBackend.start*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L234)
<pre>
<strong>const</strong> result: <em><a href="#">StubBackend</a></em> = <strong>await</strong> stubBackend.start()
</pre>

## method [*stubBackend.upload*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L252)
<pre>
stubBackend.upload(codeData: Uint8Array)
</pre>

# class *StubBatch*
Builder object for batched transactions.

<pre>
<strong>const</strong> stubBatch = new StubBatch(properties: Partial&lt;Batch&gt;)
</pre>

<table><tbody>
<tr><td valign="top">
<strong>connection</strong></td>
<td><strong>StubConnection</strong>. </td></tr>
<tr><td valign="top">
<strong>log</strong></td>
<td><strong>Console</strong>. </td></tr>
<tr><td valign="top">
<strong>messages</strong></td>
<td><strong>undefined</strong>. </td></tr></tbody></table>

## method [*stubBatch.execute*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L295)
Add an execute message to the batch.
<pre>
<strong>const</strong> result: <em><a href="#">StubBatch</a></em> = stubBatch.execute(args: [(string | Partial&lt;ContractInstance&gt;), Message, {
  execFee,
  execMemo,
  execSend,
}])
</pre>

## method [*stubBatch.instantiate*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L290)
Add an instantiate message to the batch.
<pre>
<strong>const</strong> result: <em><a href="#">StubBatch</a></em> = stubBatch.instantiate(args: [(string | Partial&lt;UploadedCode&gt;), Partial&lt;ContractInstance&gt;])
</pre>

## method [*stubBatch.submit*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L300)
Submit the batch.
<pre>
<strong>const</strong> result: <em>object</em> = <strong>await</strong> stubBatch.submit()
</pre>

## method [*stubBatch.upload*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L285)
Add an upload message to the batch.
<pre>
<strong>const</strong> result: <em><a href="#">StubBatch</a></em> = stubBatch.upload(args: [(string | Uint8Array | URL | Partial&lt;CompiledCode&gt;), {
  reupload,
  uploadFee,
  uploadMemo,
  uploadStore,
}])
</pre>

# class *StubCompiler*
A compiler that does nothing. Used for testing.

<pre>
<strong>const</strong> stubCompiler = new StubCompiler(properties: Partial&lt;Logged&gt;)
</pre>

<table><tbody>
<tr><td valign="top">
<strong>caching</strong></td>
<td><strong>boolean</strong>. Whether to enable build caching.
When set to false, this compiler will rebuild even when
binary and checksum are both present in wasm/ directory</td></tr>
<tr><td valign="top">
<strong>id</strong></td>
<td><strong>string</strong>. Unique identifier of this compiler implementation.</td></tr>
<tr><td valign="top">
<strong>log</strong></td>
<td><strong>Console</strong>. </td></tr></tbody></table>

## method [*stubCompiler.build*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/stub.ts#L316)
Compile a source.
`@hackbg/fadroma` implements dockerized and non-dockerized
variants using its `build.impl.mjs` script.
<pre>
<strong>const</strong> result: <em><a href="#">CompiledCode</a></em> = <strong>await</strong> stubCompiler.build(
  source: <em>string | Partial&lt;SourceCode&gt;</em>,
  ...args: <em>any</em>,
)
</pre>

## method [*stubCompiler.buildMany*](https://github.com/hackbg/fadroma/tree/v2/packages/agent/program.browser.ts#L27)
Build multiple sources.
Default implementation of buildMany is sequential.
Compiler classes may override this to optimize.
<pre>
<strong>const</strong> result: <em><a href="#">CompiledCode</a>[]</em> = <strong>await</strong> stubCompiler.buildMany(inputs: Partial&lt;SourceCode&gt;[])
</pre>
<!-- @hackbg/docs: end -->
