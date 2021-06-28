import SecretCLIAgent from "@fadroma/scrt-agent/agent-secretcli.js";
import SecretNetwork from "@fadroma/scrt-agent/network.js";
import SecretNetworkNode from "@fadroma/scrt-ops/localnet.js";
import { gas } from "@fadroma/scrt-agent/gas.js";

const fees = {
  upload: gas(20000000),
  init: gas(1000000),
  exec: gas(1000000),
  send: gas(500000),
};

/**
 * Function that takes an object and attaches testing parameters to it,
 * if no object is provided it will create one and return it.
 *
 * @param {any} [ctx]
 * @return {{
 *  ...ctx,
 *  admin: SecretCLIAgent,
 *  node: SecretNetworkNode,
 *  network: SecretNetwork,
 * }}
 */
export async function localnet(ctx = {}) {
  // Does not require us to actually be connected
  const localnet = SecretNetwork.localnet();
  const { node, agent: admin, network, builder } = await localnet.connect();
  await admin.nextBlock;
  admin.API.fees = fees;

  ctx.admin = admin;
  ctx.node = node;
  ctx.network = network;
  ctx.builder = builder;

  return ctx;
}
