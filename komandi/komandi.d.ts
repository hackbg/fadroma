declare module '@hackbg/komandi' {
  type Commands = object
  type Words    = string[]
  type Usage    = (command: Commands) => void
  type RunCommands = <T>(commands: Commands, words: Words, usage: Usage) => Promise<T>
  export default RunCommands
  export const runCommands: RunCommands
}
