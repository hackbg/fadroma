import type Dockerode from 'dockerode'

/** APIs from dockerode in use. */
export type DockerHandle = Pick<Dockerode,
  |'getImage'
  |'buildImage'
  |'listImages'
  |'getContainer'
  |'pull'
  |'createContainer'
  |'listContainers'
  |'run'
> & {
  modem: Pick<Dockerode["modem"],
    |'followProgress'>
}
