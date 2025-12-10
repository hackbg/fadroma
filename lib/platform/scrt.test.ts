import * as Scrt from './cw.ts';
import { suite, the } from '../tester.ts';
export default suite(import.meta, 'Secret',
  the('Program', the('Upload'), the('Instantiate'), the('Method')),
  the('Project', the('Init'), the('Build'), the('Deploy'),
    the('SDK', the('Test'), the('CLI'), the('GUI'))));
