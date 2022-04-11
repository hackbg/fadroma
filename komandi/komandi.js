module.exports = runCommands
module.exports.default = runCommands
module.exports.runCommands = runCommands

async function runCommands (
  commands = {},
  words    = [],
  usage    = function defaultPrintUsage (command = {}) {
    console.log(`\nAvailable commands:`)
    for (const key of Object.keys(command)) {
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
    return await Promise.resolve(usage(command))
  }
}
