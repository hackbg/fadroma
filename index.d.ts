/** This file only exists to make TSC shut up. */

declare module '@hackbg/toolbox' {

  const Console: (string) => {
    constructor (string)
    log   (...args: any)
    info  (...args: any)
    warn  (...args: any)
    error (...args: any)
    debug (...args: any)
    trace (...args: any)
  }

  const bold:        (string)=>string
  const colors:      Record<string, Function>
  const timestamp:   Function
  const runCommands: Function & { default: Function }

  const randomHex:    (bytes?: number) => string
  const randomBase64: (bytes?: number) => string
  const randomBase32: (chars?: number) => string

  const decode: Function

  const cwd:           Function
  const fileURLToPath: Function
  const relative:      Function
  const resolve:       Function
  const basename:      Function
  const homedir:       Function
  const dirname:       Function
  const extname:       Function

  const readFileSync:  Function
  const spawnSync:     Function
  const existsSync:    Function
  const statSync:      Function
  const writeFileSync: Function
  const readlinkSync:  Function
  const unlinkSync:    Function
  const readdirSync:   Function

  const mkdir:  Function
  const mkdirp: Function & { sync: Function }

  const readFile:  Function
  const writeFile: Function

  const execFile:         Function
  const backOff:          Function
  const freePort:         Function
  const waitPort:         Function
  const waitUntilLogsSay: Function
  const cargo:            Function
  const loadJSON:         Function

}

// GOTCHA! Adding an `export` to a `declare module` unexports everything else

declare module '@hackbg/toolbox' {

  export * from '@hackbg/kabinet'
  export * from '@hackbg/dokeres'
  export * from 'bech32'

}
