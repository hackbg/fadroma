import { ok, equal, throws } from 'node:assert'
import { OCIConnection, OCIImage, OCIContainer, Mock } from '@fadroma/oci'
import { Core } from '@fadroma/agent'
import * as Impl from './devnet-impl'
const { Console } = Core

export default async () => {

  equal(Impl.initPort({ nodePortMode: 'http'    }).nodePort, 1317)
  equal(Impl.initPort({ nodePortMode: 'grpc'    }).nodePort, 9090)
  equal(Impl.initPort({ nodePortMode: 'grpcWeb' }).nodePort, 9091)
  equal(Impl.initPort({ nodePortMode: 'rpc'     }).nodePort, 26657)
  equal(Impl.initChainId({ chainId: 'foo', platform: 'bar' }).chainId, 'foo')
  ok(Impl.initChainId({ platform: 'bar' }).chainId.startsWith('local-bar-'))

  throws(()=>Impl.initChainId({}))

  ok(Impl.initLogger({ log: undefined, chainId: 'foo', }).log instanceof Console)
  throws(()=>Impl.initLogger({ log: undefined, chainId: 'foo' }).log = null)

  ok(Impl.initState({
    chainId:  'foo',
    stateDir:  undefined,
    stateFile: undefined,
  }, {}).stateDir.absolute.endsWith('foo'))

  ok(Impl.initState({
    chainId:  'foo',
    stateDir:  undefined,
    stateFile: undefined,
  }, {}).stateFile.absolute.endsWith('foo/devnet.json'))

  equal(Impl.initDynamicUrl({
    log:          new Console('initDynamicUrl'),
    nodeProtocol: 'https',
    nodeHost:     'localhost',
    nodePort:     '1234'
  }).url, 'https://localhost:1234/')

  //const devnet = Impl.initContainerState({
    //container:       undefined,
    //genesisAccounts: {},
    //initScript:      $(''),
    //log:             new Console(),
    //nodeHost:        undefined,
    //running:         false,
    //stateDir:        undefined,
    //verbose:         true,
    //readyString:     undefined,
    ////@ts-ignore
    //waitPort:        ()=>{},
    ////@ts-ignore
    //save:            ()=>{},
  //})

  //await devnet.started
  //await devnet.deleted

  await Impl.createDevnetContainer({
    log:             new Console('createDevnetContainer'),
    chainId:         'mock',
    stateDir:        undefined,
    stateFile:       { save (_) {} },
    verbose:         undefined,
    initScript:      undefined,
    platformName:    undefined,
    platformVersion: undefined,
    genesisAccounts: undefined,
    container:       Object.assign(new OCIContainer({
      id:            'mock-create',
      image:         new OCIImage({
        engine:      OCIConnection.mock(),
        name:        'mock'
      }),
    }), {
      inspect: async () => {
        throw Object.assign(new Error(), {
          statusCode: 404
        })
      }
    }),
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
    stateDir:        undefined,
    stateFile:       { save (_) {} },
    container:       Object.defineProperties(new OCIContainer({
      id:            'mock-start',
      image:         new OCIImage({
        engine:      OCIConnection.mock(),
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
  })

  await Impl.pauseDevnetContainer({
    log:        new Console('pauseDevnetContainer'),
    running:    undefined,
    container:  new OCIContainer({
      id:       'mock-pause',
      image:    Object.assign(new OCIImage({
        engine: OCIConnection.mock(),
        name:   'mock' 
      })),
    }),
  })

  await Impl.deleteDevnetContainer({
    log:        new Console('deleteDevnetContainer'),
    stateDir:   undefined,
    paused:     undefined,
    container:  Object.defineProperties(new OCIContainer({
      id:       'mock-delete',
      image:    new OCIImage({
        engine: OCIConnection.mock(),
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
