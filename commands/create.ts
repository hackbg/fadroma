import { writeFile, stat } from 'fs/promises'
import prompts from 'prompts'
import mkdirp from 'mkdirp'
const commands = {}
export default commands
commands['init'] = async function init () {

  // ask project name
  const name = await prompts.prompts.text({
    message: 'Enter a project name (lowercase alphanumerics only)'
  })

  // check if directory exists
  try {
    const stats = await stat(name)

    if (stats.isFile()) {
      console.log(`\n  There's already a file called "${name}".`)
      console.log(`  Move it out of the way, or pick a different name.\n`)
      process.exit(1)
    }

    if (stats.isDirectory()) {
      console.log(`\n  There's already a directory called "${name}".`)
      console.log(`  Move it out of the way, or pick a different name.\n`)
      process.exit(1)
      // TODO ask to overwrite
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e
    }
  }

  // create and enter project directory
  await mkdirp(name)
  process.chdir(name)
  await mkdirp("artifacts")
  await mkdirp("contracts")
  await mkdirp("contracts/hello")
  await mkdirp("contracts/hello/tests")
  await mkdirp("receipts")
  await mkdirp("scripts")
  await mkdirp("settings")

  // create project content
  await Promise.all([
    writeFile('.gitignore', '', 'utf8'),
    writeFile('Cargo.toml', '', 'utf8'),
    writeFile('README.md',  '', 'utf8'),
    writeFile('package.json',        '', 'utf8'),
    writeFile('pnpm-workspace.yaml', '', 'utf8'),
    writeFile('shell.nix',           '', 'utf8'),
    writeFile('tsconfig.json',       '', 'utf8'),

    writeFile('contracts/hello/Cargo.toml',   '', 'utf8'),
    writeFile('contracts/hello/api.ts',       '', 'utf8'),
    writeFile('contracts/hello/hello.rs',     '', 'utf8'),
    writeFile('contracts/hello/package.json', '', 'utf8'),
    writeFile('contracts/hello/tests/mod.rs', '', 'utf8'),

    writeFile('scripts/Dev.ts.md',   '', 'utf8'),
    writeFile('scripts/Ops.ts.md',   '', 'utf8'),
  ])

  console.log('\n  Project created.')

  // create /README.md
  // create /package.json
  // create /tsconfig.json
  // create /pnpm-workspace.yaml
  // create /shell.nix
  // create /scripts/Dev.ts.md
  // create /scripts/Ops.ts.md
  // create /Cargo.toml
  // create /contracts/hello/Cargo.toml
  // create /contracts/hello/package.json
  // create /contracts/hello/hello.rs
  // create /contracts/hello/api.ts
  // create /contracts/hello/tests/mod.ts
  // create /artifacts
  // create /receipts
  // run cargo build
  // git init
  // git commit
}
```

## Entrypoint

```typescript
import runCommands from '@hackbg/komandi'
import { fileURLToPath } from 'url'
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runCommands.default(commands, process.argv.slice(2))
}

