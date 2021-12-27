export default async function runCommands (
  commands: Record<string, any>,
  words:    Array<string>,
  usage: (command: any)=>any = function defaultPrintUsage (command: Record<string, any>) {
    console.log(`\nAvailable commands:`)
    for (const key of Object.keys(command)) {
      console.log(`  ${key}`)
    }
  }
) {

  let command = commands
  let wordIndex: number

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
