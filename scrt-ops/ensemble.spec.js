import assert from 'assert'
import Ensemble from './ensemble.js'
describe('Secret Network Ensemble', () => {

  let e
  class TestEnsemble extends Ensemble {
    contracts = { TEST: { crate: 'test' } }
    docker = {
      async getImage () {
        //console.debug('mock getImage')
        return {
          async inspect () {
            //console.debug('mock inspect')
          }
        }
      }
    }
  }
  beforeEach(()=>{
    e = new TestEnsemble({
      builder: {
        async build (...args) {
          //console.debug('mock Builder.build', ...args)
        }
      }
    })
  })

  it('has a list of commands', () => {
    assert(e.commands instanceof Array)
    assert(e.localCommands instanceof Array)
    assert(e.remoteCommands instanceof Array)
  })

  it('has a local build command', async () => {
    assert(e.localCommands.map(x=>x[0]).indexOf('build')>-1)
    await e.build({ workspace: 'mock workspace' })
  })

  it('has a remote deploy command', async () => {
    assert(e.remoteCommands.map(x=>x[0]).indexOf('deploy')>-1)
    await e.deploy()
  })
})
