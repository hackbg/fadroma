import { Scrt, ScrtAgentCLI, ScrtAgentJS, ScrtGas } from "./agent/index.js";
import { ScrtNode } from "./localnet/index.js";

const fees = {
  upload: ScrtGas.gas(20000000),
  init:   ScrtGas.gas(1000000),
  exec:   ScrtGas.gas(1000000),
  send:   ScrtGas.gas(500000),
};

/**
 * Function that takes an object and attaches testing parameters to it,
 * if no object is provided it will create one and return it.
 *
 * @param {any} [ctx]
 * @return {{
 *  ...ctx,
 *  admin: ScrtAgentCLI,
 *  node: ScrtNode,
 *  network: Scrt,
 * }}
 */
export async function localnet(ctx = {}) {
  // Does not require us to actually be connected
  const localnet = Scrt.localnet();
  const { node, agent: admin, network, builder } = await localnet.connect();
  await admin.nextBlock;
  admin.API.fees = fees;

  ctx.admin = admin;
  ctx.node = node;
  ctx.network = network;
  ctx.builder = builder;

  return ctx;
}
