extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

use js_sys::{Uint8Array, JsString, Error, Object, Array, Reflect, BigInt, Set};

use std::collections::{HashMap, BTreeMap, BTreeSet};

pub(crate) use tendermint_rpc::{
    Response,
    endpoint::{
        block::Response as BlockResponse,
        block_results::Response as BlockResultsResponse,
    }
};

pub(crate) use namada_sdk::{
    account::{
        InitAccount,
        UpdateAccount,
    },
    address::Address,
    borsh::{
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
    parameters::{
        EpochDuration,
        storage::{
            get_epoch_duration_storage_key,
            get_epochs_per_year_key,
            get_gas_cost_key,
            get_gas_scale_key,
            get_implicit_vp_key,
            get_masp_epoch_multiplier_key,
            get_masp_fee_payment_gas_limit_key,
            get_max_block_gas_key,
            get_max_proposal_bytes_key,
            get_max_tx_bytes_key,
            get_native_token_transferable_key,
            get_tx_allowlist_storage_key,
            get_vp_allowlist_storage_key,
        },
    },
    proof_of_stake::{
        PosParams,
        types::{
            CommissionPair,
            ValidatorMetaData,
            ValidatorState,
            ValidatorStateInfo,
            WeightedValidator,
        }
    },
    storage::KeySeg,
    string_encoding::Format,
    tendermint::{
        account::Id as AccountId,
        block::Id as BlockId,
        block::header::Header as BlockHeader,
        block::Height as BlockHeight,
        block::header::Version as BlockVersion,
        chain::Id as ChainId,
        hash::Hash as TendermintHash,
        hash::AppHash,
        time::Time
    },
    token::{
        Account,
        Amount,
        MaspDigitPos,
        DenominatedAmount,
        Transfer,
    },
    tx::{
        Tx, Header as TxHeader,
        Section, Data, Code, Authorization, Signer, MaspBuilder,
        data::{
            Fee,
            GasLimit,
            TxType,
            //WrapperTx,
            pos::{
                BecomeValidator,
                Bond,
                ClaimRewards,
                CommissionChange,
                ConsensusKeyChange,
                MetaDataChange,
                Redelegation,
                Unbond,
                Withdraw
            },
            pgf::UpdateStewardCommission,
            protocol::{
                //ProtocolTx,
                ProtocolTxType,
            }
        }
    },
    state::Epoch
};

mod decode;
mod to_js;
mod tx;
pub use to_js::*;
pub use decode::*;
pub use tx::*;

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

#[macro_export] macro_rules! auto_decode_object {
    ($source:expr => $struct:ident) => { {
        use convert_case::{Case, Casing};
        let data = $struct::try_from_slice(&$source)
            .map_err(|e|JsValue::from(Error::new(&format!("{e}"))))?;
        let json = serde_json::to_string(&data)
            .map_err(|e|JsValue::from(Error::new(&format!("{e}"))))?;
        let result = js_sys::JSON::parse(&json)?
            .dyn_into::<Object>()?;
        let object = Object::new();
        Object::entries(&result).for_each(&mut |kv: JsValue, _, _| {
            let kv = kv.dyn_into::<Array>()
                .expect("internal error: failed to downcast into array [k, v]");
            if let Some(key) = kv.get(0).as_string() {
                let key = key.to_case(Case::Camel);
                Reflect::set(&object, &key.into(), &kv.get(1))
                    .expect("internal error: failed to set object property");
            }
        });
        Ok(object)
    } }
}
