/** This file only exists to make TSC shut up. */
declare module '@hackbg/toolbox' {

  const timestamp:   Function
  const runCommands: Function & { default: Function }

  const randomHex:    (bytes?: number) => string
  const randomBase64: (bytes?: number) => string
  const randomBech32: (prefix?: string, bytes?: number) => string

  const decode: Function

  const cwd:           Function
  const fileURLToPath: Function
  const relative:      Function
  const resolve:       Function
  const basename:      Function
  const homedir:       Function
  const dirname:       Function
  const extname:       Function

  const mkdir:  Function
  const mkdirp: Function & { sync: Function }

  const readFile:  Function
  const writeFile: Function

  const readFileSync:  Function
  const existsSync:    Function
  const statSync:      Function
  const writeFileSync: Function
  const readlinkSync:  Function
  const unlinkSync:    Function
  const readdirSync:   Function

  const spawnSync:     Function

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

  export * from '@hackbg/konzola'
  export * from '@hackbg/kabinet'
  export * from '@hackbg/dokeres'
  export * from '@hackbg/runspec'
  export * from 'bech32'

}
