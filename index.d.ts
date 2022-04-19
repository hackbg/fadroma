/** This file only exists to make TSC shut up. */
declare module '@hackbg/toolbox' {
  const Console: (string) => {
    constructor (string)
    log (...args: any)
    info (...args: any)
    warn (...args: any)
    error (...args: any)
    debug (...args: any)
    trace (...args: any)
  }
  const bold:             (string)=>string
  const colors:           Record<string, Function>
  const timestamp:        Function
  const fileURLToPath:    Function
  const relative:         Function
  const resolve:          Function
  const runCommands:      Function & { default: Function }
  const randomHex:        Function
  const decode:           Function
  const readFileSync:     Function
  const cwd:              Function
  const basename:         Function
  const spawnSync:        Function
  const execFile:         Function
  const existsSync:       Function
  const homedir:          Function
  const dirname:          Function
  const backOff:          Function
  const extname:          Function
  const statSync:         Function
  const writeFileSync:    Function
  const readlinkSync:     Function
  const unlinkSync:       Function
  const mkdirp:           Function & { sync: Function }
  const readdirSync:      Function
  const freePort:         Function
  const waitPort:         Function
  const waitUntilLogsSay: Function
  const cargo:            Function
  const loadJSON:         Function
  const readFile:         Function
  const writeFile:        Function
  const mkdir:            Function
  const Path:             any
  class Directory {
    constructor (_: string)
    path:    string
    make:    Function
    subdir:  Function
    resolve: Function
    load:    Function
    save   (_1: any, _2: any)
    exists (): boolean
    delete ()
  }
  class JSONDirectory extends Directory {}
  class File {
    make: Function
    path: string
    exists (): boolean
    load (): any
    save (_1: any): any
  }
  class JSONFile extends File {
    constructor (_1: string, _2: string)
  }
  class Docker {
    constructor (object)
    run?: Function
    getContainer: Function
    createContainer: Function
    getImage: Function
    pull: Function
    modem: any
  }
  class DockerImage {
    constructor (_1: Docker|undefined, _2: string, _3?: string, _4?: string[])
    name: string
    ensure: Function
  }
}
