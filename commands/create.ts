import { Console, prompts, colors, bold } from '@hackbg/konzola'
import { Path, TextFile, JSONFile, YAMLFile } from '@hackbg/kabinet'
import { execSync } from 'child_process'
import pkg from '../package.json'

const console = Console('Fadroma')

create()

async function create () {
  console.log(' ', bold('Fadroma:'), String(pkg.version).trim())
  check('Git:    ', 'git --version')
  check('Node:   ', 'node --version')
  check('NPM:    ', 'npm --version')
  check('Yarn:   ', 'yarn --version')
  check('PNPM:   ', 'pnpm --version')
  check('Cargo:  ', 'cargo --version')
  check('Docker: ', 'docker --version')
  check('Nix:    ', 'nix --version')
  const name = await askProjectName()
  const contracts = await askContractNames()
  const root = await setupRoot(name)
  await setupGit(root)
  await setupNode(root)
  await setupCargo(root)
  //await setupDrone(root) // TODO
  //await setupGHA(root)   // TODO
  //await setupNix(root)   // TODO
  await setupFadroma(root)
}

function check (dependency, command) {
  try {
    const version = execSync(command)
    console.log(' ', bold(dependency), String(version).trim())
  } catch (e) {
    console.log(' ', bold(dependency), colors.yellow('(not found)'))
  }
}

async function askProjectName () {
  return await prompts.text({
    type:    'text',
    name:    'projectName',
    message: 'Enter a project name (lowercase alphanumerics only)'
  })
}

async function askContractNames () {
  let action: 'add'|'remove'|'done' = 'add'
  const contracts = new Set()
  while (true) {
    if (action === 'add') {
      contracts.add(await prompts.text({
        type:    'text',
        name:    'projectName',
        message: 'Enter a contract name (lowercase alphanumerics and hyphens only)'
      }))
    }
    console.log(' ', bold('Contracts that will be created:'))
    for (const contractName of [...contracts].sort()) {
      console.log('  -', contractName)
    }
    action = await prompts.select({
      type:    'select',
      name:    'contractAction',
      message: 'Add more contracts?',
      choices: [
        { title: 'Add another contract', value: 'add' },
        ...(contracts.size > 0) ? [{ title: 'Remove a contract', value: 'remove' }] : [],
        { title: 'Done, create project!', value: 'done' },
      ]
    })
    if (action === 'done') {
      return contracts
    } else if (action === 'remove') {
      contracts.delete(await prompts.select({
        type:    'select',
        name:    'contractAction',
        message: 'Select contract to remove:',
        choices: [...contracts].map(name=>({
          title: name, value: name
        }))
      }))
    }
  }
  return contracts
}

async function setupRoot (name) {
  const root = new Path(process.cwd()).in(name)
  if (root.exists) {
    console.log(`\n  ${name}: already exists.`)
    console.log(`  Move it out of the way, or pick a different name.`)
    process.exit(1)
  }
  root.make()
  return root
}

async function setupGit (root) {
  execSync('git init -b main', { cwd: root.path })
  root.at('.gitignore').as(TextFile).save(``)
}

async function setupNode (root) {
  root.at('package.json').as(JSONFile).save({
    name:    root.name,
    version: '0.1.0'
  })
}

async function setupCargo (root) {
  root.at('Cargo.toml').as(TextFile).save(
`
[workspace]
members = []

[profile.release]
codegen-units    = 1
debug            = false
debug-assertions = false
incremental      = false
lto              = true
opt-level        = 3
overflow-checks  = true
panic            = 'abort'
rpath            = false
`.trim()
  )
}

async function setupFadroma (root) {
  root.at('fadroma.yml').as(YAMLFile).save()
}

//function foo () {
  //process.chdir(name)
  //await mkdirp("artifacts")
  //await mkdirp("contracts")
  //await mkdirp("contracts/hello")
  //await mkdirp("contracts/hello/tests")
  //await mkdirp("receipts")
  //await mkdirp("scripts")
  //await mkdirp("settings")

  //// create project content
  //await Promise.all([
    //writeFile('.gitignore', '', 'utf8'),
    //writeFile('Cargo.toml', '', 'utf8'),
    //writeFile('README.md',  '', 'utf8'),
    //writeFile('package.json',        '', 'utf8'),
    //writeFile('pnpm-workspace.yaml', '', 'utf8'),
    //writeFile('shell.nix',           '', 'utf8'),
    //writeFile('tsconfig.json',       '', 'utf8'),

    //writeFile('contracts/hello/Cargo.toml',   '', 'utf8'),
    //writeFile('contracts/hello/api.ts',       '', 'utf8'),
    //writeFile('contracts/hello/hello.rs',     '', 'utf8'),
    //writeFile('contracts/hello/package.json', '', 'utf8'),
    //writeFile('contracts/hello/tests/mod.rs', '', 'utf8'),

    //writeFile('scripts/Dev.ts.md',   '', 'utf8'),
    //writeFile('scripts/Ops.ts.md',   '', 'utf8'),
  //])

  //console.log('\n  Project created.')

  //// create /README.md
  //// create /package.json
  //// create /tsconfig.json
  //// create /pnpm-workspace.yaml
  //// create /shell.nix
  //// create /scripts/Dev.ts.md
  //// create /scripts/Ops.ts.md
  //// create /Cargo.toml
  //// create /contracts/hello/Cargo.toml
  //// create /contracts/hello/package.json
  //// create /contracts/hello/hello.rs
  //// create /contracts/hello/api.ts
  //// create /contracts/hello/tests/mod.ts
  //// create /artifacts
  //// create /receipts
  //// run cargo build
  //// git init
  //// git commit
//}
