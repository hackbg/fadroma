import { Scrt, ScrtCLIAgent, ScrtAgentJS, ScrtGas } from "./index.ts";
import { ScrtNode } from "./localnet.ts";

const fees = {
  upload: new ScrtGas(20000000),
  init:   new ScrtGas(1000000),
  exec:   new ScrtGas(1000000),
  send:   new ScrtGas(500000),
};

/**
 * Function that takes an object and attaches testing parameters to it,
 * if no object is provided it will create one and return it.
 *
 * @param {any} [ctx]
 * @return {{
 *  ...ctx,
 *  admin: ScrtCLIAgent,
 *  node: ScrtNode,
 *  network: Scrt,
 * }}
 */
export async function localnet(ctx = {}) {

  // Does not require us to actually be connected
  const chain = Scrt.localnet({chainId: 'test-localnet'});
  await chain.node.respawn()
  ctx.chain   = chain
  ctx.node    = chain.node
  ctx.admin   = await chain.getAgent(ctx.node.genesisAccount('ALICE'))
  ctx.builder = await chain.getBuilder(ctx.admin)
  return ctx

  console.log({localnet})
  const admin = await localnet.getAgent()
  const builder = await localnet.getBuilder()
  process.exit(1234)
  //const { node, agent: admin, network, builder } = await localnet.connect();
  //await admin.nextBlock;
  //admin.API.fees = fees;

  //ctx.admin = admin;
  //ctx.node = chain.node;
  //ctx.network = network;
  //ctx.builder = builder;

  //return ctx;

}
