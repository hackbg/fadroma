import { localnet } from "./helper.js";
const context = {};

describe('SecretNetworkNode', function () {
  before(async function () {
    this.timeout(0);

    await localnet(context);
  })
  after(async function () {
    this.timeout(0);
    await context.node.terminate();
  })
  it('can respawn', async function () {
    this.timeout(0);
    await context.node.respawn()
  })
})
