import SecretNetworkAgent from './agent.js';
import SecretNetwork from './network.js';
import debug from 'debug';
import { assert } from 'chai';
import { Bip39 } from '@cosmjs/crypto';
import { EnigmaUtils, Secp256k1Pen } from 'secretjs';
const log = debug('out');

const context = {};

const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
const mnemonic1 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
const mnemonic2 = 'element dial search ticket feed lounge gasp wide uphold reflect hand lunch primary swamp wage vessel riot modify dinosaur laundry segment purpose secret asthma';
const keypair = EnigmaUtils.GenerateNewKeyPairFromSeed(Bip39.decode(mnemonic));

describe('SecretNetworkAgent', function () {
  before(async function beforeHook() {
    this.timeout(0);
    const pen = await Secp256k1Pen.fromMnemonic(mnemonic);
    context.pen = pen;

    // Does not require us to actually be connected
    const localnet = SecretNetwork.localnet();
    const { node, agent: admin, network } = await localnet.connect();
    await admin.nextBlock;

    const agent = await SecretNetworkAgent.create({
      mnemonic,
      network,
    });

    context.admin = admin;
    context.agent = agent;
    context.node = node;
    context.network = network;
  });

  after(async function () {
    this.timeout(0);
    await context.node.terminate();
  });

  it('can be created from a mnemonic', async function () {
    assert.strictEqual(context.agent.mnemonic, mnemonic);
  });

  it('can be created from a keypair', async function () {
    const keypairAgent = await SecretNetworkAgent.create({ keyPair: keypair, network: context.network });
    assert.strictEqual(JSON.stringify(context.agent.keyPair), JSON.stringify(keypairAgent.keyPiar));
  });

  it('can be created from a signing pen', async function () {
    const penAgent = await SecretNetworkAgent.create({ pen: context.pen, network: context.network });
    assert.strictEqual((await context.agent.API.signer('test')).signature, (await penAgent.API.signer('test')).signature);
  });

  it('can have a name', async function () {
    const namedAgent = await SecretNetworkAgent.create({ name: 'TEST', mnemonic, network: context.network });
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
    const agent1 = await SecretNetworkAgent.create({
      mnemonic1,
      network: context.network,
    });
    const agent2 = await SecretNetworkAgent.create({
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
