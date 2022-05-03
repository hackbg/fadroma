declare module '@hackbg/toolbox' {
  const timestamp:       (d?: Date) => string
  const randomHex:       (bytes?: number) => string
  const randomBase64:    (bytes?: number) => string
  const randomBech32:    (prefix?: string, bytes?: number) => string
  const decode:           Function
  const backOff:          Function
  const freePort:         Function
  const waitPort:         Function
  const waitUntilLogsSay: Function
  const cargo:            Function
  const loadJSON:         Function
  export { execFile, execFileSync, spawn, spawnSync } from 'child_process'
}

// GOTCHA! Adding an `export` to a `declare module` unexports everything else

declare module '@hackbg/toolbox' {

  export * from '@hackbg/konzola'
  export * from '@hackbg/kabinet'
  export * from '@hackbg/komandi'
  export * from '@hackbg/dokeres'
  export * from '@hackbg/runspec'
  export * from 'bech32'

}
