import { ok, equal, throws } from 'node:assert'
import { OCIConnection, OCIImage, OCIContainer } from '@fadroma/oci'
import { Core } from '@fadroma/agent'
import * as Impl from './devnet-impl'
import $ from '@hackbg/file'
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
  }, {}).stateDir.path.endsWith('foo'))

  ok(Impl.initState({
    chainId:  'foo',
    stateDir:  undefined,
    stateFile: undefined,
  }, {}).stateFile.path.endsWith('foo/devnet.json'))

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
    verbose:         undefined,
    initScript:      undefined,
    onExit:          undefined,
    paused:          undefined,
    deleted:         undefined,
    genesisAccounts: undefined,
    container:       new OCIContainer({
      image:         new OCIImage({ engine: OCIConnection.mock(), name: 'mock' }),
    }),
  })

  await Impl.startDevnetContainer({
    log:        new Console('startDevnetContainer'),
    running:    undefined,
    nodeHost:   undefined,
    waitString: undefined,
    waitMore:   undefined,
    waitPort:   undefined,
    created:    undefined,
    container:  new OCIContainer({
      image:    new OCIImage({
        engine: OCIConnection.mock(),
        name:   'mock'
      }),
    }),
    stateFile:  {
      save (_) {}
    },
  })

  await Impl.pauseDevnetContainer({
    log:        new Console('pauseDevnetContainer'),
    running:    undefined,
    container:  new OCIContainer({
      image:    new OCIImage({
        engine: OCIConnection.mock(),
        name:   'mock' 
      }),
    }),
  })

  await Impl.deleteDevnetContainer({
    log:       new Console('deleteDevnetContainer'),
    stateDir:  undefined,
    paused:    undefined,
    container: new OCIContainer({
      image:   new OCIImage({ engine: OCIConnection.mock(), name: 'mock' }),
    }),
  })

}
