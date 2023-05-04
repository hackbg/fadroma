import MyProject from './api'
import Project from '@hackbg/fadroma'

export default class MyProjectProject extends Project {

  Deployment = MyProject

  // Override to customize the build command:
  //
  // build = async (...contracts: string[]) => { 
  //   await super.build(...contracts)
  // }

  // Override to customize the upload command:
  //
  // upload = async (...contracts: string[]) => {
  //   await super.upload(...contracts)
  // }

  // Override to customize the deploy command:
  //
  // deploy = async (...args: string[]) => {
  //   await super.deploy(...args)
  // }

  // Override to customize the status command:
  //
  // status = async (...args: string[]) => {
  //   await super.status()
  // }

  // Define custom commands using `this.command`:
  //
  // custom = this.command('custom', 'run a custom procedure', async () => {
  //   // ...
  // })

}