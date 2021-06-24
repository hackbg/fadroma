import { createServer } from 'net';
import Docker from 'dockerode';
import waitPort from 'wait-port';
import { bold } from '@fadroma/utilities';

export { waitPort };

export const freePort = () => new Promise((ok, fail) => {
  let port = 0;
  const server = createServer();
  server.on('listening', () => { port = server.address().port; server.close(); });
  server.on('close', () => ok(port));
  server.on('error', fail);
  server.listen(0, '127.0.0.1');
});

export const pull = async (image, docker = new Docker()) => {
  try {
    // throws if image does not exist:
    await (await docker.getImage(image)).inspect();
  } catch (e) {
    console.debug(`docker pulling ${image}...`);
    await new Promise((ok, fail) => {
      docker.pull(image, (err, stream) => {
        if (err) return fail(err);
        docker.modem.followProgress(stream,
          (errProgress, output) => {
            if (errProgress) return fail(errProgress);
            console.log('pull ok');
            ok();
          },
          (event) => {
            event = ['id', 'status', 'progress'].map((x) => event[x]).join('│');
            console.debug('📦 docker pull says:', event);
          });
      });
    });
  }
  return image;
};

const RE_GARBAGE = /[\x00-\x1F]/; // eslint-disable-line

export const waitUntilLogsSay = (container, string, thenDetach = false) => new Promise((ok, fail) => container.logs({
  stdout: true, stderr: true, follow: true, tail: 100,
}, (err, stream) => {
  if (err) return fail(err);
  console.debug('⬇️  trailing logs...');
  stream.on('data', function read(data) {
    data = String(data).trim();
    if (
      data.length > 0
        && !data.startsWith('TRACE ')
        && !data.startsWith('DEBUG ')
        && !data.startsWith('INFO ')
        && !data.startsWith('I[')
        && !data.startsWith('Storing key:')
        && !RE_GARBAGE.test(data)
        && !data.startsWith('{"app_message":')
        && !data.startsWith('configuration saved to')
        && !(data.length > 1000)
    ) {
      console.debug('📦', bold(`${container.id.slice(0, 8)} says:`), String(data).trim());
    }
    if (data.indexOf(string) > -1) {
      if (thenDetach) stream.destroy();
      const seconds = 7;
      console.debug('⏳', bold(`waiting ${seconds} seconds`), 'for good measure...');
      return setTimeout(ok, seconds * 1000);
    }
    // if (data.indexOf('ERROR')>-1) { // TODO ignore benign error
    // stream.destroy()
    // console.error(`localnet failed to spawn: ${data}`)
    // container.stop().then(()=>container.remove().then(()=>console.debug(`removed ${id}`)))
    // unlink(nodeState).then(()=>console.debug(`deleted ${nodeState}`))
    // return fail(data)
    // }
  });
}));
