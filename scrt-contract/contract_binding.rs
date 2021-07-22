/// λ binding that exposes a wrapped Rust structs to JavaScript,
/// which allow for interfacing with the WASM smart contract.
///
/// Rust doesn't allow for monkey-patching
/// (we can't impl things on things that we don't own),
/// so we need to wrap each struct from the Rust API
/// in our own locally defined struct and expose that to wasm_bindgen.
///
/// From JS-land, tthe wrapped struct looks like an object
/// containing an opaque pointer to JS memory.
/// This macro also supports adding methods to the binding,
/// which methods will be exposed on the JS object.
// Macros are truly a blessing in the disguise of a curse.
//
// * `attempted to repeat an expression containing no syntax variables matched
//   as repeating at this depth` - best error message ever.
// * or `this file contains an unclosed delimiter` (but it already
//   optimized away that info by design so now we don't know where)
// * or `repetition matches empty token tree` - jeez rustc, are you
//   gonna loop back on yourself if you do that?!
#[macro_export] macro_rules! binding {

    // Entry point - generates module with all bindings
    // Arguments are methods and corresponding request/response types
    (
        $mod:ident, 
        $Init:path, $TX:path, $Q:path, $Response:path
    ) => {

        /// WASM entry points for running on chain.
        // Similar in spirit to [`create_entry_points`](https://docs.rs/cosmwasm-std/0.10.1/src/cosmwasm_std/entry_points.rs.html#49),
        // but doesn't need the implementation to be in a sibling module (the `super::contract` on L65)
        // TODO custom `migrate` for SecretNetwork
        #[cfg(all(not(feature = "browser"), target_arch = "wasm32"))] mod wasm {
            use fadroma::scrt::cosmwasm_std::{
                ExternalStorage as Storage, ExternalApi as Api, ExternalQuerier as Querier,
                do_init, do_handle, do_query
            };
            #[no_mangle] extern "C" fn init (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_init($mod::init::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn handle (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_handle($mod::handle::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn query (msg_ptr: u32) -> u32 {
                do_query($mod::query::<Storage, Api, Querier>, msg_ptr,)
            }
            // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
            // automatically because we `use cosmwasm_std`.
        }

        /// WASM entry points for running in browser with stub chain
        #[cfg(all(feature = "browser", target_arch = "wasm32"))] mod wasm {

            use wasm_bindgen::prelude::{wasm_bindgen, JsValue};
            use fadroma::scrt::cosmwasm_std as cw;
            use fadroma::scrt::contract::binding;

            // TODO: minimal implementations of these
            #[wasm_bindgen] #[derive(Copy, Clone)] pub struct Api {}
            impl cw::Api for Api {
                fn canonical_address (&self, addr: &cw::HumanAddr) -> cw::StdResult<cw::CanonicalAddr> {
                    Ok(cw::CanonicalAddr(cw::Binary(Vec::from(addr.as_str()))))
                }
                fn human_address (&self, addr: &cw::CanonicalAddr) -> cw::StdResult<cw::HumanAddr> {
                    let trimmed: Vec<u8> = addr.as_slice().iter().cloned().filter(|&x| x != 0).collect();
                    // decode UTF-8 bytes into string
                    Ok(cw::HumanAddr(String::from_utf8(trimmed).map_err(cw::StdError::invalid_utf8)?))
                }
            }

            #[wasm_bindgen] pub struct Querier {}
            impl cw::Querier for Querier {
                fn raw_query (&self, bin_request: &[u8]) -> cw::QuerierResult {
                    Ok(cw::to_binary(&[] as &[u8]))
                }
            }

            binding! {

                HumanAddr(cw::HumanAddr)

                CanonicalAddr(cw::CanonicalAddr)

                Env(cw::Env) {
                    #[wasm_bindgen(constructor)] fn new (height: u64) -> Env {
                        Ok(Env(cw::Env {
                            block: cw::BlockInfo {
                                height,
                                time: height * 5,
                                chain_id: "".into()
                            },
                            message: cw::MessageInfo {
                                sender:     cw::HumanAddr::from(""),
                                sent_funds: vec![]
                            },
                            contract: cw::ContractInfo {
                                address: cw::HumanAddr::from("")
                            },
                            contract_key: Some("".into()),
                            contract_code_hash: "".into()
                        }))
                    }
                }

                InitMsg($Init) {
                    #[wasm_bindgen(constructor)] fn new (json: &[u8]) -> InitMsg {
                        cw::from_slice(json).map(|msg|InitMsg(msg))
                    }
                }

                InitResponse(cw::InitResponse)

                HandleMsg($TX) {
                    #[wasm_bindgen(constructor)] fn new (json: &[u8]) -> HandleMsg {
                        cw::from_slice(json).map(|msg|HandleMsg(msg))
                    }
                }

                HandleResponse(cw::HandleResponse)

                QueryMsg($Q) {
                    #[wasm_bindgen(constructor)] fn new (json: &[u8]) -> QueryMsg {
                        cw::from_slice(json).map(|msg|QueryMsg(msg))
                    }
                }

                QueryResponse($Response)

                Contract(cw::Extern<cw::MemoryStorage, Api, Querier> /* ha! */) {
                    #[wasm_bindgen(constructor)] fn new () -> Contract {
                        Ok(Self(cw::Extern {
                            storage:  cw::MemoryStorage::default(),
                            api:      Api {},
                            querier:  Querier {}
                        }))
                    }
                    fn init (&mut self, env: Env, msg: InitMsg) -> InitResponse {
                        $mod::init(&mut self.0, env.0, msg.0).map(|res|InitResponse(res))
                    }
                    fn handle (&mut self, env: Env, msg: HandleMsg) -> HandleResponse {
                        $mod::handle(&mut self.0, env.0, msg.0).map(|res|HandleResponse(res))
                    }
                    fn query (&self, msg: QueryMsg) -> QueryResponse {
                        match $mod::query(&self.0, msg.0) {
                            Ok(res) => cw::from_binary(&res).map(|res|QueryResponse(res)),
                            Err(e) => Err(e)
                        }
                    }
                }

            }

        }

    };

    // Generate single binding
    ( $(
        $struct:ident // the name of the resulting new binding struct
        $fields:tt    // `(cw::WrapAStruct)` or `{define: Custom, fields: Innit}`

        $({ // if there are any functions defined below
        $(  // each one will be implemented on the new struct
            $(#[$meta:meta])* // allowing doc strings, marking as constructor, etc
            fn $name:ident    // with as single point of adding `pub` marker
            ($($args:tt)*) -> // and positional arguments from JS-land
            $returns:ty       // with return type wrapped for error handling
            $body:block       // and an implementation that returns `Ok($returns)`
        )+  // end iteration over each input function
        })? // end check for presence of input functions

    )* ) => { $(
        // generate a new struct and derive the wasm_bindgen trait suite for it
        #[wasm_bindgen] pub struct $struct $fields;

        // if there are bound functions wrap em with da `impl` wrapper
        $(#[wasm_bindgen] impl $struct {
            $( // and output each one as a public bound method
            $(#[$meta])* // it's as meta as it gets...
            pub fn $name ($($args)*) -> Result<$returns, JsValue> {
                $body.map_err(|e: cw::StdError| format!("{:#?}", &e).into())
            })+ // end iteration
        })? // end conditional
    )* };

}
