use bech32::{ToBase32, Variant};
use ripemd::Ripemd160;
use sha2::{Sha256, Digest};

use crate::{
    cosmwasm_std::{
        Uint128, Deps, CanonicalAddr, Binary,
        StdResult, StdError, to_binary
    },
    serde::{Serialize, Deserialize},
    schemars::{self, JsonSchema}
};
use super::{Permission, PermitParams};

/// The type the represents a signed permit. You shouldn't try to instantiate
/// this type yourself unless you are writing test code. Rather you set this
/// as a parameter in your contract query functions that you wish to authenticate.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub struct Permit<P: Permission> {
    pub params: PermitParams<P>,
    signature: PermitSignature
}

impl<P: Permission> Permit<P> {
    #[inline]
    pub fn signature(&self) -> &Binary {
        &self.signature.signature
    }

    #[inline]
    pub fn pubkey(&self) -> &Binary {
        &self.signature.pub_key.value
    }

    pub(super) fn validate_impl(
        &self,
        deps: Deps,
        current_contract_addr: &str,
        hrp: Option<&str>,
    ) -> StdResult<String> {
        if !self.is_for_contract(current_contract_addr) {
            return Err(StdError::generic_err(
                self.wrong_contract_err(current_contract_addr)
            ));
        }

        // Derive account from pubkey
        let account_hrp = hrp.unwrap_or("secret");
        let base32_addr = self.pubkey_to_account().as_slice().to_base32();
        let account: String = bech32::encode(account_hrp, base32_addr, Variant::Bech32).unwrap();

        Self::assert_not_revoked(deps.storage, &account, &self.params.permit_name)?;

        // Validate signature, reference: https://github.com/enigmampc/SecretNetwork/blob/f591ed0cb3af28608df3bf19d6cfb733cca48100/cosmwasm/packages/wasmi-runtime/src/crypto/secp256k1.rs#L49-L82
        let signed_bytes = to_binary(&SignedPermit::from_params(&self.params))?;
        let signed_bytes_hash = Sha256::digest(signed_bytes.as_slice());

        let success = deps.api
            .secp256k1_verify(&signed_bytes_hash, self.signature(), self.pubkey())
            .map_err(|err| StdError::generic_err(err.to_string()))?;

        if success {
            Ok(account)
        } else {
            Err(StdError::generic_err(
                "Failed to verify signatures for the given permit",
            ))
        }
    }

    #[inline]
    fn pubkey_to_account(&self) -> CanonicalAddr {
        let mut hasher = Ripemd160::new();
        hasher.update(Sha256::digest(self.pubkey().as_slice()));

        CanonicalAddr(Binary(hasher.finalize().to_vec()))
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct PermitSignature {
    pub_key: PubKey,
    signature: Binary,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct PubKey {
    /// ignored, but must be "tendermint/PubKeySecp256k1" otherwise the verification will fail
    r#type: String,
    /// Secp256k1 PubKey
    value: Binary,
}

// Note: The order of fields in this struct is important for the permit signature verification!
#[remain::sorted]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct SignedPermit<P: Permission> {
    /// ignored
    account_number: Uint128,
    /// ignored, no Env in query
    chain_id: String,
    /// ignored
    fee: Fee,
    /// ignored
    memo: String,
    /// the signed message
    msgs: Vec<PermitMsg<P>>,
    /// ignored
    sequence: Uint128,
}

// Note: The order of fields in this struct is important for the permit signature verification!
#[remain::sorted]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct Fee {
    amount: Vec<Coin>,
    gas: Uint128,
}

// Note: The order of fields in this struct is important for the permit signature verification!
#[remain::sorted]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct Coin {
    amount: Uint128,
    denom: String,
}

// Note: The order of fields in this struct is important for the permit signature verification!
#[remain::sorted]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct PermitMsg<P: Permission> {
    r#type: String,
    value: PermitContent<P>,
}

// Note: The order of fields in this struct is important for the permit signature verification!
#[remain::sorted]
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
struct PermitContent<P: Permission> {
    allowed_tokens: Vec<String>,
    permissions: Vec<P>,
    permit_name: String,
}

impl<P: Permission> SignedPermit<P> {
    fn from_params(params: &PermitParams<P>) -> Self {
        Self {
            account_number: Uint128::zero(),
            chain_id: params.chain_id.clone(),
            fee: Fee::new(),
            memo: String::new(),
            msgs: vec![PermitMsg::from_content(PermitContent::from_params(params))],
            sequence: Uint128::zero(),
        }
    }
}

impl Fee {
    pub fn new() -> Self {
        Self {
            amount: vec![Coin::new()],
            gas: Uint128::new(1),
        }
    }
}

impl Coin {
    pub fn new() -> Self {
        Self {
            amount: Uint128::zero(),
            denom: "uscrt".to_string(),
        }
    }
}

impl<P: Permission> PermitMsg<P> {
    fn from_content(content: PermitContent<P>) -> Self {
        Self {
            r#type: "query_permit".to_string(),
            value: content,
        }
    }
}

impl<P: Permission> PermitContent<P> {
    pub fn from_params(params: &PermitParams<P>) -> Self {
        Self {
            allowed_tokens: params.allowed_tokens.clone(),
            permit_name: params.permit_name.clone(),
            permissions: params.permissions.clone(),
        }
    }
}
