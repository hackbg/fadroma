declare module '@hackbg/toolbox' {
  export const timestamp:       (d?: Date) => string
  export const randomHex:       (bytes?: number) => string
  export const randomBase64:    (bytes?: number) => string
  export const randomBech32:    (prefix?: string, bytes?: number) => string
  export const decode:           Function
  export const backOff:          Function
  export const freePort:         Function
  export const waitPort:         Function
  export const waitUntilLogsSay: Function
  export const cargo:            Function
  export const loadJSON:         Function
  export { execFile, execFileSync, spawn, spawnSync } from 'child_process'
  export * from '@hackbg/konzola'
  export * from '@hackbg/kabinet'
  export * from '@hackbg/komandi'
  export * from '@hackbg/dokeres'
  export * from '@hackbg/runspec'
  export * from 'bech32'
  // GOTCHA! Adding an `export` to a `declare module` unexports everything else
}

declare module '@hackbg/konzola' {
  export * from '@hackbg/konzola'
}

//declare module '@hackbg/kabinet' {
  //export * from '@hackbg/kabinet'
//}

declare module '@hackbg/komandi' {
  export * from '@hackbg/komandi'
}

//declare module '@hackbg/dokeres' {
  //export * from '@hackbg/dokeres'
//}

declare module '@hackbg/runspec' {
  export * from '@hackbg/runspec'
}
