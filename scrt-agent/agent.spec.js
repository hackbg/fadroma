import SecretNetworkAgent from './agent.js';
import SecretNetwork from './network.js';
import debug from 'debug';
import { assert } from 'chai';
import { Bip39 } from '@cosmjs/crypto';
import { EnigmaUtils, Secp256k1Pen } from 'secretjs';
const log = debug('out');
let network;
let agent;
let pen;

const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
const keypair = EnigmaUtils.GenerateNewKeyPairFromSeed(Bip39.decode(mnemonic));

describe('SecretNetworkAgent', async function () {
  before(async function () {
    pen = await Secp256k1Pen.fromMnemonic(mnemonic);
    // Does not require us to actually be connected
    network = SecretNetwork.testnet();
    agent = await SecretNetworkAgent.create({
      mnemonic,
      network,
    });
  });

  it('can be created from a mnemonic', async function () {
    assert.strictEqual(agent.mnemonic, mnemonic);
  });

  it('can be created from a keypair', async function () {
    const keypairAgent = await SecretNetworkAgent.create({ keyPair: keypair, network });
    assert.strictEqual(JSON.stringify(agent.keyPair), JSON.stringify(keypairAgent.keyPiar));
  });

  it('can be created from a signing pen', async function () {
    const penAgent = await SecretNetworkAgent.create({ pen, network });
    assert.strictEqual((await agent.API.signer('test')).signature, (await penAgent.API.signer('test')).signature);
  });

  it('can have a name', async function () {
    const namedAgent = await SecretNetworkAgent.create({ name: 'TEST', mnemonic, network });
    assert.strictEqual(namedAgent.name, 'TEST');
    assert.strictEqual(agent.name, 'Anonymous');
  });

  it('can read chain state', async function () { });

  it('can read its own balance', async function () { });

  it('can send SCRT', async function () { });

  it('can send SCRT to many addresses in one go', async function () { });

  it('can interact with contracts', async function () { });

  it('can deploy contracts', async function () {});
});
