import SecretCLIAgent from "@fadroma/scrt-agent/agent-secretcli.js";
import SecretNetwork from "@fadroma/scrt-agent/network.js";
import SecretNetworkNode from "@fadroma/scrt-ops/localnet.js";

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
  const { node, agent: admin, network } = await localnet.connect();
  await admin.nextBlock;

  ctx.admin = admin;
  ctx.node = node;
  ctx.network = network;

  return ctx;
}
