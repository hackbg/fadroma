import assert, { equal } from 'node:assert'
import { Path } from '@hackbg/file'
import * as Tools from './tools'
export default async function testTools () {

  Tools.logInstallRust({} as any)
  Tools.logInstallSha256Sum({} as any)
  Tools.logInstallWasmOpt({} as any)
  Tools.logProjectCreated({ root: new Path('.') })

  let prompt: (...args: any[]) => any
  const prompter = new Tools.ProjectPrompter({ prompt: (...args: any[]) => prompt(...args) })

  prompt = () => Promise.resolve({ value: '  ok  \n ' })
  equal('ok', await prompter.text('test'))

  prompt = () => Promise.resolve({ value: 'ok' })
  equal('ok', await prompter.select('test', []))

  prompt = ({ choices }: any) => choices[0]

  prompt = () => Promise.resolve({ value: 'foo' })
  await prompter.projectName()
  await prompter.projectRoot('')
  await prompter.projectMode()
  await prompter.contractCrates('')
  await prompter.defineContract({})
  await prompter.undefineContract({})
  await prompter.renameContract({foo:{}})
  await prompter.deployment({keys:()=>[]} as any)

  //equal('docker', await Tools.askCompiler({ isLinux: true }, prompts))
  //equal('raw',    await Tools.askCompiler({ isLinux: false }, prompts))

  //prompts = {}
  //await Tools.askProjectName(prompts)
  //await Tools.askProjectRoot('name', prompts)
  //await Tools.askProjectCrates('name', prompts)
  //await Tools.defineContractCrate({}, prompts)
  //await Tools.removeContractCrate({}, prompts)
  //await Tools.renameContractCrate({}, prompts)

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
