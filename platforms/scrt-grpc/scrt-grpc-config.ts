import { ScrtConfig } from '@fadroma/scrt'

/** gRPC-specific Secret Network settings. */
export class ScrtGrpcConfig extends ScrtConfig {
  static defaultMainnetGrpcUrl: string = 'https://secret-4.api.trivium.network:9091'
  static defaultTestnetGrpcUrl: string = 'https://grpc.testnet.secretsaturn.net'

  scrtMainnetGrpcUrl: string|null
    = this.getString('SCRT_MAINNET_GRPC_URL',  ()=>ScrtGrpcConfig.defaultMainnetGrpcUrl)
  scrtTestnetGrpcUrl: string|null
    = this.getString('SCRT_TESTNET_GRPC_URL',  ()=>ScrtGrpcConfig.defaultTestnetGrpcUrl)
}
