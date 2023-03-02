import { EnvConfig } from '@hackbg/conf'
import { Engine, Docker, Podman } from '@hackbg/dock'
import type { DevnetPlatform } from './devnet-base'
import { DockerDevnet } from './devnet-docker'

/** Gets devnet settings from environment. */
export class DevnetConfig extends EnvConfig {

  /** Whether to use Podman instead of Docker to run the devnet container. */
  podman: boolean = this.getBoolean('FADROMA_DEVNET_PODMAN', () =>
    this.getBoolean('FADROMA_PODMAN', ()=>false))

  /** URL to the devnet manager endpoint, if used. */
  manager: string|null = this.getString('FADROMA_DEVNET_MANAGER', ()=>null)

  /** Whether to remove the devnet after the command ends. */
  ephemeral: boolean = this.getBoolean('FADROMA_DEVNET_EPHEMERAL', ()=>false)

  /** Chain id for devnet .*/
  chainId: string = this.getString('FADROMA_DEVNET_CHAIN_ID', ()=>"fadroma-devnet")

  /** Host for devnet. */
  host: string|null = this.getString('FADROMA_DEVNET_HOST', ()=>null)

  /** Port for devnet. */
  port: string|null = this.getString('FADROMA_DEVNET_PORT', ()=>null)

  getContainerEngine (): Engine {
    if (this.podman) {
      return new Docker.Engine()
    } else {
      return new Podman.Engine()
    }
  }

  getDevnetContainer (kind: DevnetPlatform, chainId?: string) {
    return DockerDevnet.getOrCreate(kind, this.getContainerEngine())
  }

}
