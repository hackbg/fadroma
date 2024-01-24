import { ok, equal, throws } from 'node:assert'
import { Core } from '@fadroma/agent'
import * as OCI from '@fadroma/oci'
import * as Impl from './devnet-impl'
import { DevnetContainerConfig } from './devnet-base'
const { Console } = Core

export default async () => {

  equal(Impl.initPort({ nodePortMode: 'http'    }).nodePort, 1317)
  equal(Impl.initPort({ nodePortMode: 'grpc'    }).nodePort, 9090)
  equal(Impl.initPort({ nodePortMode: 'grpcWeb' }).nodePort, 9091)
  equal(Impl.initPort({ nodePortMode: 'rpc'     }).nodePort, 26657)

  equal(Impl.initChainId({ chainId: 'foo', platform: 'bar' })
    .chainId, 'foo')
  ok(Impl.initChainId(new DevnetContainerConfig({ platformName: 'scrt', platformVersion: '0.0' }))
    .chainId.startsWith('dev-scrt_0.0-'))
  throws(()=>Impl.initChainId(new DevnetContainerConfig({})))

  ok(Impl.initLogger({ log: undefined, chainId: 'foo', })
    .log instanceof Console)
  throws(()=>Impl.initLogger({ log: undefined, chainId: 'foo' })
    .log = null)
  ok(Impl.initState(new DevnetContainerConfig({ chainId: 'foo' }), {})
    .stateRoot.absolute)
  ok(Impl.initState(new DevnetContainerConfig({ chainId: 'foo' }), {})
    .stateFile.absolute.endsWith('/foo/devnet.json'))
  ok(Impl.initState(new DevnetContainerConfig({ chainId: 'foo' }), {})
    .runFile.absolute.endsWith('/foo/devnet.run'))

  equal(Impl.initDynamicUrl({
    log:          new Console('initDynamicUrl'),
    nodeProtocol: 'https',
    nodeHost:     'localhost',
    nodePort:     '1234'
  }).url, 'https://localhost:1234/')

  await Impl.createDevnetContainer({
    log:             new Console('createDevnetContainer'),
    chainId:         'mock',
    stateRoot:        undefined,
    stateFile:       { save (_) {} },
    verbose:         undefined,
    initScript:      undefined,
    platformName:    undefined,
    platformVersion: undefined,
    genesisAccounts: undefined,
    onScriptExit:    undefined,
    container:       Object.assign(new OCI.Container({
      id:            'mock-create',
      engine:        OCI.Connection.mock(),
      image:         new OCI.Image({
        engine:      OCI.Connection.mock(),
        name:        'mock'
      }),
    }), {
      inspect: async () => {
        throw Object.assign(new Error(), {
          statusCode: 404
        })
      }
    }),
    // @ts-ignore
    runFile:         { delete () {} },
    // @ts-ignore
    stateDir:        {},
  })

  await Impl.startDevnetContainer({
    log:             new Console('startDevnetContainer'),
    platformName:    undefined,
    platformVersion: undefined,
    genesisAccounts: undefined,
    verbose:         undefined,
    running:         undefined,
    nodeHost:        undefined,
    waitString:      "mock-ready",
    waitMore:        0,
    waitPort:        () => new Promise(resolve=>setTimeout(resolve, 1)),
    created:         undefined,
    initScript:      undefined,
    stateRoot:        undefined,
    stateFile:       { save (_) {} },
    onScriptExit:    undefined,
    container:       Object.defineProperties(new OCI.Container({
      id:            'mock-start',
      engine:        OCI.Connection.mock(),
      image:         new OCI.Image({
        engine:      OCI.Connection.mock(),
        name:        'mock'
      }),
    }), {
      api: {
        get () {
          return {
            start: async () => {
            },
            inspect: async () => ({
            }),
            logs: async () => {
              return {
                off () {},
                on (event, callback) {
                  if (event === 'data') {
                    setTimeout(()=>{
                      callback('mock-ready')
                    }, 1)
                  }
                }
              }
            }
          }
        }
      }
    }),
    // @ts-ignore
    runFile:         { delete () {} },
  })

  await Impl.pauseDevnetContainer({
    log:        new Console('pauseDevnetContainer'),
    running:    undefined,
    container:  new OCI.Container({
      id:       'mock-pause',
      image:    Object.assign(new OCI.Image({
        engine: OCI.Connection.mock(),
        name:   'mock' 
      })),
    }),
    // @ts-ignore
    runFile:         { delete () {} },
  })

  await Impl.removeDevnetContainer({
    log:        new Console('removeDevnetContainer'),
    stateRoot:  undefined,
    paused:     undefined,
    container:  Object.defineProperties(new OCI.Container({
      id:       'mock-remove',
      engine:   OCI.Connection.mock(),
      image:    new OCI.Image({
        engine: OCI.Connection.mock(),
        name:   'mock'
      }),
    }), {
      api: {
        get () {
          return {
            remove: async () => {
            },
            wait: async () => {
            }
          }
        }
      }
    }),
  })

}
