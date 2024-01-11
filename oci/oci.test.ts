import { OCIConnection, OCIImage, OCIContainer, defaultSocketPath } from './oci'
import * as assert from 'node:assert'

assert.throws(()=>new OCIConnection(123 as any))

{
  const engine = new OCIConnection()
  const image = engine.image('tag')
  const container = image.container('name')
  assert.ok(image instanceof OCIImage)
  assert.equal(image.engine, engine)
  assert.ok(container instanceof OCIContainer)
  assert.equal(container.image, image)
}

{

  const engine = OCIConnection.mock()

  {
    const image = engine.image('test', 'Dockerfile')
    await image.pullOrBuild()
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
    assert.equal(container.api, engine.api)
    assert.equal(container.image.api, engine.api)
  }

}
