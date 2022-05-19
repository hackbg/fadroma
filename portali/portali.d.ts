declare module '@hackbg/portali' {
  export function waitPort (port: number): Promise<void>
  export function freePort (): Promise<number>
}
