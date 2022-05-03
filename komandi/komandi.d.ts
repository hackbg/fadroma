declare module '@hackbg/komandi' {
  export type CommandPalette    = object
  export type CommandInvocation = string[]
  export type CommandUsage      = (commands: CommandPalette) => void
  export type RunCommands = <T>(
    commands: CommandPalette,
    words:    CommandInvocation,
    usage?:   CommandUsage
  ) => Promise<T>
  export default RunCommands
  export const runCommands: RunCommands
}
