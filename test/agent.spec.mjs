import { Scrt, ScrtAgentJS, ScrtCLIAgent, } from '@fadroma/scrt';

import debug from 'debug';
const log = debug('out');

import { assert } from 'chai';
import { Bip39 } from '@cosmjs/crypto';
import { EnigmaUtils, Secp256k1Pen } from 'secretjs';
import { localnet } from './test_helper.js';

const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
const mnemonic1 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
const mnemonic2 = 'element dial search ticket feed lounge gasp wide uphold reflect hand lunch primary swamp wage vessel riot modify dinosaur laundry segment purpose secret asthma';
const keypair = EnigmaUtils.GenerateNewKeyPairFromSeed(Bip39.decode(mnemonic));

test(ScrtAgentJS)
test(ScrtCLIAgent)

function test (Agent) {
  describe(Agent.name, function () {
    before(async function () {
      this.timeout(0);
      await localnet(context);

      context.pen = await Secp256k1Pen.fromMnemonic(mnemonic);
      context.agent = await Agent.create({
        chain: context.chain,
        mnemonic,
        network: context.network,
      });

      // Testing the secretcli agent instance
      // context.agent = new ScrtCLIAgent({
      //   mnemonic,
      //   network: context.network,
      // });
    });

    after(async function () {
      this.timeout(0);
      await context.node.terminate();
    });

    it('can be created from a mnemonic', async function () {
      assert.strictEqual(context.agent.mnemonic, mnemonic);
    });

    it('can be created from a keypair', async function () {
      const keypairAgent = await Agent.create({ keyPair: keypair, network: context.network });
      assert.strictEqual(JSON.stringify(context.agent.keyPair), JSON.stringify(keypairAgent.keyPiar));
    });

    it('can be created from a signing pen', async function () {
      const penAgent = await Agent.create({ pen: context.pen, network: context.network });
      assert.strictEqual((await context.agent.API.signer('test')).signature, (await penAgent.API.signer('test')).signature);
    });

    it('can have a name', async function () {
      const namedAgent = await Agent.create({ name: 'TEST', mnemonic, network: context.network });
      assert.strictEqual(namedAgent.name, 'TEST');
      assert.strictEqual(context.agent.name, 'Anonymous');
    });

    it('can read chain state', async function () {
      this.timeout(0);
      await context.agent.nextBlock;
    });

    it('can read its own balance', async function () {
      const balance = await context.agent.balance;
      assert.strictEqual(balance, 0);
    });

    it('can send SCRT', async function () {
      this.timeout(120000);
      await context.admin.send(context.agent.address, 10000000000);
      const balance = await context.agent.balance;
      assert.strictEqual(balance, '10000000000');
    });

    it('can send SCRT to many addresses in one go', async function () {
      this.timeout(120000);
      const agent1 = await Agent.create({
        mnemonic1,
        network: context.network,
      });
      const agent2 = await Agent.create({
        mnemonic2,
        network: context.network,
      });

      await context.agent.sendMany([
        [agent1.address, '100'],
        [agent2.address, '100'],
      ]);

      const balance2 = await agent1.balance;
      assert.strictEqual(balance2, '100');

      const balance3 = await agent2.balance;
      assert.strictEqual(balance3, '100');
    });
  });
}

