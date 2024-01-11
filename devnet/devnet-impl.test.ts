import { ok, equal, throws } from 'node:assert'
import { OCIConnection, OCIImage } from '@fadroma/oci'
import { Console } from '@fadroma/agent'
import * as Impl from './devnet-impl'
import $ from '@hackbg/file'

export default async () => {

  equal(Impl.initPort({ nodePortMode: 'http'    }).nodePort, 1317)
  equal(Impl.initPort({ nodePortMode: 'grpc'    }).nodePort, 9090)
  equal(Impl.initPort({ nodePortMode: 'grpcWeb' }).nodePort, 9091)
  equal(Impl.initPort({ nodePortMode: 'rpc'     }).nodePort, 26657)

  ok(Impl.initImage({
    log:               new Console(),
    containerEngine:   new OCIConnection(),
    containerImageTag: "foo",
    containerImage:    undefined,
    containerManifest: 'Dockerfile',
  }).containerImage instanceof OCIImage)

  equal(undefined, Impl.initImage({
    log:               new Console(),
    containerEngine:   undefined,
    containerImageTag: "foo",
    containerImage:    undefined,
    containerManifest: 'Dockerfile',
  }).containerImage)

  equal(undefined, Impl.initImage({
    log:               new Console(),
    containerEngine:   new OCIConnection(),
    containerImageTag: undefined,
    containerImage:    undefined,
    containerManifest: 'Dockerfile',
  }).containerImage)

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
    log:          new Console(),
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
  })

  await Impl.startDevnetContainer({
  })

  await Impl.pauseDevnetContainer({
  })

  await Impl.deleteDevnetContainer({
  })

}
