import assert from "assert";
import Ensemble from "@fadroma/scrt-ops/ensemble.js";
import path from "path";

describe("Secret Network Ensemble", function () {
  let e;
  class TestEnsemble extends Ensemble {
    contracts = { TEST: { crate: "votes" } };
    docker = {
      async getImage() {
        //console.debug('mock getImage')
        return {
          async inspect() {
            //console.debug('mock inspect')
          },
        };
      },
    };

    async initialize () {
      return 1
    }
  }
  
  beforeEach(function () {
    e = new TestEnsemble({
      network: 'localnet',
      workspace: path.resolve('./test/assets/contract'),
      builder: {
        async build(...args) {
          //console.debug('mock Builder.build', ...args)
        },
      },
    });
  });

  it("has a list of commands", function () {
    assert(e.commands instanceof Array);
    assert(e.localCommands instanceof Array);
    assert(e.remoteCommands instanceof Array);
  });

  it("has a local build command", async function () {
    this.timeout(0);
    assert(e.localCommands.map((x) => x[0]).indexOf("build") > -1);
    await e.build();
  });

  it("has a remote deploy command", async function () {
    this.timeout(0);
    assert(e.remoteCommands.map((x) => x[0]).indexOf("deploy") > -1);
    await e.deploy({workspace: path.resolve('./test/assets/contract')});
  });
});
