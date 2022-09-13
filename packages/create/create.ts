//import * as Komandi from '@hackbg/komandi'
//import * as Fadroma from '@hackbg/fadroma'
//export default new Fadroma.Commands()

// TODO create project

  //1. npm init
  //2. npm install @hackbg/fadroma

// TODO unpack self

  //1. create cargo toml
  //2. create contract/
  //3. create api/package.json, index.ts, Contract.ts

// TODO add contract to project

  //1. ask for path/to/contract
  //2. mkdir path/to/contract
  //3. create cargo.toml
  //4. create contract.rs
  //5. add to workspace
  //6. create api/...

//import { prompts, colors, bold } from '@hackbg/konzola'
//import $, { TextFile, JSONFile, YAMLFile } from '@hackbg/kabinet'
//import { execSync } from 'child_process'
//import pkg from './package.json'

//async function create () {
  //console.log(' ', bold('Fadroma:'), String(pkg.version).trim())
  //check('Git:    ', 'git --version')
  //check('Node:   ', 'node --version')
  //check('NPM:    ', 'npm --version')
  //check('Yarn:   ', 'yarn --version')
  //check('PNPM:   ', 'pnpm --version')
  //check('Cargo:  ', 'cargo --version')
  //check('Docker: ', 'docker --version')
  //check('Nix:    ', 'nix --version')
  //const project   = await askProjectName()
  //const contracts = await askContractNames()
  //const root      = await setupRoot(project, contracts)
  //setupGit(root)
  //setupNode(root, project, contracts)
  //setupCargoWorkspace(root, project, contracts)
  //setupApiCrate(root, project, contracts)
  //setupSharedCrate(root, project, contracts)
  //setupContractCrates(root, project, contracts)
  //setupDeployWorkflow(root, project, contracts)
//}

//function check (dependency, command) {
  //let version = null
  //try {
    //const version = execSync(command)
    //console.log(' ', bold(dependency), String(version).trim())
  //} catch (e) {
    //console.log(' ', bold(dependency), colors.yellow('(not found)'))
  //} finally {
    //return version
  //}
//}

//async function askProjectName () {
  //return await prompts.text({
    //type:    'text',
    //name:    'projectName',
    //message: 'Enter a project name (lowercase alphanumerics only)'
  //})
//}

//async function askContractNames () {
  //let action: 'add'|'remove'|'done' = 'add'
  //const contracts = new Set()
  //while (true) {
    //if (action === 'add') {
      //const name = await prompts.text({
        //type:    'text',
        //name:    'projectName',
        //message: 'Enter a contract name (lowercase alphanumerics only)'
      //}) as unknown as string
      //if (name === 'lib' || name === 'api') {
        //console.info(`"${name}" is a reserved name. Try something else.`)
        //continue
      //}
      //contracts.add(name)
    //}
    //console.log(' ', bold('Contracts that will be created:'))
    //for (const contractName of [...contracts].sort()) {
      //console.log('  -', contractName)
    //}
    //action = await prompts.select({
      //type:    'select',
      //name:    'contractAction',
      //message: 'Add more contracts?',
      //choices: [
        //{ title: 'Add another contract', value: 'add' },
        //...(contracts.size > 0) ? [{ title: 'Remove a contract', value: 'remove' }] : [],
        //{ title: 'Done, create project!', value: 'done' },
      //]
    //}) as unknown as "add"|"remove"|"done"
    //if (action === 'done') {
      //return contracts
    //} else if (action === 'remove') {
      //contracts.delete(await prompts.select({
        //type:    'select',
        //name:    'contractAction',
        //message: 'Select contract to remove:',
        //choices: [...contracts].map((name: string)=>({
          //title: name,
          //value: name
        //}))
      //}))
    //}
  //}
  //return contracts
//}

//async function setupRoot (name, contracts) {
  //const root = $(process.cwd()).in(name)
  //if (root.exists()) {
    //console.log(`\n  ${name}: already exists.`)
    //console.log(`  Move it out of the way, or pick a different name.`)
    //process.exit(1)
  //}
  //root.make()
  //return root
//}

//function setupGit (root) {
  //execSync('git init -b main', { cwd: root.path })
  //root.at('.gitignore').as(TextFile).save(``)
//}

//function setupNode (root, project, contracts) {
  //root.at('package.json').as(JSONFile).save({
    //name:    `@${project}/workspace`,
    //version: '0.1.0',
    //private: true
  //})
  //root.in('api').at('package.json').as(JSONFile).save({
    //name:    `@${project}/api`,
    //version: '0.1.0',
    //dependencies: {
      //'@fadroma/client': '^2'
    //}
  //})
  //for (const contract of contracts) {
    //const Contract = contract[0].toUpperCase() + contract.slice(1)
    //root.in('api').at(`${contract}.ts`).as(TextFile).save(dedent(`
      //// Client for contract: ${contract}
      //import { Client } from '@fadroma/client'
      //class ${Contract} extends Client {
        //fees = {}
        //// See https://fadroma.tech/guides/client-classes
      //}
    //`))
  //}
//}

//function setupCargoWorkspace (root, project, contracts) {
  //root.at('Cargo.toml').as(TextFile).save(dedent(`
    //[workspace]
    //members = [
      //"./api",
      //"./lib",
      //${[...contracts].map(name=>`"./contracts/${name};`).join('\n      ')}
    //]

    //[profile.release]
    //codegen-units    = 1
    //debug            = false
    //debug-assertions = false
    //incremental      = false
    //lto              = true
    //opt-level        = 3
    //overflow-checks  = true
    //panic            = 'abort'
    //rpath            = false
  //`))
