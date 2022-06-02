export type CommandPalette = object
export type CommandInvocation = string[]
export type CommandUsage = (commands: CommandPalette, words: CommandInvocation) => void

module.exports             = runCommands
module.exports.default     = runCommands
module.exports.runCommands = runCommands

/** Run a command from a command palette */
async function runCommands (
  /** The collection of defined commands */
  commands: CommandPalette    = {},
  /** The list of strings specifying the command and arguments. */
  words:    CommandInvocation = [],
  /** Default command to run if no command matches the words. */
  catchall: CommandUsage = function printUsage (
    commands: CommandPalette    = {},
    words:    CommandInvocation = []
  ) {
    console.log(`\nAvailable commands:`)
    for (const key of Object.keys(commands)) {
      console.log(`  ${key}`)
    }
    process.exit(0)
  }
) {
  let command = commands
  let wordIndex
  for (wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const word = words[wordIndex]
    if (typeof command === 'object' && command[word]) command = command[word]
    if (command instanceof Function) break
  }
  if (command instanceof Function) {
    return await Promise.resolve(command(...words.slice(wordIndex + 1)))
  } else {
    return await Promise.resolve(catchall(command, words))
  }
}
