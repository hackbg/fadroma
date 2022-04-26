declare module '@hackbg/dokeres' {

  class Docker {
    constructor (object)
    modem: any
    run?:            Function
    getContainer:    Function
    createContainer: Function
    getImage:        Function
    pull:            Function
  }

  class DockerImage {
    name: string
    constructor (_1: Docker|undefined, _2: string, _3?: string, _4?: string[])
    build  (...args: any[]): void
    check  (...args: any[]): void
    ensure (...args: any[]): void
    follow (...args: any[]): void
    pull   (...args: any[]): void
  }

  function waitUntilLogsSay (container: any, expected: any, thenDetach: any): any

}
