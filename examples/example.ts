import { Deploy } from '@hackbg/fadroma'

export default function main (state) {

  return new Deploy.Deployment(state)
    .addContract("cw-null", {
      language:   'rust',
      sourcePath: '..',
      cargoToml:  './examples/contracts/cw-null/Cargo.toml'
    })
    .addContract("cw-stub", {
      language:   'rust',
      sourcePath: '..',
      cargoToml:  './examples/contracts/cw-stub/Cargo.toml'
    })
    .addContract("cw-echo", {
      language:   'rust',
      sourcePath: '..',
      cargoToml:  './examples/contracts/cw-echo/Cargo.toml'
    })
    .addContract("scrt-null", {
      language:   'rust',
      sourcePath: '..',
      cargoToml:  './examples/contracts/scrt-null/Cargo.toml'
    })
    .addContract("scrt-stub", {
      language:   'rust',
      sourcePath: '..',
      cargoToml:  './examples/contracts/scrt-stub/Cargo.toml'
    })
    .addContract("scrt-echo", {
      language:   'rust',
      sourcePath: '..',
      cargoToml:  './examples/contracts/scrt-echo/Cargo.toml'
    })
}

//export default class ExampleDeployment extends Deployment {

  //cw = {
    //stub: this.contract("cw-stub", { language: 'rust', cargoToml: './cw-stub/Cargo.toml' }),
    //echo: this.contract("cw-echo", { language: 'rust', cargoToml: './cw-echo/Cargo.toml' }),
  //}

  //scrt = {
    //stub: this.contract("scrt-stub", { language: 'rust', cargoToml: './scrt-stub/Cargo.toml' }),
    //echo: this.contract("scrt-echo", { language: 'rust', cargoToml: './scrt-echo/Cargo.toml' }),
  //}

  //run (...args: any) {
    //console.log(this, args)
  //}

//}
