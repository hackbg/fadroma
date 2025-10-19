import {
  BTCJS, Indexd, leveldown,
  spawn, service, env, arg, run, api, mount, middleware, get, post
} from './deps.ts';

export const regtester = ({
  daemon  = 'bitcoind',
  client  = 'bitcoin-cli',
  rpc     = 'http://localhost:18443',
  zmq     = 'tcp://127.0.0.1:30001',
  rpcwq   = 32,
  address = run(client, arg('-regtest'), arg('getnewaddress'), arg('""'), arg('bech32')),
  keyDb   = 'regtest.keys',
  indexDb = 'regtest.db',
  indexd  = new Indexd(leveldown(indexDb), rpc),
}) => service('Regtest',
  spawn(daemon, arg('-server'), arg('-regtest'), arg('-txindex'),
    arg(`-zmqpubhashtx=${zmq}`),
    arg(`-zmqpubhashblock=${zmq}`),
    arg(`-rpcworkqueue=${rpcwq}`)),
  run(client, arg('-regtest'), arg('createwallet'), arg('default')),
  run(client, arg('-regtest'), arg('generatetoaddress'), arg('432'), arg(address)),
  api(
    mount('1',
      mount('a',
        middleware((req, res, next) => {
          const { address } = req.params;
          let script;
          try {
            script = (!address.match(/^[0-9a-f]+$/i)) ? bitcoin.address.toOutputScript(address, NETWORK) : Buffer.from(address, 'hex')
            req.params.scId = bitcoin.crypto.sha256(script).toString('hex')
          } catch (e) { return res.easy(400) }
          next()
        }),
        get(':address/firstseen', req => indexd().firstSeenScriptId(req.params.scId)),
        get(':address/txs', req => indexd().transactionIdsByScriptRange(
          { scId: req.params.scId, heightRange: [0, 0xffffffff], mempool: true, },
          DBLIMIT, txIds => Promise.all(txIds.map(txId=>rpc('getrawtransaction', [txId]))))),
        get(':address/txids', req => indexd().transactionIdsByScriptRange(
          { scId: req.params.scId, heightRange: [0, 0xffffffff], mempool: true, },
          DBLIMIT)),
        get(':address/txos', req => indexd().txosByScriptRange(
          { scId: req.params.scId, heightRange: [0, 0xffffffff], mempool: true, },
          DBLIMIT)),
        get(':address/unspents', req => indexd().utxosByScriptRange(
          { scId: req.params.scId, heightRange: [0, 0xffffffff], mempool: true, },
          DBLIMIT)),
        get('alt/:address/unspents')),
      mount('t',
        get('mempool'),
        post('push',       middleware(bodyParser.text())),
        post('alt/pushtx', middleware(bodyParser.json())),
        middleware((req, res, next) => {if (!isHex64(req.params.id)) return res.easy(400); next()}),
        get(':id'),
        get(':id/json'),
        get(':id/block')),
      mount('b',
        get('b/best'),
        get('b/fees'),
        middleware((req, res, next) => {
          if (req.params.id === 'best') {
            return rpc('getbestblockhash', [], (err, id) => {
              if (err) return next(err)
              req.params.id = id
              next()
            })
          }
          next()
        }),
        middleware((req, res, next) => {if (!isHex64(req.params.id)) return res.easy(400); next()}),
        get('b/:id/header'),
        get('b/:id/height')),
      mount('r',
        middleware((req, res, next) => {
          if (!req.query.key) return res.easy(401)
          let hash = bitcoin.crypto.sha256(req.query.key).toString('hex')
          if (hash in AUTH_KEYS) return next()
          res.easy(401)
        }),
        post('r/generate'),
        post('r/faucet'),
        post('r/faucetScript')))));
