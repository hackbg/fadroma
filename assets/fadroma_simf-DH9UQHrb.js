import { g as P, __tla as __tla_0 } from "./index-GVCbR69S.js";
import "./index-DsRfobeB.js";
import "./cons-C8nhYyWL.js";
import { __tla as __tla_1 } from "./index-BTPAJTuf.js";
import "./index-CtQ99MjB.js";
let x, l, O, T, Q, q, _t, Z, tt, et, nt, rt, ot;
let __tla = Promise.all([
  (() => {
    try {
      return __tla_0;
    } catch {
    }
  })(),
  (() => {
    try {
      return __tla_1;
    } catch {
    }
  })()
]).then(async () => {
  let _;
  function h(e) {
    const t = _.__externref_table_alloc();
    return _.__wbindgen_externrefs.set(t, e), t;
  }
  function L(e) {
    if (typeof e != "bigint") throw new Error(`expected a bigint argument, found ${typeof e}`);
  }
  function p(e) {
    if (typeof e != "boolean") throw new Error(`expected a boolean argument, found ${typeof e}`);
  }
  function k(e, t) {
    if (!(e instanceof t)) throw new Error(`expected instance of ${t.name}`);
  }
  function a(e) {
    if (typeof e != "number") throw new Error(`expected a number argument, found ${typeof e}`);
  }
  function W(e) {
    const t = typeof e;
    if (t == "number" || t == "boolean" || e == null) return `${e}`;
    if (t == "string") return `"${e}"`;
    if (t == "symbol") {
      const o = e.description;
      return o == null ? "Symbol" : `Symbol(${o})`;
    }
    if (t == "function") {
      const o = e.name;
      return typeof o == "string" && o.length > 0 ? `Function(${o})` : "Function";
    }
    if (Array.isArray(e)) {
      const o = e.length;
      let u = "[";
      o > 0 && (u += W(e[0]));
      for (let c = 1; c < o; c++) u += ", " + W(e[c]);
      return u += "]", u;
    }
    const n = /\[object ([^\]]+)\]/.exec(toString.call(e));
    let r;
    if (n && n.length > 1) r = n[1];
    else return toString.call(e);
    if (r == "Object") try {
      return "Object(" + JSON.stringify(e) + ")";
    } catch {
      return "Object";
    }
    return e instanceof Error ? `${e.name}: ${e.message}
${e.stack}` : r;
  }
  function j(e, t) {
    return e = e >>> 0, S().subarray(e / 1, e / 1 + t);
  }
  let m = null;
  function g() {
    return (m === null || m.buffer.detached === true || m.buffer.detached === void 0 && m.buffer !== _.memory.buffer) && (m = new DataView(_.memory.buffer)), m;
  }
  function d(e, t) {
    return e = e >>> 0, U(e, t);
  }
  let E = null;
  function S() {
    return (E === null || E.byteLength === 0) && (E = new Uint8Array(_.memory.buffer)), E;
  }
  function b(e, t) {
    try {
      return e.apply(this, t);
    } catch (n) {
      const r = h(n);
      _.__wbindgen_exn_store(r);
    }
  }
  function f(e) {
    return e == null;
  }
  function s(e, t) {
    try {
      return e.apply(this, t);
    } catch (n) {
      let r = (function() {
        try {
          return n instanceof Error ? `${n.message}

Stack:
${n.stack}` : n.toString();
        } catch {
          return "<failed to stringify thrown value>";
        }
      })();
      throw console.error("wasm-bindgen: imported JS function that was not marked as `catch` threw an error:", r), n;
    }
  }
  function I(e, t, n) {
    if (typeof e != "string") throw new Error(`expected a string argument, found ${typeof e}`);
    if (n === void 0) {
      const w = A.encode(e), y = t(w.length, 1) >>> 0;
      return S().subarray(y, y + w.length).set(w), v = w.length, y;
    }
    let r = e.length, o = t(r, 1) >>> 0;
    const u = S();
    let c = 0;
    for (; c < r; c++) {
      const w = e.charCodeAt(c);
      if (w > 127) break;
      u[o + c] = w;
    }
    if (c !== r) {
      c !== 0 && (e = e.slice(c)), o = n(o, r, r = c + e.length * 3, 1) >>> 0;
      const w = S().subarray(o + c, o + r), y = A.encodeInto(e, w);
      if (y.read !== e.length) throw new Error("failed to pass whole string");
      c += y.written, o = n(o, r, c, 1) >>> 0;
    }
    return v = c, o;
  }
  function i(e) {
    const t = _.__wbindgen_externrefs.get(e);
    return _.__externref_table_dealloc(e), t;
  }
  let F = new TextDecoder("utf-8", {
    ignoreBOM: true,
    fatal: true
  });
  F.decode();
  const C = 2146435072;
  let R = 0;
  function U(e, t) {
    return R += t, R >= C && (F = new TextDecoder("utf-8", {
      ignoreBOM: true,
      fatal: true
    }), F.decode(), R = t), F.decode(S().subarray(e, e + t));
  }
  const A = new TextEncoder();
  "encodeInto" in A || (A.encodeInto = function(e, t) {
    const n = A.encode(e);
    return t.set(n), {
      read: e.length,
      written: n.length
    };
  });
  let v = 0;
  const z = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((e) => _.__wbg_compiler_free(e >>> 0, 1)), N = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((e) => _.__wbg_keypair_free(e >>> 0, 1)), $ = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((e) => _.__wbg_program_free(e >>> 0, 1)), M = typeof FinalizationRegistry > "u" ? {
    register: () => {
    },
    unregister: () => {
    }
  } : new FinalizationRegistry((e) => _.__wbg_pst_free(e >>> 0, 1));
  x = class {
    constructor() {
      throw new Error("cannot invoke `new` directly");
    }
    static __wrap(t) {
      t = t >>> 0;
      const n = Object.create(x.prototype);
      return n.__wbg_ptr = t, z.register(n, n.__wbg_ptr, n), n;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, z.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      _.__wbg_compiler_free(t, 0);
    }
    compile(t, n) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const r = _.compiler_compile(this.__wbg_ptr, t, n);
      if (r[2]) throw i(r[1]);
      return O.__wrap(r[0]);
    }
  };
  Symbol.dispose && (x.prototype[Symbol.dispose] = x.prototype.free);
  l = class {
    constructor() {
      throw new Error("cannot invoke `new` directly");
    }
    static __wrap(t) {
      t = t >>> 0;
      const n = Object.create(l.prototype);
      return n.__wbg_ptr = t, N.register(n, n.__wbg_ptr, n), n;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, N.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      _.__wbg_keypair_free(t, 0);
    }
    publicKey() {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      return a(this.__wbg_ptr), _.keypair_publicKey(this.__wbg_ptr);
    }
    signEcdsa(t) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      return a(this.__wbg_ptr), _.keypair_signEcdsa(this.__wbg_ptr, t);
    }
    signSchnorr(t) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      return a(this.__wbg_ptr), _.keypair_signSchnorr(this.__wbg_ptr, t);
    }
    xOnlyPublicKey() {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      return a(this.__wbg_ptr), _.keypair_xOnlyPublicKey(this.__wbg_ptr);
    }
  };
  Symbol.dispose && (l.prototype[Symbol.dispose] = l.prototype.free);
  O = class {
    constructor() {
      throw new Error("cannot invoke `new` directly");
    }
    static __wrap(t) {
      t = t >>> 0;
      const n = Object.create(O.prototype);
      return n.__wbg_ptr = t, $.register(n, n.__wbg_ptr, n), n;
    }
    toJSON() {
      return {};
    }
    toString() {
      return JSON.stringify(this);
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, $.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      _.__wbg_program_free(t, 0);
    }
    commitPsbt(t) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const n = _.program_commitPsbt(this.__wbg_ptr, t);
      if (n[2]) throw i(n[1]);
      return i(n[0]);
    }
    paramTypes() {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const t = _.program_paramTypes(this.__wbg_ptr);
      if (t[2]) throw i(t[1]);
      return i(t[0]);
    }
    redeemPsbt(t) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const n = _.program_redeemPsbt(this.__wbg_ptr, t);
      if (n[2]) throw i(n[1]);
      return i(n[0]);
    }
    witnessTypes() {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const t = _.program_witnessTypes(this.__wbg_ptr);
      if (t[2]) throw i(t[1]);
      return i(t[0]);
    }
    redeemSighash(t) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const n = _.program_redeemSighash(this.__wbg_ptr, t);
      if (n[2]) throw i(n[1]);
      return i(n[0]);
    }
    toJSON() {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      return a(this.__wbg_ptr), _.program_toJSON(this.__wbg_ptr);
    }
    redeemTx(t) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const n = _.program_redeemTx(this.__wbg_ptr, t);
      if (n[2]) throw i(n[1]);
      return i(n[0]);
    }
  };
  Symbol.dispose && (O.prototype[Symbol.dispose] = O.prototype.free);
  T = class {
    constructor() {
      throw new Error("cannot invoke `new` directly");
    }
    static __wrap(t) {
      t = t >>> 0;
      const n = Object.create(T.prototype);
      return n.__wbg_ptr = t, M.register(n, n.__wbg_ptr, n), n;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, M.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      _.__wbg_pst_free(t, 0);
    }
    toSignedHex(t) {
      let n, r;
      try {
        if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
        if (a(this.__wbg_ptr), k(t, l), t.__wbg_ptr === 0) throw new Error("Attempt to use a moved value");
        const c = _.pst_toSignedHex(this.__wbg_ptr, t.__wbg_ptr);
        var o = c[0], u = c[1];
        if (c[3]) throw o = 0, u = 0, i(c[2]);
        return n = o, r = u, d(o, u);
      } finally {
        _.__wbindgen_free(n, r, 1);
      }
    }
    toTx() {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const t = _.pst_toTx(this.__wbg_ptr);
      if (t[2]) throw i(t[1]);
      return i(t[0]);
    }
    toPset() {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      a(this.__wbg_ptr);
      const t = _.pst_toPset(this.__wbg_ptr);
      if (t[2]) throw i(t[1]);
      return i(t[0]);
    }
    toSigned(t) {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      if (a(this.__wbg_ptr), k(t, l), t.__wbg_ptr === 0) throw new Error("Attempt to use a moved value");
      const n = _.pst_toSigned(this.__wbg_ptr, t.__wbg_ptr);
      if (n[2]) throw i(n[1]);
      return i(n[0]);
    }
  };
  Symbol.dispose && (T.prototype[Symbol.dispose] = T.prototype.free);
  Q = function(e) {
    const t = _.compiler(e);
    if (t[2]) throw i(t[1]);
    return x.__wrap(t[0]);
  };
  Z = function(e) {
    const t = _.keypair(e);
    if (t[2]) throw i(t[1]);
    return l.__wrap(t[0]);
  };
  tt = function(e) {
    const t = _.paramTypes(e);
    if (t[2]) throw i(t[1]);
    return i(t[0]);
  };
  et = function(e) {
    const t = _.pst(e);
    if (t[2]) throw i(t[1]);
    return T.__wrap(t[0]);
  };
  nt = function(e) {
    const t = _.splitInspect(e);
    if (t[2]) throw i(t[1]);
    return i(t[0]);
  };
  rt = function(e, t) {
    let n, r;
    try {
      if (k(e, l), e.__wbg_ptr === 0) throw new Error("Attempt to use a moved value");
      const c = _.splitSigned(e.__wbg_ptr, t);
      var o = c[0], u = c[1];
      if (c[3]) throw o = 0, u = 0, i(c[2]);
      return n = o, r = u, d(o, u);
    } finally {
      _.__wbindgen_free(n, r, 1);
    }
  };
  ot = function(e) {
    const t = _.witnessTypes(e);
    if (t[2]) throw i(t[1]);
    return i(t[0]);
  };
  const J = /* @__PURE__ */ new Set([
    "basic",
    "cors",
    "default"
  ]);
  async function V(e, t) {
    if (typeof Response == "function" && e instanceof Response) {
      if (typeof WebAssembly.instantiateStreaming == "function") try {
        return await WebAssembly.instantiateStreaming(e, t);
      } catch (r) {
        if (e.ok && J.has(e.type) && e.headers.get("Content-Type") !== "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", r);
        else throw r;
      }
      const n = await e.arrayBuffer();
      return await WebAssembly.instantiate(n, t);
    } else {
      const n = await WebAssembly.instantiate(e, t);
      return n instanceof WebAssembly.Instance ? {
        instance: n,
        module: e
      } : n;
    }
  }
  function B() {
    const e = {};
    return e.wbg = {}, e.wbg.__wbg_Error_52673b7de5a0ca89 = function() {
      return s(function(t, n) {
        return Error(d(t, n));
      }, arguments);
    }, e.wbg.__wbg___wbindgen_bigint_get_as_i64_6e32f5e6aff02e1d = function(t, n) {
      const r = n, o = typeof r == "bigint" ? r : void 0;
      f(o) || L(o), g().setBigInt64(t + 8, f(o) ? BigInt(0) : o, true), g().setInt32(t + 0, !f(o), true);
    }, e.wbg.__wbg___wbindgen_debug_string_adfb662ae34724b6 = function(t, n) {
      const r = W(n), o = I(r, _.__wbindgen_malloc, _.__wbindgen_realloc), u = v;
      g().setInt32(t + 4, u, true), g().setInt32(t + 0, o, true);
    }, e.wbg.__wbg___wbindgen_is_bigint_0e1a2e3f55cfae27 = function(t) {
      const n = typeof t == "bigint";
      return p(n), n;
    }, e.wbg.__wbg___wbindgen_is_falsy_7b9692021c137978 = function(t) {
      const n = !t;
      return p(n), n;
    }, e.wbg.__wbg___wbindgen_is_function_8d400b8b1af978cd = function(t) {
      const n = typeof t == "function";
      return p(n), n;
    }, e.wbg.__wbg___wbindgen_is_object_ce774f3490692386 = function(t) {
      const n = t, r = typeof n == "object" && n !== null;
      return p(r), r;
    }, e.wbg.__wbg___wbindgen_is_string_704ef9c8fc131030 = function(t) {
      const n = typeof t == "string";
      return p(n), n;
    }, e.wbg.__wbg___wbindgen_is_undefined_f6b95eab589e0269 = function(t) {
      const n = t === void 0;
      return p(n), n;
    }, e.wbg.__wbg___wbindgen_jsval_eq_b6101cc9cef1fe36 = function(t, n) {
      const r = t === n;
      return p(r), r;
    }, e.wbg.__wbg___wbindgen_number_get_9619185a74197f95 = function(t, n) {
      const r = n, o = typeof r == "number" ? r : void 0;
      f(o) || a(o), g().setFloat64(t + 8, f(o) ? 0 : o, true), g().setInt32(t + 0, !f(o), true);
    }, e.wbg.__wbg___wbindgen_string_get_a2a31e16edf96e42 = function(t, n) {
      const r = n, o = typeof r == "string" ? r : void 0;
      var u = f(o) ? 0 : I(o, _.__wbindgen_malloc, _.__wbindgen_realloc), c = v;
      g().setInt32(t + 4, c, true), g().setInt32(t + 0, u, true);
    }, e.wbg.__wbg___wbindgen_throw_dd24417ed36fc46e = function(t, n) {
      throw new Error(d(t, n));
    }, e.wbg.__wbg___wbindgen_try_into_number_9d33ffe037a9f5e5 = function(t) {
      let n;
      try {
        n = +t;
      } catch (o) {
        n = o;
      }
      return n;
    }, e.wbg.__wbg___wbindgen_typeof_3cd6f8d7635ec871 = function(t) {
      return typeof t;
    }, e.wbg.__wbg_call_3020136f7a2d6e44 = function() {
      return b(function(t, n, r) {
        return t.call(n, r);
      }, arguments);
    }, e.wbg.__wbg_call_abb4ff46ce38be40 = function() {
      return b(function(t, n) {
        return t.call(n);
      }, arguments);
    }, e.wbg.__wbg_crypto_574e78ad8b13b65f = function() {
      return s(function(t) {
        return t.crypto;
      }, arguments);
    }, e.wbg.__wbg_debug_9d0c87ddda3dc485 = function() {
      return s(function(t) {
        console.debug(t);
      }, arguments);
    }, e.wbg.__wbg_error_7534b8e9a36f1ab4 = function() {
      return s(function(t, n) {
        let r, o;
        try {
          r = t, o = n, console.error(d(t, n));
        } finally {
          _.__wbindgen_free(r, o, 1);
        }
      }, arguments);
    }, e.wbg.__wbg_from_29a8414a7a7cd19d = function() {
      return s(function(t) {
        return Array.from(t);
      }, arguments);
    }, e.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function() {
      return b(function(t, n) {
        t.getRandomValues(n);
      }, arguments);
    }, e.wbg.__wbg_get_6b7bd52aca3f9671 = function() {
      return s(function(t, n) {
        return t[n >>> 0];
      }, arguments);
    }, e.wbg.__wbg_get_af9dab7e9603ea93 = function() {
      return b(function(t, n) {
        return Reflect.get(t, n);
      }, arguments);
    }, e.wbg.__wbg_length_22ac23eaec9d8053 = function() {
      return s(function(t) {
        const n = t.length;
        return a(n), n;
      }, arguments);
    }, e.wbg.__wbg_length_d45040a40c570362 = function() {
      return s(function(t) {
        const n = t.length;
        return a(n), n;
      }, arguments);
    }, e.wbg.__wbg_log_1d990106d99dacb7 = function() {
      return s(function(t) {
        console.log(t);
      }, arguments);
    }, e.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function() {
      return s(function(t) {
        return t.msCrypto;
      }, arguments);
    }, e.wbg.__wbg_new_1ba21ce319a06297 = function() {
      return s(function() {
        return new Object();
      }, arguments);
    }, e.wbg.__wbg_new_8a6f238a6ece86ea = function() {
      return s(function() {
        return new Error();
      }, arguments);
    }, e.wbg.__wbg_new_no_args_cb138f77cf6151ee = function() {
      return s(function(t, n) {
        return new Function(d(t, n));
      }, arguments);
    }, e.wbg.__wbg_new_with_length_aa5eaf41d35235e5 = function() {
      return s(function(t) {
        return new Uint8Array(t >>> 0);
      }, arguments);
    }, e.wbg.__wbg_node_905d3e251edff8a2 = function() {
      return s(function(t) {
        return t.node;
      }, arguments);
    }, e.wbg.__wbg_parse_a09a54cf72639456 = function() {
      return b(function(t, n) {
        return JSON.parse(d(t, n));
      }, arguments);
    }, e.wbg.__wbg_process_dc0fbacc7c1c06f7 = function() {
      return s(function(t) {
        return t.process;
      }, arguments);
    }, e.wbg.__wbg_prototypesetcall_dfe9b766cdc1f1fd = function() {
      return s(function(t, n, r) {
        Uint8Array.prototype.set.call(j(t, n), r);
      }, arguments);
    }, e.wbg.__wbg_randomFillSync_ac0988aba3254290 = function() {
      return b(function(t, n) {
        t.randomFillSync(n);
      }, arguments);
    }, e.wbg.__wbg_require_60cc747a6bc5215a = function() {
      return b(function() {
        return module.require;
      }, arguments);
    }, e.wbg.__wbg_set_169e13b608078b7b = function() {
      return s(function(t, n, r) {
        t.set(j(n, r));
      }, arguments);
    }, e.wbg.__wbg_set_781438a03c0c3c81 = function() {
      return b(function(t, n, r) {
        const o = Reflect.set(t, n, r);
        return p(o), o;
      }, arguments);
    }, e.wbg.__wbg_stack_0ed75d68575b0f3c = function() {
      return s(function(t, n) {
        const r = n.stack, o = I(r, _.__wbindgen_malloc, _.__wbindgen_realloc), u = v;
        g().setInt32(t + 4, u, true), g().setInt32(t + 0, o, true);
      }, arguments);
    }, e.wbg.__wbg_static_accessor_GLOBAL_769e6b65d6557335 = function() {
      return s(function() {
        const t = typeof P > "u" ? null : P;
        return f(t) ? 0 : h(t);
      }, arguments);
    }, e.wbg.__wbg_static_accessor_GLOBAL_THIS_60cf02db4de8e1c1 = function() {
      return s(function() {
        const t = typeof globalThis > "u" ? null : globalThis;
        return f(t) ? 0 : h(t);
      }, arguments);
    }, e.wbg.__wbg_static_accessor_SELF_08f5a74c69739274 = function() {
      return s(function() {
        const t = typeof self > "u" ? null : self;
        return f(t) ? 0 : h(t);
      }, arguments);
    }, e.wbg.__wbg_static_accessor_WINDOW_a8924b26aa92d024 = function() {
      return s(function() {
        const t = typeof window > "u" ? null : window;
        return f(t) ? 0 : h(t);
      }, arguments);
    }, e.wbg.__wbg_stringify_655a6390e1f5eb6b = function() {
      return b(function(t) {
        return JSON.stringify(t);
      }, arguments);
    }, e.wbg.__wbg_subarray_845f2f5bce7d061a = function() {
      return s(function(t, n, r) {
        return t.subarray(n >>> 0, r >>> 0);
      }, arguments);
    }, e.wbg.__wbg_versions_c01dfd4722a88165 = function() {
      return s(function(t) {
        return t.versions;
      }, arguments);
    }, e.wbg.__wbg_warn_6e567d0d926ff881 = function() {
      return s(function(t) {
        console.warn(t);
      }, arguments);
    }, e.wbg.__wbindgen_cast_2241b6af4c4b2941 = function() {
      return s(function(t, n) {
        return d(t, n);
      }, arguments);
    }, e.wbg.__wbindgen_cast_4625c577ab2ec9ee = function() {
      return s(function(t) {
        return BigInt.asUintN(64, t);
      }, arguments);
    }, e.wbg.__wbindgen_cast_cb9088102bce6b30 = function() {
      return s(function(t, n) {
        return j(t, n);
      }, arguments);
    }, e.wbg.__wbindgen_init_externref_table = function() {
      const t = _.__wbindgen_externrefs, n = t.grow(4);
      t.set(0, void 0), t.set(n + 0, void 0), t.set(n + 1, null), t.set(n + 2, true), t.set(n + 3, false);
    }, e;
  }
  function D(e, t) {
    return _ = e.exports, q.__wbindgen_wasm_module = t, m = null, E = null, _.__wbindgen_start(), _;
  }
  _t = function(e) {
    if (_ !== void 0) return _;
    typeof e < "u" && (Object.getPrototypeOf(e) === Object.prototype ? { module: e } = e : console.warn("using deprecated parameters for `initSync()`; pass a single object instead"));
    const t = B();
    e instanceof WebAssembly.Module || (e = new WebAssembly.Module(e));
    const n = new WebAssembly.Instance(e, t);
    return D(n, e);
  };
  q = async function(e) {
    if (_ !== void 0) return _;
    typeof e < "u" && (Object.getPrototypeOf(e) === Object.prototype ? { module_or_path: e } = e : console.warn("using deprecated parameters for the initialization function; pass a single object instead"));
    const t = B();
    (typeof e == "string" || typeof Request == "function" && e instanceof Request || typeof URL == "function" && e instanceof URL) && (e = fetch(e));
    const { instance: n, module: r } = await V(await e, t);
    return D(n, r);
  };
});
export {
  x as Compiler,
  l as Keypair,
  O as Program,
  T as Pst,
  __tla,
  Q as compiler,
  q as default,
  _t as initSync,
  Z as keypair,
  tt as paramTypes,
  et as pst,
  nt as splitInspect,
  rt as splitSigned,
  ot as witnessTypes
};
