export default function SimfExamples () {
  return [
    UnitProgram(),
    SimpleProgram(),
  ]
  function UnitProgram () {
    return {
      cost: 2.4e-7,
      cmr: 'c40a10263f7436b4160acbef1c36fba4be4d95df181a968afeab5eac247adff7',
      p2tr: 'tex1p9jcvyzkdwdqtf49kta4xpc5g35xkfcexwfsl8v70w2gwttelncyshxjk56',
      src: 'fn main () {}',
    }
  }
  function SimpleProgram () {
    return {
      cost: 2.7e-7,
      cmr: 'e65e19e139a13583a0a7efb24be13c20d578f06f51b2a7fe7c7b9097072dbabe',
      p2tr: 'tex1p305439usq06f4maelan8txnxshktvayu9z5gnwu6zrrxm9vmlufqcshcuv',
      src: `fn main() {
        let ab: u16 = <(u8, u8)>::into((0x10, 0x01));
        let c: u16 = 0x1001;
        assert!(jet::eq_16(ab, c));
        let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));
        let c: u8 = 0b10111101;
        assert!(jet::eq_8(ab, c));
      }`,
    }
  }
  function P2PKProgram (
    pubkey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  ) {
    return {
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

