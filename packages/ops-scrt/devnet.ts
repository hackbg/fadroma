import { config, DockerodeDevnet, DockerImage, resolve, dirname, fileURLToPath } from '@fadroma/ops'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function getScrtDevnet_1_3 () {
  return new DockerodeDevnet({
    image: new DockerImage(
      undefined,
      'enigmampc/secret-network-sw-dev:v1.3.0-beta.0'
    )
  })
}

export function getScrtDevnet_1_2 (
  managerURL: string = config.devnetManager,
  chainId?:   string,
) {
  if (managerURL) {
    throw new Error('unimplemented: managed devnets will be available in a future release of Fadroma')
    //return ManagedDevnet.getOrCreate(
      //managerURL, chainId, config.scrt.devnetChainIdPrefix
    //)
  } else {
    return new DockerodeDevnet({
      image: new DockerImage(
        undefined,
        "enigmampc/secret-network-sw-dev:v1.2.0",
      ),
      readyPhrase: "indexed block",
      initScript:  resolve(__dirname, 'devnet_1_2.sh')
    })
  }
}
