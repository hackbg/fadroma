import { Source, Scrt_1_2, Console, bold, resolve, relative, cwd } from '../index'
const console = Console('fadroma build')
let [buildScript,...buildArgs] = process.argv.slice(2)
buildScript = resolve(buildScript)
const buildSetName = buildArgs.join(' ')
console.info(bold('Build script:'), relative(cwd(), buildScript))
console.info(bold('Build set:   '), buildSetName || bold('(none)'))
import(resolve(buildScript)).then(({default: buildSets})=>{
  if (buildArgs.length > 0) {
    const buildSet = buildSets[buildSetName]
    if (!buildSet) {
      console.error(`No build set ${bold(buildSetName)}.`)
      list(buildSets)
      process.exit(1)
    } else if (!(buildSet instanceof Function)) {
      console.error(`Invalid build set ${bold(buildSetName)} - must be function, got: ${typeof buildSet}`)
      process.exit(2)
    } else {
      const buildSources = buildSet()
      if (!(buildSources instanceof Array)) {
        console.error(`Invalid build set ${bold(buildSetName)} - must return Array<Source>, got: ${typeof buildSources}`)
        process.exit(3)
      }
      Scrt_1_2.getBuilder().buildMany(buildSources)
        .then(()=>console.info('Build complete.'))
        .catch(e=>{
          console.error(`Build failed.`)
          console.error(e)
          process.exit(4)
        })
    }
  } else {
    console.warn(bold('No build set specified.'))
    list(buildSets)
  }
})

function list (buildSets) {
  console.log('Available build sets:')
  for (let [name, sources] of Object.entries(buildSets)) {
    console.log(`\n  ${name}`)
    sources = (sources as Function)() as any
    for (const source of sources as Array<Source>) {
      console.log(`    ${bold(source.crate)} @ ${source.ref}`)
    }
  }
}
