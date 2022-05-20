import { createServer } from 'http'

console.log('Mock devnet init on port', process.env.Port)

const server = createServer(function onRequest (req, res) {
  console.log('Mock devnet received request')
  res.writeHead(200)
  res.end('')
})

server.listen(process.env.Port)
