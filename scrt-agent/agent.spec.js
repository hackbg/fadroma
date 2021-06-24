import SecretNetworkAgent from './agent.js';
import SecretNetwork from './network.js';
import debug from 'debug';
import { assert } from 'chai';
import { Bip39 } from '@cosmjs/crypto';
import { EnigmaUtils, Secp256k1Pen } from 'secretjs';
const log = debug('out');

const context = {};

const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
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

  it('can send SCRT', async function () { });

  it('can send SCRT to many addresses in one go', async function () { });

  it('can interact with contracts', async function () { });

  it('can deploy contracts', async function () {});
});
