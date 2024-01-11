import type { DockerHandle } from './oci-base'

/** A stub implementation of the Dockerode APIs used by @fadroma/oci. */
export function mockDockerode (callback: Function = () => {}): DockerHandle {
  return {
    //@ts-ignore
    getImage (_) {
      return { async inspect () { return } }
    },
    //@ts-ignore
    getContainer (options: any) {
      return mockDockerodeContainer(callback)
    },
    //@ts-ignore
    async pull (name: any, callback: any) {
      callback(null, null)
    },
    //@ts-ignore
    buildImage () {
    },
    //@ts-ignore
    async createContainer (options: any) {
      return mockDockerodeContainer(callback)
    },
    //@ts-ignore
    async run (...args: any): Promise<any> {
      callback({run:args})
      return [{Error:null,StatusCode:0},Symbol()]
    },
    modem: {
      followProgress (stream: any, complete: Function, callback: any) {
        complete(null, null)
      }
    }
  }
}

export function mockDockerodeContainer (callback: Function = () => {}) {
  return {
    id: 'mockmockmock',
    async logs (options: any, cb: Function) {
      if (cb) {
        cb(...(callback({ createContainer: options })||[null, mockStream()]))
      } else {
        return mockStream()
      }
    },
    async start   () {},
    async attach  () { return {setEncoding(){},pipe(){}} },
    async wait    () { return {Error:null,StatusCode:0}  },
    async inspect () {
      return {
        Image:' ',
        Name:null,
        Args:null,
        Path:null,
        State:{Running:null},
        NetworkSettings:{IPAddress:null}
      }
    }
  }
}

export function mockStream () {
  return { on: () => {} }
}
