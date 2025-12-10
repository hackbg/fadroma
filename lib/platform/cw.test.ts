import * as CosmWasm from './cw.ts';
import { suite, the } from '../tester.ts';
export default suite(import.meta, 'CosmWasm',
  the('Program', the('Upload'), the('Instantiate'), the('Method')),
  the('Project', the('Init'), the('Build'), the('Deploy'),
    the('SDK', the('Test'), the('CLI'), the('GUI'))));
