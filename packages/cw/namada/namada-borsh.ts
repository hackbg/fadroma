//const BigNumberSerializer = {
  //serialize: (value: BigNumber, writer: BinaryWriter) => {
    //writer.string(value.toString());
  //},
  //deserialize: (reader: BinaryReader): BigNumber => {
    //const valueString = reader.string();
    //return new BigNumber(valueString);
  //},
//};

/** Borsh schema for values returned by ABCI. */
export default {
  ValidatorState: {
    enum: [
      {struct:{consensus:{}}},
      {struct:{below_capacity:{}}},
      {struct:{below_threshold:{}}},
      {struct:{inactive:{}}},
      {struct:{jailed:{}}},
    ]
  },
  ValidatorMetaData: {
    option: {
      struct: {
        email:          'string',
        description:    { option: 'string' },
        website:        { option: 'string' },
        discord_handle: { option: 'string' },
        avatar:         { option: 'string' }
      }
    }
  },
  Proposal: {
    struct: {
      id:                 'string',
      proposal_type:      'string', // "pgf_steward" | "pgf_payment" | "default";
      author:             'string',
      start_epoch:        'u64',
      end_epoch:          'u64',
      grace_epoch:        'u64',
      content_json:       'string',
      status:             'string', // "ongoing" | "finished" | "upcoming";
      result:             'string', // "passed" | "rejected";
      total_voting_power: 'string',
      total_yay_power:    'string',
      total_nay_power:    'string',
    }
  }
  //CommissionPair: {
    //option: {
      //struct: {
        //commission_rate: 'string',
        //max_commission_change_per_epoch: 'string',
      //}
    //}
  //}
}


