import { ok, equal, throws } from 'node:assert'
import { OCIConnection, OCIImage } from '@fadroma/oci'
import { Console } from '@fadroma/agent'
import * as Impl from './devnet-impl'

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
    initScriptMount:   ''
  }).containerImage instanceof OCIImage)

  equal(undefined, Impl.initImage({
    log:               new Console(),
    containerEngine:   undefined,
    containerImageTag: "foo",
    containerImage:    undefined,
    containerManifest: 'Dockerfile',
    initScriptMount:   ''
  }).containerImage)

  equal(undefined, Impl.initImage({
    log:               new Console(),
    containerEngine:   new OCIConnection(),
    containerImageTag: undefined,
    containerImage:    undefined,
    containerManifest: 'Dockerfile',
    initScriptMount:   ''
  }).containerImage)

  equal(Impl.initChainId({
    chainId:  'foo',
    platform: 'bar',
  }).chainId, 'foo')

  ok(Impl.initChainId({
    platform: 'bar',
  }).chainId.startsWith('local-bar-'))

  throws(()=>Impl.initChainId({}))

  ok(Impl.initLogger({
    log:     undefined,
    chainId: 'foo',
  }).log instanceof Console)

}
