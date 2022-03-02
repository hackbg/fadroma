import { devnet } from "./test_helper.js";
import { ScrtBuilder } from "../ops/index.ts";
import { assert } from "chai";
import debug from "debug";
import path from "path";

const log = debug("out");
const context = {};

const workspace = path.resolve("example");
const crate = "votes";

describe("SecretNetworkBuilder", function () {
  before(async function () {
    this.timeout(0);
    await devnet(context);
  });

  after(async function () {
    this.timeout(0);
    await context.node.terminate();
  });

  it("can be created from a connection", async function () {
    const builder = new SecretNetworkBuilder({ network: context.network });

    assert.strictEqual(builder.address, context.admin.address);
  });

  it("can be created from an agent", async function () {
    const builder = new SecretNetworkBuilder({ agent: context.admin });

    assert.strictEqual(builder.address, context.admin.address);
  });

  it("can build a contract", async function () {
    this.timeout(0);
    const builder = new SecretNetworkBuilder({ network: context.network });

    const wasmPath = await builder.build({ workspace, crate, additionalBinds: [
      `${path.resolve('core')}:/core:rw`,
      `${path.resolve('scrt')}:/scrt:rw`,
      `${path.resolve('scrt-addr')}:/scrt-addr:rw`,
      `${path.resolve('scrt-admin')}:/scrt-admin:rw`,
      `${path.resolve('scrt-callback')}:/scrt-callback:rw`,
      `${path.resolve('scrt-contract')}:/scrt-contract:rw`,
      `${path.resolve('scrt-migrate')}:/scrt-migrate:rw`,
      `${path.resolve('scrt-storage')}:/scrt-storage:rw`,
      `${path.resolve('scrt-utils')}:/scrt-utils:rw`,
    ]  });

    assert.strictEqual(
      wasmPath,
      path.resolve(workspace, "artifacts", `${crate}@HEAD.wasm`)
    );
  });

  it("can upload a contract", async function () {
    this.timeout(0);
    const artifact = path.resolve(workspace, "artifacts", `${crate}@HEAD.wasm`);
    const builder = new SecretNetworkBuilder({ network: context.network });

    const { codeId } = await builder.upload(artifact);

    assert.strictEqual(codeId, 1);
  });
});
