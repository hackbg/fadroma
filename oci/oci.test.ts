import { Engine, Image, Container, defaultSocketPath } from './dock-docker'
import * as assert from 'node:assert'

assert.throws(()=>new Engine(123 as any))

{
  const engine = new Engine()
  const image = engine.image('tag')
  const container = image.container('name')
  assert.ok(image instanceof Image)
  assert.equal(image.engine, engine)
  assert.ok(container instanceof Container)
  assert.equal(container.image, image)
}

{

  const engine = Engine.mock()

  {
    const image = engine.image('test', 'Dockerfile')
    await image.ensure()
    await image.check()
    await image.pull()
    await image.build()
    const container = await image.run()
    assert.equal(container.image, image)
    await container.id
    await container.shortId
    await container.warnings
    await container.isRunning
    await container.ip
  }

  {
    const container = await engine.container('test')
    assert.equal(container.image.dockerode, engine.dockerode)
  }

}
