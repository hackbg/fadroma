import { Engine, Image, Container } from './dock-podman'
import * as assert from 'node:assert'

const engine = new Engine()
assert.equal(engine.log.label, `@fadroma/oci: podman`)

const image = engine.image('tag')
assert.ok(image instanceof Image)
assert.equal(image.log.label, `image(\x1B[1mtag\x1B[22m)`)
assert.equal(image.engine, engine)

const container = image.container('name')
assert.ok(container instanceof Container)
assert.equal(container.log.label, `container(\x1B[1mname\x1B[22m)`)
assert.equal(container.image, image)
