#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { resolvePath } from '../deps.ts';
import { Test        } from '../index.ts';
import { Namada      } from './namada.ts';
const { the, is, has } = Test;
const wasm = resolvePath(import.meta.dirname, "namada/pkg/fadroma_namada_bg.wasm");
export default Test.suite(import.meta, 'Namada',
  the('Wasm', async () => Namada.Wasm(await Deno.readFile(wasm)),
    has('address',                'function'),
    has('address_to_amount',      'function'),
    has('addresses',              'function'),
    has('balance_key',            'function'),
    has('block',                  'function'),
    has('code_hash',              'function'),
    has('epoch_duration',         'function'),
    has('gas_cost_table',         'function'),
    has('gov_parameters',         'function'),
    has('gov_proposal',           'function'),
    has('gov_proposal_code_key',  'function'),
    has('gov_result',             'function'),
    has('gov_votes',              'function'),
    has('pgf_parameters',         'function'),
    has('pos_commission_pair',    'function'),
    has('pos_parameters',         'function'),
    has('pos_validator_metadata', 'function'),
    has('pos_validator_set',      'function'),
    has('pos_validator_state',    'function'),
    has('storage_keys',           'function'),
    has('tx',                     'function'),
    has('u32',                    'function'),
    has('u64',                    'function'),
    has('vec_string',             'function')));
