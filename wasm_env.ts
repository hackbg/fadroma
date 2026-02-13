// FIXME: This should be propagated from the Fadroma/SimplicityHL module.
export function __assert_fail (...args) {
  throw new Error(['__assert_fail:', ...args].join(' '))
}

// FIXME: the following should be unneeded:

export function __syscall_getcwd () { throw new Error('not implemented') }

export function rustsecp256k1_v0_10_0_context_preallocated_clone_size () {
  return 0;
  throw new Error('not implemented')
}

export function rustsecp256k1_v0_10_0_context_preallocated_create () {
  return 0;
  throw new Error('not implemented')
}

export function rustsecp256k1_v0_10_0_context_preallocated_destroy () {
  return 0;
  throw new Error('not implemented')
}

export function rustsecp256k1_v0_10_0_context_preallocated_size () {
  return 0;
  throw new Error('not implemented')
}

export function rustsecp256k1_v0_10_0_ec_pubkey_serialize () { throw new Error('not implemented') }
export function rustsecp256k1_v0_10_0_xonly_pubkey_from_pubkey () { throw new Error('not implemented') }
export function rustsecp256k1_v0_10_0_xonly_pubkey_parse () { throw new Error('not implemented') }
export function rustsecp256k1_v0_10_0_xonly_pubkey_serialize () { throw new Error('not implemented') }
export function rustsecp256k1_v0_10_0_xonly_pubkey_tweak_add () { throw new Error('not implemented') }
export function rustsecp256k1_v0_10_0_xonly_pubkey_tweak_add_check () { throw new Error('not implemented') }

export function rustsecp256k1zkp_v0_10_0_generator_serialize () { throw new Error('not implemented') }
export function rustsecp256k1zkp_v0_10_0_pedersen_commitment_serialize () { throw new Error('not implemented') }
export function rustsecp256k1zkp_v0_10_0_surjectionproof_serialize () { throw new Error('not implemented') }
export function rustsecp256k1zkp_v0_10_0_surjectionproof_serialized_size () { throw new Error('not implemented') }
