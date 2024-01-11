import Docker from 'dockerode'
import type { OCIContainer } from './oci'
import { OCIError } from './oci-base'

export function toDockerodeOptions (container: OCIContainer): Docker.ContainerCreateOptions {

  const {
    name,
    image,
    entrypoint,
    command,
    options: {
      remove   = false,
      env      = {},
      exposed  = [],
      mapped   = {},
      readonly = {},
      writable = {},
      extra    = {},
      cwd
    }
  } = container

  if (!image) {
    throw new OCIError("Missing container image.")
  }

  const config = {
    name:         name,
    Image:        image.name,
    Entrypoint:   entrypoint,
    Cmd:          command,
    Env:          Object.entries(env).map(([key, val])=>`${key}=${val}`),
    WorkingDir:   cwd,
    ExposedPorts: {} as Record<string, {}>,
    HostConfig: {
      Binds: [] as Array<string>,
      PortBindings: {} as Record<string, Array<{ HostPort: string }>>,
      AutoRemove: remove
    }
  }

  exposed.forEach(containerPort=>config.ExposedPorts[containerPort] = {})

  Object.entries(mapped).forEach(([containerPort, hostPort])=>
      config.HostConfig.PortBindings[containerPort] = [{ HostPort: hostPort }])

  Object.entries(readonly).forEach(([hostPath, containerPath])=>
      config.HostConfig.Binds.push(`${hostPath}:${containerPath}:ro`))

  Object.entries(writable).forEach(([hostPath, containerPath])=>
      config.HostConfig.Binds.push(`${hostPath}:${containerPath}:rw`))

  return Object.assign(config, JSON.parse(JSON.stringify(extra)))

}
