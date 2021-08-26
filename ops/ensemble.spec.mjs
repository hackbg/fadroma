import assert from "assert";
import { resolve, existsSync, BaseEnsemble } from "../ops/index.ts";

describe("Secret Network Ensemble", function () {

  class TestEnsemble extends BaseEnsemble {
    buildImage = ''
    contracts = { TEST: { crate: "votes" } };
    async initialize () { return {} } }

  let e;
  
  beforeEach(function () {
    e = new TestEnsemble(/*{
      network:   'localnet',
      workspace: resolve('./'),
      builder:   { async build(..._: Array<any>) { return '' } } as any
    }*/); });

  it("has a list of commands", function () {
    assert(e.commands() instanceof Array);
    assert(e.localCommands() instanceof Array);
    assert(e.remoteCommands() instanceof Array); });

  it("has a local build command", async function () {
    this.timeout(0);
    assert(e.localCommands().map((x) => x[0]).indexOf("build") > -1);
    await e.build(); });

  it("has a remote deploy command", async function () {
    this.timeout(0);
    const workspace = resolve('example');
    assert(e.remoteCommands().map((x) => x[0]).indexOf("deploy") > -1);
    const additionalBinds = [
      `${resolve('core')}:/core:rw`,
      `${resolve('scrt')}:/scrt:rw`,
      `${resolve('scrt-addr')}:/scrt-addr:rw`,
      `${resolve('scrt-admin')}:/scrt-admin:rw`,
      `${resolve('scrt-callback')}:/scrt-callback:rw`,
      `${resolve('scrt-contract')}:/scrt-contract:rw`,
      `${resolve('scrt-migrate')}:/scrt-migrate:rw`,
      `${resolve('scrt-storage')}:/scrt-storage:rw`,
      `${resolve('scrt-utils')}:/scrt-utils:rw` ]
    await e.deploy({ workspace, additionalBinds })
    const builtContract = resolve(workspace, 'artifacts', 'votes@HEAD.wasm');
    assert.strictEqual(existsSync(builtContract), true);
  });
});
