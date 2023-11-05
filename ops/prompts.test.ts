import assert, { equal } from 'node:assert'
import $ from '@hackbg/file'
import * as Prompts from './prompts'
export default async function testPrompts () {

  equal('ok', await Prompts.askText({
    prompts: { prompt: () => Promise.resolve({ value: '  ok  \n ' }) },
    message: 'test'
  }))

  equal('ok', await Prompts.askSelect({
    prompts: { prompt: () => Promise.resolve({ value: 'ok' }) },
    message: 'test',
    choices: []
  }))

  Prompts.logInstallRust({} as any)

  Prompts.logInstallWasmOpt({} as any)

  Prompts.logProjectCreated({ root: $('.') })

}

//export async function testProjectWizard () {
  //const wizard = new ProjectWizard({
    //interactive: false,
    //cwd: tmpDir()
  //})
  //assert.ok(await wizard.createProject(
    //Project,
    //'test-project-2',
    //'test3',
    //'test4'
  //) instanceof Project)
//}

//export function tmpDir () {
  //let x
  //withTmpDir(dir=>x=dir)
  //return x
//}
