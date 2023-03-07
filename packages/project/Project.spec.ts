import $, { OpaqueDirectory, withTmpDir } from '@hackbg/file'
import Project from './Project'

withTmpDir((tmp: string)=>{

  const project = new Project('test', $(tmp).as(OpaqueDirectory), {
    contract1: {},
    contract2: {}
  }).create()

}, false)

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
