/** A stub implementation of the Dockerode APIs used by @fadroma/oci. */
export function mockDockerode (callback: Function = () => {}): DockerHandle {
  return {
    getImage () {
      return { async inspect () { return } }
    },
    getContainer (options: any) {
      return mockDockerodeContainer(callback)
    },
    async pull (name: any, callback: any) {
      callback(null, null)
    },
    buildImage () {},
    async createContainer (options: any) {
      return mockDockerodeContainer(callback)
    },
    async run (...args: any) {
      callback({run:args})
      return [{Error:null,StatusCode:0},Symbol()]
    },
    modem: {
      followProgress (stream: any, complete: Function, callback: any) { complete(null, null) }
    }
  }
}

export function mockDockerodeContainer (callback: Function = () => {}) {
  return {
    id: 'mockmockmock',
    logs (options: any, cb: Function) {
      cb(...(callback({ createContainer: options })||[null, mockStream()]))
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
