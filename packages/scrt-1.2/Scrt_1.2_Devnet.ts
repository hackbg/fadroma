import { config, DockerodeDevnet, DockerImage, resolve, dirname, fileURLToPath } from '@fadroma/ops'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function getScrtDevnet (
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
      initScript:  resolve(__dirname, 'Scrt_1_2_Node.sh')
    })
  }
}
