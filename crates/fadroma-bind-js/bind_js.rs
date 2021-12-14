/// A binding that exposes one or more wrapped Rust structs to JavaScript.
/// This lets you load a WASM contract in a browser and talk to it from JS.
///
/// Rust doesn't allow for monkey-patching
/// (we can't impl things on things that we don't own),
/// so we need to wrap each struct from the Rust API
/// in our own locally defined struct and expose that to wasm_bindgen.
///
/// From JS-land, the wrapped struct looks like an object
/// containing an opaque pointer to JS memory.
/// This macro also supports adding methods to the binding,
/// which methods will be exposed on the JS object.
#[macro_export] macro_rules! bind_js {

    // Entry point: generates the contents of a `mod wasm`
    // containing all the bindings for running in a browser.

    (
        $($std:ident)::+, /* pass me the path to cosmwasm_std */
        $($mod:ident)::+  /* pass me a module that exports your init, handle and query functions */
    ) => {

        use wasm_bindgen::prelude::*;//{wasm_bindgen, JsValue, js_sys::Function};
        use $($std)::+::*;
        use std::str::from_utf8;

        #[derive(Copy, Clone)]
        pub struct JSApi;

        impl Api for JSApi {
            fn canonical_address (&self, addr: &HumanAddr) -> StdResult<CanonicalAddr> {
                Ok(CanonicalAddr(Binary(Vec::from(addr.as_str()))))
            }
            fn human_address (&self, addr: &CanonicalAddr) -> StdResult<HumanAddr> {
                let trimmed: Vec<u8> = addr.as_slice().iter().cloned()
                    .filter(|&x| x != 0).collect();
                // decode UTF-8 bytes into string
                Ok(HumanAddr(String::from_utf8(trimmed)
                    .map_err(StdError::invalid_utf8)?))
            }
        }

        pub struct JSQuerier {
            pub next_response: Option<Binary>,
            pub callback:      Option<js_sys::Function>
        }

        impl Querier for JSQuerier {
            fn raw_query (&self, bin_request: &[u8]) -> QuerierResult {

                if let Some(response) = &self.next_response {
                    Ok(Ok(response.clone()))

                } else if let Some(callback) = &self.callback {

                    let request = match from_utf8(bin_request) {
                        Ok(v)  => v,
                        Err(e) => return Err(SystemError::InvalidRequest {
                            error:   "could not deserialize request".to_string(),
                            request: to_binary(&format!("{:?} ({})", bin_request, e)).unwrap()
                        })
                    };

                    let result = match callback.call1(
                        &JsValue::null(),
                        &JsValue::from_str(request)
                    ) {
                        Ok(v)  => v,
                        Err(e) => return Err(SystemError::UnsupportedRequest {
                            kind: format!("invoking querier callback failed: {:?}", e).to_string()
                        })
                    };

                    match result.as_string() {
                        Some(v) => Ok(Binary::from_base64(&v)),
                        None => Err(SystemError::InvalidResponse {
                            error:    "querier callback must return b64-encoded JSON (1)".to_string(),
                            response: to_binary("").unwrap()//to_binary(&format!("{:?}", &result)).unwrap()
                        })
                    }

                } else {
                    Ok(Err(StdError::generic_err("querier: no callback or response configured")))
                }

            }
        }

        fadroma_bind_js::bind_js! {

            Contract(Extern<MemoryStorage, JSApi, JSQuerier>, Env) {

                #[wasm_bindgen(constructor)] fn new (
                    addr: String,
                    hash: String
                ) -> Contract {
                    let deps = Extern {
                        storage: MemoryStorage::default(),
                        api:     JSApi {},
                        querier: JSQuerier { next_response: None, callback: None },
                    };
                    let sender = HumanAddr::from("Admin");
                    let address = HumanAddr::from(addr);
                    let contract_code_hash = hash;
                    let env = Env {
                        block:    BlockInfo    { height: 0, time: 0, chain_id: "fadroma".into() },
                        message:  MessageInfo  { sender, sent_funds: vec![] },
                        contract: ContractInfo { address },
                        contract_key: Some("".into()),
                        contract_code_hash
                    };
                    Ok(Self(deps, env))
                }

                #[wasm_bindgen(setter)]
                fn set_sender (&mut self, sender: &[u8]) -> () {
                    match from_slice(&sender) {
                        Err(e) => Err(e.into()),
                        Ok(sender) => {
                            self.1.message.sender = sender;
                            Ok(())
                        }
                    }
                }

                #[wasm_bindgen(setter)]
                fn set_block (&mut self, height: u64) -> () {
                    self.1.block.height = height;
                    Ok(())
                }

                #[wasm_bindgen(getter)]
                fn get_block (&mut self) -> u64 {
                    Ok(self.1.block.height)
                }

                #[wasm_bindgen(setter)]
                fn set_time (&mut self, time: u64) -> () {
                    self.1.block.time = time;
                    Ok(())
                }

                #[wasm_bindgen(getter)]
                fn get_time (&mut self) -> u64 {
                    Ok(self.1.block.time)
                }

                #[wasm_bindgen(setter)]
                fn set_next_query_response (&mut self, response: &[u8]) -> () {
                    self.0.querier.next_response = Some(response.into());
                    Ok(())
                }

                #[wasm_bindgen(getter)]
                fn has_querier_callback (&mut self) -> bool {
                    Ok(self.0.querier.callback.is_some())
                }

                #[wasm_bindgen(setter)]
                fn set_querier_callback (&mut self, callback: &js_sys::Function) -> () {
                    self.0.querier.callback = Some(callback.clone());
                    Ok(())
                }

                fn init (&mut self, msg: &[u8]) -> Vec<u8> {
                    match from_slice(&msg) {
                        Err(e)  => Err(e.into()),
                        Ok(msg) => match $($mod)::+::init(&mut self.0, self.1.clone(), msg) {
                            Err(e)  => Err(e.into()),
                            Ok(res) => match to_vec(&res) {
                                Err(e)  => Err(e.into()),
                                Ok(vec) => Ok(vec)
                            }
                        }
                    }
                }

                fn handle (&mut self, msg: &[u8]) -> Vec<u8> {
                    match from_slice(msg) {
                        Err(e)  => Err(e.into()),
                        Ok(msg) => match $($mod)::+::handle(&mut self.0, self.1.clone(), msg) {
                            Err(e) => Err(e.into()),
                            Ok(res) => match to_vec(&res) {
                                Err(e)  => Err(e.into()),
                                Ok(vec) => Ok(vec)
                            }
                        }
                    }
                }

                fn query (&self, msg: &[u8]) -> Vec<u8> {
                    match from_slice(msg) {
                        Err(e) => Err(e.into()), // stairway to hecc
                        Ok(msg) => match $($mod)::+::query(&self.0, msg) {
                            Err(e) => Err(e.into()),
                            Ok(bin) => Ok(bin.as_slice().into())
                        }
                    }
                }
            }

        }

    };

    // Subroutine: generates every individual struct that is visible from JS,
    // and defines their bound methods.

    ( $(
        $struct:ident // the name of the resulting new binding struct
        $fields:tt    // `(cw::WrapAStruct)` or `{define: Custom, fields: Innit}`

        $({ // if there are any functions defined below
        $(  // each one will be implemented on the new struct

            // 1.             2.             3.               4.           5.
            $(#[$meta:meta])* fn $name:ident ($($args:tt)*) -> $returns:ty $body:block

            // 1. allows attribute macros such as doc strings to pass through
            // 2. `pub` will be added automatically
            // 3. positional arguments of bound function (&self, bla, bla...)
            // 4. the actual return type of the generated function is Result<$returns, JsValue>
            // 5. but the $body must return `Result<$returns, StdError>`, which gets converted to
            //    JsValue via MapErr because we can't implement a conversion trait between two
            //    structs that we do not own

        )+  // end iteration over each input function
        })? // end check for presence of input functions

    )* ) => { $(
        // generate a new struct and derive the wasm_bindgen trait suite for it
        // https://rustwasm.github.io/wasm-bindgen/reference/attributes/on-rust-exports/inspectable.html
        #[wasm_bindgen(inspectable)] pub struct $struct $fields;

        // if there are bound functions wrap em with da `impl` wrapper
        $(#[wasm_bindgen] impl $struct {
            $( // and output each one as a public bound method
            $(#[$meta])* // it's as meta as it gets...
            pub fn $name ($($args)*) -> Result<$returns, JsValue> {
                // single poit of error handling
                $body.map_err(|e: StdError| format!("{:#?}", &e).into())
            })+ // end iteration
        })? // end conditional
    )* };

}
