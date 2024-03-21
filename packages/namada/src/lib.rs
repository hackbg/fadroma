extern crate wasm_bindgen;
use wasm_bindgen::prelude::*;
use js_sys::{Uint8Array, JsString, Error, Object, Array, Reflect, BigInt, Set};
use std::collections::{HashMap, BTreeMap, BTreeSet};
pub(crate) use namada::{
    account::{
        InitAccount,
        UpdateAccount,
    },
    address::Address,
    core::borsh::{
        BorshSerialize,
        BorshDeserialize,
    },
    dec::Dec,
    governance::{
        parameters::GovernanceParameters,
        pgf::parameters::PgfParameters,
        storage::{
            proposal::{
                AddRemove,
                StorageProposal,
                InitProposalData,
                VoteProposalData,
                ProposalType,
                PGFAction,
                PGFTarget
            },
            vote::ProposalVote
        },
        utils::{
            ProposalResult,
            TallyResult,
            TallyType,
            Vote,
        }
    },
    hash::Hash,
    key::common::PublicKey,
    ledger::pos::{
        PosParams,
        types::{
            CommissionPair,
            ValidatorMetaData,
            ValidatorState,
            WeightedValidator,
        }
    },
    storage::KeySeg,
    string_encoding::Format,
    token::{
        Amount,
        MaspDigitPos,
        Transfer,
        DenominatedAmount
    },
    tx::{
        Tx, Header, Section, Data, Code, Signature, Signer, MaspBuilder,
        data::{
            Fee,
            GasLimit,
            TxType,
            DecryptedTx,
            WrapperTx,
            pos::{
                BecomeValidator,
                Bond,
                ClaimRewards,
                CommissionChange,
                ConsensusKeyChange,
                MetaDataChange,
                Unbond,
                Withdraw
            },
            pgf::UpdateStewardCommission,
            protocol::{
                ProtocolTx,
                ProtocolTxType,
            }
        }
    },
    state::Epoch
};

mod decode;
mod to_js;

pub use decode::*;

#[macro_export] macro_rules! to_object {
    ($($id:literal = $val:expr, )+) => {
        {
            let object = Object::new();
            $(
                Reflect::set(&object, &$id.into(), &$val.to_js()?)?;
            )+
            object
        }
    }
}
