export default Example;
/** 1 BTC = 100000000 Satoshis. */
export const DECIMAL = 100000000n;
/** Values for `initialfreecoins` and `initialreissuancetokens`. */
export const INITIAL = { COINS: 1000000n * DECIMAL, REISSUE: 1n * DECIMAL };
/** Asset ID for initial reissuance token. */
export const REISSUE = 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61';
///** Asset ID for regular old Bitcoin. */
//const BITCOIN = 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23';
///** Asset IDs of (t)L-BTC. */
//const LIQUID  = { mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d'
//               , testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49' };

/** Predefined example program. */
type Example = { name?: string, cost?: number, cmr?: string, p2tr?: string, src: string };
/** Get predefined example programs. */
function Example () {
  return [
    UnitProgram(),
    AssertProgram(),
    SimpleProgram(),
  ]
  function UnitProgram () {
    return {
      name: "unit program",
      cost: 2.4e-7,
      cmr:  'c40a10263f7436b4160acbef1c36fba4be4d95df181a968afeab5eac247adff7',
      p2tr: 'tex1p9jcvyzkdwdqtf49kta4xpc5g35xkfcexwfsl8v70w2gwttelncyshxjk56',
      src:  'fn main () {}',
    }
  }
  function AssertProgram () {
    return {
      name: "assert program",
      cost: 2.7e-7,
      cmr:  '206e951b8c4e65032096bfa54ed287b804060f55db41d87edffcc566ab8728e8',
      p2tr: 'tex1pa86g4lqqsll5p58qqjcauq0htfcgsvam6rv3ze2y07j8glg7smgska7ufk',
      src:  'fn main () { assert!(true) }',
    }
  }
  function SimpleProgram () {
    return {
      name: "simple program",
      cost: 2.7e-7,
      //cmr: 'e65e19e139a13583a0a7efb24be13c20d578f06f51b2a7fe7c7b9097072dbabe',
      cmr: '81b57f4517573103523505ee621473e99f99713b2d29cdc09b98f84e6cde2804',
      //p2tr: 'tex1p305439usq06f4maelan8txnxshktvayu9z5gnwu6zrrxm9vmlufqcshcuv',
      p2tr: 'tex1p7plumjjy7rl9pwnwlsqthgm527k4zzuhfrd90jy0m8esy4g9q3lsl5hcpw',
      src: `fn main() {
        let ab: u16 = <(u8, u8)>::into((0x10, 0x01));
        let c: u16 = 0x1001;
        assert!(jet::eq_16(ab, c));
        //let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));
        //let c: u8 = 0b10111101;
        //assert!(jet::eq_8(ab, c));
      }`,
    }
  }
  function P2PKProgram (
    pubkey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  ) {
    return {
      name: "pay to pubkey",
      src: `fn main() {
        let pk: Pubkey = 0x${pubkey};
        let msg: u256 = jet::sig_all_hash();
        let sig: Signature = witness::signature;
        jet::bip_0340_verify(pk, msg, sig)
      }`
    }
  }
  function EscrowProgramWitness (
    value = "Right(0xedb6865094260f8558728233aae017dd0969a2afe5f08c282e1ab659bf2462684c99a64a2a57246358a0d632671778d016e6df7381293dd5bb9f0999d38640d4)",
  ) {
    return `{
      "TRANSFER_OR_TIMEOUT": {
        "value": "${value}",
        "type":  "Either<[Option<Signature>; 3], Signature>"
      }
    }`
  }
  function EscrowProgram ({
    sender    = '0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    recipient = '0xc6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    escrow    = '0xf9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
    timeout   = '1000',
  } = {}) {
    return `
    /*
     * https://github.com/BlockstreamResearch/SimplicityHL/blob/master/examples/escrow_with_delay.simf
     * https://docs.ivylang.org/bitcoin/language/ExampleContracts.html#escrowwithdelay
     */
    fn main () {
      // Depending on provided witness:
      match witness::TRANSFER_OR_TIMEOUT {
        // Transfer to receiver:
        Left(maybe_sigs: [Option<Signature>; 3]) => spend_confirm(maybe_sigs),
        // or return to sender:
        Right(sender_sig: Signature) => spend_revoke(sender_sig),
      }
    }
    fn spend_confirm (maybe_sigs: [Option<Signature>; 3]) {
      let threshold: u8 = 2;
      let [sig1, sig2, sig3]: [Option<Signature>; 3] = maybe_sigs;
      let counter1: u8 = checksig_add(0,        ${sender},    sig1);
      let counter2: u8 = checksig_add(counter1, ${recipient}, sig2);
      let counter3: u8 = checksig_add(counter2, ${escrow},    sig3);
      assert!(jet::eq_8(counter3, threshold));
    }
    fn checksig_add (counter: u8, pk: Pubkey, maybe_sig: Option<Signature>) -> u8 {
      match maybe_sig {
        Some(sig: Signature) => {
          checksig(pk, sig);
          let (carry, new_counter): (bool, u8) = jet::increment_8(counter);
          assert!(not(carry));
          new_counter
        }
        None => counter,
      }
    }
    fn not (bit: bool) -> bool {
      <u1>::into(jet::complement_1(<bool>::into(bit)))
    }
    fn spend_revoke (sender_sig: Signature) {
      checksig(${sender}, sender_sig);
      jet::check_lock_distance(${timeout});
    }
    fn checksig (pk: Pubkey, sig: Signature) {
      jet::bip_0340_verify((pk, jet::sig_all_hash()), sig);
    }`
  }
}