//}

//function setupApiCrate (root, project, contracts) {
  //root.in('api').at('Cargo.toml').as(TextFile).save(dedent(`
    //[package]
    //name = "${project}-api"

    //[lib]
    //path = "api.rs"

    //[dependencies]
    //schemars = "0.7"
    //serde    = { version = "1.0.103", default-features = false, features = ["derive"] }
  //`))
  //root.in('api').at('api.rs').as(TextFile).save(dedent(`
    //// Messages of contracts are defined in this crate.
    //${[...contracts].map(name=>`pub mod ${name};`).join('\n    ')}
  //`))
  //for (const contract of contracts) {
    //root.in('api').at(`${contract}.rs`).as(TextFile).save(dedent(`
      //// API definition for contract: ${contract}
      //pub struct Init {}
      //pub enum Handle {}
      //pub enum Query {}
    //`))
  //}
//}

//function setupSharedCrate (root, project, contracts) {
  //// Create the Shared crate
  //root.in('lib').at('Cargo.toml').as(TextFile).save(dedent(`
    //[package]
    //name = "${project}-lib"

    //[lib]
    //path = "lib.rs"

    //[dependencies]
  //`))
  //root.in('lib').at('lib.rs').as(TextFile).save(dedent(`
    //# Entities defined here can be accessed from any contract without circular dependencies.
  //`))
//}

//function setupContractCrates (root, project, contracts) {
  //for (const contract of [...contracts]) {
    //root.in('contracts').in(contract).at('Cargo.toml').as(TextFile).save(dedent(`
      //[package]
      //name    = "${contract}"
      //version = "0.1.0"
      //edition = "2018"

      //[lib]
      //crate-type = ["cdylib", "rlib"]
      //doctest    = false
      //path       = "${contract}.rs"

      //[dependencies]
      //fadroma        = { path = "../../../fadroma/crates/fadroma", features = ["scrt"] }
      //${project}-api = { path = "../../api" }
      //${project}-lib = { path = "../../lib" }
    //`))
    //root.in('contracts').in(contract).at(`${contract}.rs`).as(TextFile).save(dedent(`
      //use fadroma::*;
      //use ${project}_api::${contract}::{Init, Handle, Query};
      //use ${project}_lib as lib;

      //pub fn init<S: Storage, A: Api, Q: Querier>(
          //deps: &mut Extern<S, A, Q>,
          //env:  Env,
          //msg:  Init
      //) -> StdResult<InitResponse> {
          //Ok(InitResponse::default())
      //}

      //pub fn handle<S: Storage, A: Api, Q: Querier>(
          //deps: &mut Extern<S, A, Q>,
          //env:  Env,
          //msg:  Handle
      //) -> StdResult<HandleResponse> {
          //Ok(HandleResponse::default())
      //}

      //pub fn query<S: Storage, A: Api, Q: Querier>(
          //deps: &Extern<S, A, Q>,
          //env:  Env,
          //msg:  Handle
      //) -> StdResult<Binary> {
          //Ok(Binary(vec![]))
      //}

      //#[cfg(target_arch="wasm32")]
      //mod wasm {
          //use fadroma::{do_handle, do_init, do_query, ExternalApi, ExternalQuerier, ExternalStorage};
          //#[no_mangle] extern "C" fn init(env_ptr: u32, msg_ptr: u32) -> u32 {
              //do_init(&super::init::<ExternalStorage, ExternalApi, ExternalQuerier>, env_ptr, msg_ptr)
          //}
          //#[no_mangle] extern "C" fn handle(env_ptr: u32, msg_ptr: u32) -> u32 {
              //do_handle(&super::handle::<ExternalStorage, ExternalApi, ExternalQuerier>, env_ptr, msg_ptr)
          //}
          //#[no_mangle] extern "C" fn query(msg_ptr: u32) -> u32 {
              //do_query(&super::query::<ExternalStorage, ExternalApi, ExternalQuerier>, msg_ptr)
          //}
      //}
    //`))
  //}
//}

//function setupDeployWorkflow (root, project, contractSet) {

  //const contracts = [...contractSet].sort()

  //root.at('deploy.ts').as(YAMLFile).save(dedent(`
    //import Fadroma, { Console, OperationContext } from 'fadroma'

    //const console = new Console('Deploy')

    //Fadroma.command('all',
      //Fadroma.Build.Scrt,
      //Fadroma.Chain.FromEnv,
      //Fadroma.Upload.FromFile,
      //Fadroma.Deploy.New,
      //async function deployAll (context: OperationContext) {
        //const {
          //buildAndUploadMany,
          //templates = await buildAndUploadMany({
            //${contracts.map(name=>`${name}: workspace.source(${name});`).join(',\n            ')}
          //}),
          //deployment,
          //agent
        //}

        //${contracts.map(name=>`deployment.init(agent, templates["${name}"], "${name}", {});`).join(',\n        ')}

      //})

    //export default Fadroma.module(import.meta.url)
  //`))
//}

//const RE_NON_WS = /\S|$/

//function dedent (string) {
  //let minWS = Infinity
  //const lines = string.split('\n')
  //for (const line of lines) {
    //if (line.trim().length === 0) continue // don't take into account blank lines
    //minWS = Math.min(minWS, line.search(RE_NON_WS))
  //}
  //const dedentedMessage = lines.map(line=>line.slice(minWS)).join('\n')
  //return dedentedMessage.trim()
//}

//create()

