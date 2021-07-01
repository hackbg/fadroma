import { SecretNetworkContract, SecretNetworkContractWithSchema } from "@fadroma/scrt-agent";
import { loadSchemas } from "@fadroma/utilities";
import { localnet } from './helper.js';
import path from "path";
import debug from 'debug';
import { assert } from "chai";
const log = debug('out');

export const schema = loadSchemas(import.meta.url, {
  queryMsg: "./contract/schema/q.json",
  handleMsg: "./contract/schema/t_x.json",
});

const context = {};

class Votes extends SecretNetworkContractWithSchema {
  constructor(options = {}) {
    super(options, schema);
  }
}

describe('SecretNetworkContract', function () {
  before(async function () {
    this.timeout(0);
    await localnet(context);

    const { codeId } = await context.builder.uploadCached(path.resolve("./test/contract/artifacts/votes@HEAD.wasm"));

    context.contract = await context.admin.instantiate(new Votes({
      label: `test-contract-${parseInt(Math.random() * 100000)}`,
      codeId: codeId,
      initMsg: {options: ["a", "b"]},
    }));

    context.checkResults = async (a = 0, b = 0) => {
      const status = await context.contract.query('status', {});
      const votes = status.results.votes;

      assert.strictEqual(votes[0][0], 'a');
      assert.strictEqual(votes[0][1], a);
      assert.strictEqual(votes[1][0], 'b');
      assert.strictEqual(votes[1][1], b);
    };
  });

  after(async function () {
    this.timeout(0);
    await context.node.terminate();
  });

  it('can be instantiated by an agent from a codeid', async function () {
    this.timeout(120000);
    await context.checkResults();
  });

  it('can call its methods', async function () {
    this.timeout(120000);
    await context.contract.execute('vote', { option: 'a' });
    await context.checkResults(1, 0);
  });

  it('knows its own methods if provided with a schema', async function () {
    const q = Object.keys(context.contract.q).join(",");
    const tx = Object.keys(context.contract.tx).join(",");

    assert.strictEqual(q, "status");
    assert.strictEqual(tx, "vote");
   });
});
