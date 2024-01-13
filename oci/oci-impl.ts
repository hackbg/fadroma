import Docker from 'dockerode'
import type { OCIContainer } from './oci'
import { OCIError } from './oci-base'
import { bold, Console } from '@fadroma/agent'

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

/* Is this equivalent to follow() and, if so, which implementation to keep? */
export function waitStream (
  stream:     { on: Function, off: Function, destroy: Function },
  expected:   string,
  thenDetach: boolean = true,
  trail:      (data: string) => unknown = ()=>{},
  console:    Console = new Console()
): Promise<void> {

  return new Promise((resolve, reject)=>{

    try {
      stream.on('error', waitStream_onError)
      stream.on('data', waitStream_onData)
    } catch (e) {
      waitStream_onError(e)
    }

    function waitStream_onError (error: any) {
      console.error(`Stream error:`, error)
      reject(error)
      stream.off('error', waitStream_onError)
      stream.off('data', waitStream_onData)
      //stream.destroy()
    }

    function waitStream_onData (data: any) {
      try {
        //console.log("wat")
        const dataStr = String(data).trim()
        if (trail) {
          trail(dataStr)
        }
        if (dataStr.indexOf(expected) > -1) {
          console.log(`Found expected message:`, bold(expected))
          stream.off('data', waitStream_onData)
          if (thenDetach) {
            stream.destroy()
          }
          resolve()
        }
      } catch (e) {
        waitStream_onError(e)
      }
    }

  })

}
