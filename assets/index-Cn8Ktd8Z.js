import { c as we, B as He, g as Dt, a as Ut } from "./index-CtQ99MjB.js";
import he from "./index-DsRfobeB.js";
import { r as qt, b as je, d as ir, f as kt, h as Wt, __tla as __tla_0 } from "./index-GVCbR69S.js";
import { _ as yn } from "./__vite-browser-external-D7Ct-6yo.js";
let Ri;
let __tla = Promise.all([
  (() => {
    try {
      return __tla_0;
    } catch {
    }
  })()
]).then(async () => {
  function gn(n, m) {
    for (var i = 0; i < m.length; i++) {
      const T = m[i];
      if (typeof T != "string" && !Array.isArray(T)) {
        for (const U in T) if (U !== "default" && !(U in n)) {
          const b = Object.getOwnPropertyDescriptor(T, U);
          b && Object.defineProperty(n, U, b.get ? b : {
            enumerable: true,
            get: () => T[U]
          });
        }
      }
    }
    return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, {
      value: "Module"
    }));
  }
  var sr = {}, cr = {
    exports: {}
  }, hr = {}, Xr;
  function Ht() {
    return Xr || (Xr = 1, (function(n) {
      n.fetch = U(we.fetch) && U(we.ReadableStream), n.writableStream = U(we.WritableStream), n.abortController = U(we.AbortController);
      var m;
      function i() {
        if (m !== void 0) return m;
        if (we.XMLHttpRequest) {
          m = new we.XMLHttpRequest();
          try {
            m.open("GET", we.XDomainRequest ? "/" : "https://example.com");
          } catch {
            m = null;
          }
        } else m = null;
        return m;
      }
      function T(b) {
        var A = i();
        if (!A) return false;
        try {
          return A.responseType = b, A.responseType === b;
        } catch {
        }
        return false;
      }
      n.arraybuffer = n.fetch || T("arraybuffer"), n.msstream = !n.fetch && T("ms-stream"), n.mozchunkedarraybuffer = !n.fetch && T("moz-chunked-arraybuffer"), n.overrideMimeType = n.fetch || (i() ? U(i().overrideMimeType) : false);
      function U(b) {
        return typeof b == "function";
      }
      m = null;
    })(hr)), hr;
  }
  var er = {}, rr = {
    exports: {}
  }, tr = {
    exports: {}
  }, Qr;
  function jt() {
    if (Qr) return tr.exports;
    Qr = 1;
    var n = typeof Reflect == "object" ? Reflect : null, m = n && typeof n.apply == "function" ? n.apply : function(c, E, h) {
      return Function.prototype.apply.call(c, E, h);
    }, i;
    n && typeof n.ownKeys == "function" ? i = n.ownKeys : Object.getOwnPropertySymbols ? i = function(c) {
      return Object.getOwnPropertyNames(c).concat(Object.getOwnPropertySymbols(c));
    } : i = function(c) {
      return Object.getOwnPropertyNames(c);
    };
    function T(y) {
      console && console.warn && console.warn(y);
    }
    var U = Number.isNaN || function(c) {
      return c !== c;
    };
    function b() {
      b.init.call(this);
    }
    tr.exports = b, tr.exports.once = s, b.EventEmitter = b, b.prototype._events = void 0, b.prototype._eventsCount = 0, b.prototype._maxListeners = void 0;
    var A = 10;
    function o(y) {
      if (typeof y != "function") throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof y);
    }
    Object.defineProperty(b, "defaultMaxListeners", {
      enumerable: true,
      get: function() {
        return A;
      },
      set: function(y) {
        if (typeof y != "number" || y < 0 || U(y)) throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + y + ".");
        A = y;
      }
    }), b.init = function() {
      (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) && (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0), this._maxListeners = this._maxListeners || void 0;
    }, b.prototype.setMaxListeners = function(c) {
      if (typeof c != "number" || c < 0 || U(c)) throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + c + ".");
      return this._maxListeners = c, this;
    };
    function R(y) {
      return y._maxListeners === void 0 ? b.defaultMaxListeners : y._maxListeners;
    }
    b.prototype.getMaxListeners = function() {
      return R(this);
    }, b.prototype.emit = function(c) {
      for (var E = [], h = 1; h < arguments.length; h++) E.push(arguments[h]);
      var g = c === "error", L = this._events;
      if (L !== void 0) g = g && L.error === void 0;
      else if (!g) return false;
      if (g) {
        var q;
        if (E.length > 0 && (q = E[0]), q instanceof Error) throw q;
        var $ = new Error("Unhandled error." + (q ? " (" + q.message + ")" : ""));
        throw $.context = q, $;
      }
      var x = L[c];
      if (x === void 0) return false;
      if (typeof x == "function") m(x, this, E);
      else for (var z = x.length, Q = w(x, z), h = 0; h < z; ++h) m(Q[h], this, E);
      return true;
    };
    function _(y, c, E, h) {
      var g, L, q;
      if (o(E), L = y._events, L === void 0 ? (L = y._events = /* @__PURE__ */ Object.create(null), y._eventsCount = 0) : (L.newListener !== void 0 && (y.emit("newListener", c, E.listener ? E.listener : E), L = y._events), q = L[c]), q === void 0) q = L[c] = E, ++y._eventsCount;
      else if (typeof q == "function" ? q = L[c] = h ? [
        E,
        q
      ] : [
        q,
        E
      ] : h ? q.unshift(E) : q.push(E), g = R(y), g > 0 && q.length > g && !q.warned) {
        q.warned = true;
        var $ = new Error("Possible EventEmitter memory leak detected. " + q.length + " " + String(c) + " listeners added. Use emitter.setMaxListeners() to increase limit");
        $.name = "MaxListenersExceededWarning", $.emitter = y, $.type = c, $.count = q.length, T($);
      }
      return y;
    }
    b.prototype.addListener = function(c, E) {
      return _(this, c, E, false);
    }, b.prototype.on = b.prototype.addListener, b.prototype.prependListener = function(c, E) {
      return _(this, c, E, true);
    };
    function d() {
      if (!this.fired) return this.target.removeListener(this.type, this.wrapFn), this.fired = true, arguments.length === 0 ? this.listener.call(this.target) : this.listener.apply(this.target, arguments);
    }
    function S(y, c, E) {
      var h = {
        fired: false,
        wrapFn: void 0,
        target: y,
        type: c,
        listener: E
      }, g = d.bind(h);
      return g.listener = E, h.wrapFn = g, g;
    }
    b.prototype.once = function(c, E) {
      return o(E), this.on(c, S(this, c, E)), this;
    }, b.prototype.prependOnceListener = function(c, E) {
      return o(E), this.prependListener(c, S(this, c, E)), this;
    }, b.prototype.removeListener = function(c, E) {
      var h, g, L, q, $;
      if (o(E), g = this._events, g === void 0) return this;
      if (h = g[c], h === void 0) return this;
      if (h === E || h.listener === E) --this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : (delete g[c], g.removeListener && this.emit("removeListener", c, h.listener || E));
      else if (typeof h != "function") {
        for (L = -1, q = h.length - 1; q >= 0; q--) if (h[q] === E || h[q].listener === E) {
          $ = h[q].listener, L = q;
          break;
        }
        if (L < 0) return this;
        L === 0 ? h.shift() : C(h, L), h.length === 1 && (g[c] = h[0]), g.removeListener !== void 0 && this.emit("removeListener", c, $ || E);
      }
      return this;
    }, b.prototype.off = b.prototype.removeListener, b.prototype.removeAllListeners = function(c) {
      var E, h, g;
      if (h = this._events, h === void 0) return this;
      if (h.removeListener === void 0) return arguments.length === 0 ? (this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0) : h[c] !== void 0 && (--this._eventsCount === 0 ? this._events = /* @__PURE__ */ Object.create(null) : delete h[c]), this;
      if (arguments.length === 0) {
        var L = Object.keys(h), q;
        for (g = 0; g < L.length; ++g) q = L[g], q !== "removeListener" && this.removeAllListeners(q);
        return this.removeAllListeners("removeListener"), this._events = /* @__PURE__ */ Object.create(null), this._eventsCount = 0, this;
      }
      if (E = h[c], typeof E == "function") this.removeListener(c, E);
      else if (E !== void 0) for (g = E.length - 1; g >= 0; g--) this.removeListener(c, E[g]);
      return this;
    };
    function M(y, c, E) {
      var h = y._events;
      if (h === void 0) return [];
      var g = h[c];
      return g === void 0 ? [] : typeof g == "function" ? E ? [
        g.listener || g
      ] : [
        g
      ] : E ? p(g) : w(g, g.length);
    }
    b.prototype.listeners = function(c) {
      return M(this, c, true);
    }, b.prototype.rawListeners = function(c) {
      return M(this, c, false);
    }, b.listenerCount = function(y, c) {
      return typeof y.listenerCount == "function" ? y.listenerCount(c) : D.call(y, c);
    }, b.prototype.listenerCount = D;
    function D(y) {
      var c = this._events;
      if (c !== void 0) {
        var E = c[y];
        if (typeof E == "function") return 1;
        if (E !== void 0) return E.length;
      }
      return 0;
    }
    b.prototype.eventNames = function() {
      return this._eventsCount > 0 ? i(this._events) : [];
    };
    function w(y, c) {
      for (var E = new Array(c), h = 0; h < c; ++h) E[h] = y[h];
      return E;
    }
    function C(y, c) {
      for (; c + 1 < y.length; c++) y[c] = y[c + 1];
      y.pop();
    }
    function p(y) {
      for (var c = new Array(y.length), E = 0; E < c.length; ++E) c[E] = y[E].listener || y[E];
      return c;
    }
    function s(y, c) {
      return new Promise(function(E, h) {
        function g(q) {
          y.removeListener(c, L), h(q);
        }
        function L() {
          typeof y.removeListener == "function" && y.removeListener("error", g), E([].slice.call(arguments));
        }
        v(y, c, L, {
          once: true
        }), c !== "error" && f(y, g, {
          once: true
        });
      });
    }
    function f(y, c, E) {
      typeof y.on == "function" && v(y, "error", c, E);
    }
    function v(y, c, E, h) {
      if (typeof y.on == "function") h.once ? y.once(c, E) : y.on(c, E);
      else if (typeof y.addEventListener == "function") y.addEventListener(c, function g(L) {
        h.once && y.removeEventListener(c, g), E(L);
      });
      else throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof y);
    }
    return tr.exports;
  }
  var dr, Jr;
  function $t() {
    return Jr || (Jr = 1, dr = jt().EventEmitter), dr;
  }
  var pr = {}, Zr;
  function ar() {
    return Zr || (Zr = 1, (function(n) {
      Object.defineProperties(n, {
        __esModule: {
          value: true
        },
        [Symbol.toStringTag]: {
          value: "Module"
        }
      });
      var m = {}, i = {};
      i.byteLength = d, i.toByteArray = M, i.fromByteArray = C;
      for (var T = [], U = [], b = typeof Uint8Array < "u" ? Uint8Array : Array, A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", o = 0, R = A.length; o < R; ++o) T[o] = A[o], U[A.charCodeAt(o)] = o;
      U[45] = 62, U[95] = 63;
      function _(f) {
        var v = f.length;
        if (v % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
        var y = f.indexOf("=");
        y === -1 && (y = v);
        var c = y === v ? 0 : 4 - y % 4;
        return [
          y,
          c
        ];
      }
      function d(f) {
        var v = _(f), y = v[0], c = v[1];
        return (y + c) * 3 / 4 - c;
      }
      function S(f, v, y) {
        return (v + y) * 3 / 4 - y;
      }
      function M(f) {
        var v, y = _(f), c = y[0], E = y[1], h = new b(S(f, c, E)), g = 0, L = E > 0 ? c - 4 : c, q;
        for (q = 0; q < L; q += 4) v = U[f.charCodeAt(q)] << 18 | U[f.charCodeAt(q + 1)] << 12 | U[f.charCodeAt(q + 2)] << 6 | U[f.charCodeAt(q + 3)], h[g++] = v >> 16 & 255, h[g++] = v >> 8 & 255, h[g++] = v & 255;
        return E === 2 && (v = U[f.charCodeAt(q)] << 2 | U[f.charCodeAt(q + 1)] >> 4, h[g++] = v & 255), E === 1 && (v = U[f.charCodeAt(q)] << 10 | U[f.charCodeAt(q + 1)] << 4 | U[f.charCodeAt(q + 2)] >> 2, h[g++] = v >> 8 & 255, h[g++] = v & 255), h;
      }
      function D(f) {
        return T[f >> 18 & 63] + T[f >> 12 & 63] + T[f >> 6 & 63] + T[f & 63];
      }
      function w(f, v, y) {
        for (var c, E = [], h = v; h < y; h += 3) c = (f[h] << 16 & 16711680) + (f[h + 1] << 8 & 65280) + (f[h + 2] & 255), E.push(D(c));
        return E.join("");
      }
      function C(f) {
        for (var v, y = f.length, c = y % 3, E = [], h = 16383, g = 0, L = y - c; g < L; g += h) E.push(w(f, g, g + h > L ? L : g + h));
        return c === 1 ? (v = f[y - 1], E.push(T[v >> 2] + T[v << 4 & 63] + "==")) : c === 2 && (v = (f[y - 2] << 8) + f[y - 1], E.push(T[v >> 10] + T[v >> 4 & 63] + T[v << 2 & 63] + "=")), E.join("");
      }
      var p = {};
      p.read = function(f, v, y, c, E) {
        var h, g, L = E * 8 - c - 1, q = (1 << L) - 1, $ = q >> 1, x = -7, z = y ? E - 1 : 0, Q = y ? -1 : 1, Z = f[v + z];
        for (z += Q, h = Z & (1 << -x) - 1, Z >>= -x, x += L; x > 0; h = h * 256 + f[v + z], z += Q, x -= 8) ;
        for (g = h & (1 << -x) - 1, h >>= -x, x += c; x > 0; g = g * 256 + f[v + z], z += Q, x -= 8) ;
        if (h === 0) h = 1 - $;
        else {
          if (h === q) return g ? NaN : (Z ? -1 : 1) * (1 / 0);
          g = g + Math.pow(2, c), h = h - $;
        }
        return (Z ? -1 : 1) * g * Math.pow(2, h - c);
      }, p.write = function(f, v, y, c, E, h) {
        var g, L, q, $ = h * 8 - E - 1, x = (1 << $) - 1, z = x >> 1, Q = E === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, Z = c ? 0 : h - 1, J = c ? 1 : -1, se = v < 0 || v === 0 && 1 / v < 0 ? 1 : 0;
        for (v = Math.abs(v), isNaN(v) || v === 1 / 0 ? (L = isNaN(v) ? 1 : 0, g = x) : (g = Math.floor(Math.log(v) / Math.LN2), v * (q = Math.pow(2, -g)) < 1 && (g--, q *= 2), g + z >= 1 ? v += Q / q : v += Q * Math.pow(2, 1 - z), v * q >= 2 && (g++, q /= 2), g + z >= x ? (L = 0, g = x) : g + z >= 1 ? (L = (v * q - 1) * Math.pow(2, E), g = g + z) : (L = v * Math.pow(2, z - 1) * Math.pow(2, E), g = 0)); E >= 8; f[y + Z] = L & 255, Z += J, L /= 256, E -= 8) ;
        for (g = g << E | L, $ += E; $ > 0; f[y + Z] = g & 255, Z += J, g /= 256, $ -= 8) ;
        f[y + Z - J] |= se * 128;
      };
      (function(f) {
        const v = i, y = p, c = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom") : null;
        f.Buffer = x, f.SlowBuffer = oe, f.INSPECT_MAX_BYTES = 50;
        const E = 2147483647;
        f.kMaxLength = E;
        const { Uint8Array: h, ArrayBuffer: g, SharedArrayBuffer: L } = globalThis;
        x.TYPED_ARRAY_SUPPORT = q(), !x.TYPED_ARRAY_SUPPORT && typeof console < "u" && typeof console.error == "function" && console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support.");
        function q() {
          try {
            const t = new h(1), e = {
              foo: function() {
                return 42;
              }
            };
            return Object.setPrototypeOf(e, h.prototype), Object.setPrototypeOf(t, e), t.foo() === 42;
          } catch {
            return false;
          }
        }
        Object.defineProperty(x.prototype, "parent", {
          enumerable: true,
          get: function() {
            if (x.isBuffer(this)) return this.buffer;
          }
        }), Object.defineProperty(x.prototype, "offset", {
          enumerable: true,
          get: function() {
            if (x.isBuffer(this)) return this.byteOffset;
          }
        });
        function $(t) {
          if (t > E) throw new RangeError('The value "' + t + '" is invalid for option "size"');
          const e = new h(t);
          return Object.setPrototypeOf(e, x.prototype), e;
        }
        function x(t, e, r) {
          if (typeof t == "number") {
            if (typeof e == "string") throw new TypeError('The "string" argument must be of type string. Received type number');
            return J(t);
          }
          return z(t, e, r);
        }
        x.poolSize = 8192;
        function z(t, e, r) {
          if (typeof t == "string") return se(t, e);
          if (g.isView(t)) return le(t);
          if (t == null) throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof t);
          if (Ee(t, g) || t && Ee(t.buffer, g) || typeof L < "u" && (Ee(t, L) || t && Ee(t.buffer, L))) return K(t, e, r);
          if (typeof t == "number") throw new TypeError('The "value" argument must not be of type number. Received type number');
          const u = t.valueOf && t.valueOf();
          if (u != null && u !== t) return x.from(u, e, r);
          const O = Y(t);
          if (O) return O;
          if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof t[Symbol.toPrimitive] == "function") return x.from(t[Symbol.toPrimitive]("string"), e, r);
          throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof t);
        }
        x.from = function(t, e, r) {
          return z(t, e, r);
        }, Object.setPrototypeOf(x.prototype, h.prototype), Object.setPrototypeOf(x, h);
        function Q(t) {
          if (typeof t != "number") throw new TypeError('"size" argument must be of type number');
          if (t < 0) throw new RangeError('The value "' + t + '" is invalid for option "size"');
        }
        function Z(t, e, r) {
          return Q(t), t <= 0 ? $(t) : e !== void 0 ? typeof r == "string" ? $(t).fill(e, r) : $(t).fill(e) : $(t);
        }
        x.alloc = function(t, e, r) {
          return Z(t, e, r);
        };
        function J(t) {
          return Q(t), $(t < 0 ? 0 : ee(t) | 0);
        }
        x.allocUnsafe = function(t) {
          return J(t);
        }, x.allocUnsafeSlow = function(t) {
          return J(t);
        };
        function se(t, e) {
          if ((typeof e != "string" || e === "") && (e = "utf8"), !x.isEncoding(e)) throw new TypeError("Unknown encoding: " + e);
          const r = fe(t, e) | 0;
          let u = $(r);
          const O = u.write(t, e);
          return O !== r && (u = u.slice(0, O)), u;
        }
        function j(t) {
          const e = t.length < 0 ? 0 : ee(t.length) | 0, r = $(e);
          for (let u = 0; u < e; u += 1) r[u] = t[u] & 255;
          return r;
        }
        function le(t) {
          if (Ee(t, h)) {
            const e = new h(t);
            return K(e.buffer, e.byteOffset, e.byteLength);
          }
          return j(t);
        }
        function K(t, e, r) {
          if (e < 0 || t.byteLength < e) throw new RangeError('"offset" is outside of buffer bounds');
          if (t.byteLength < e + (r || 0)) throw new RangeError('"length" is outside of buffer bounds');
          let u;
          return e === void 0 && r === void 0 ? u = new h(t) : r === void 0 ? u = new h(t, e) : u = new h(t, e, r), Object.setPrototypeOf(u, x.prototype), u;
        }
        function Y(t) {
          if (x.isBuffer(t)) {
            const e = ee(t.length) | 0, r = $(e);
            return r.length === 0 || t.copy(r, 0, 0, e), r;
          }
          if (t.length !== void 0) return typeof t.length != "number" || Re(t.length) ? $(0) : j(t);
          if (t.type === "Buffer" && Array.isArray(t.data)) return j(t.data);
        }
        function ee(t) {
          if (t >= E) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + E.toString(16) + " bytes");
          return t | 0;
        }
        function oe(t) {
          return +t != t && (t = 0), x.alloc(+t);
        }
        x.isBuffer = function(e) {
          return e != null && e._isBuffer === true && e !== x.prototype;
        }, x.compare = function(e, r) {
          if (Ee(e, h) && (e = x.from(e, e.offset, e.byteLength)), Ee(r, h) && (r = x.from(r, r.offset, r.byteLength)), !x.isBuffer(e) || !x.isBuffer(r)) throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
          if (e === r) return 0;
          let u = e.length, O = r.length;
          for (let N = 0, k = Math.min(u, O); N < k; ++N) if (e[N] !== r[N]) {
            u = e[N], O = r[N];
            break;
          }
          return u < O ? -1 : O < u ? 1 : 0;
        }, x.isEncoding = function(e) {
          switch (String(e).toLowerCase()) {
            case "hex":
            case "utf8":
            case "utf-8":
            case "ascii":
            case "latin1":
            case "binary":
            case "base64":
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return true;
            default:
              return false;
          }
        }, x.concat = function(e, r) {
          if (!Array.isArray(e)) throw new TypeError('"list" argument must be an Array of Buffers');
          if (e.length === 0) return x.alloc(0);
          let u;
          if (r === void 0) for (r = 0, u = 0; u < e.length; ++u) r += e[u].length;
          const O = x.allocUnsafe(r);
          let N = 0;
          for (u = 0; u < e.length; ++u) {
            let k = e[u];
            if (Ee(k, h)) N + k.length > O.length ? (x.isBuffer(k) || (k = x.from(k)), k.copy(O, N)) : h.prototype.set.call(O, k, N);
            else if (x.isBuffer(k)) k.copy(O, N);
            else throw new TypeError('"list" argument must be an Array of Buffers');
            N += k.length;
          }
          return O;
        };
        function fe(t, e) {
          if (x.isBuffer(t)) return t.length;
          if (g.isView(t) || Ee(t, g)) return t.byteLength;
          if (typeof t != "string") throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof t);
          const r = t.length, u = arguments.length > 2 && arguments[2] === true;
          if (!u && r === 0) return 0;
          let O = false;
          for (; ; ) switch (e) {
            case "ascii":
            case "latin1":
            case "binary":
              return r;
            case "utf8":
            case "utf-8":
              return ue(t).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return r * 2;
            case "hex":
              return r >>> 1;
            case "base64":
              return te(t).length;
            default:
              if (O) return u ? -1 : ue(t).length;
              e = ("" + e).toLowerCase(), O = true;
          }
        }
        x.byteLength = fe;
        function de(t, e, r) {
          let u = false;
          if ((e === void 0 || e < 0) && (e = 0), e > this.length || ((r === void 0 || r > this.length) && (r = this.length), r <= 0) || (r >>>= 0, e >>>= 0, r <= e)) return "";
          for (t || (t = "utf8"); ; ) switch (t) {
            case "hex":
              return ke(this, e, r);
            case "utf8":
            case "utf-8":
              return ie(this, e, r);
            case "ascii":
              return Se(this, e, r);
            case "latin1":
            case "binary":
              return Ne(this, e, r);
            case "base64":
              return G(this, e, r);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return ze(this, e, r);
            default:
              if (u) throw new TypeError("Unknown encoding: " + t);
              t = (t + "").toLowerCase(), u = true;
          }
        }
        x.prototype._isBuffer = true;
        function I(t, e, r) {
          const u = t[e];
          t[e] = t[r], t[r] = u;
        }
        x.prototype.swap16 = function() {
          const e = this.length;
          if (e % 2 !== 0) throw new RangeError("Buffer size must be a multiple of 16-bits");
          for (let r = 0; r < e; r += 2) I(this, r, r + 1);
          return this;
        }, x.prototype.swap32 = function() {
          const e = this.length;
          if (e % 4 !== 0) throw new RangeError("Buffer size must be a multiple of 32-bits");
          for (let r = 0; r < e; r += 4) I(this, r, r + 3), I(this, r + 1, r + 2);
          return this;
        }, x.prototype.swap64 = function() {
          const e = this.length;
          if (e % 8 !== 0) throw new RangeError("Buffer size must be a multiple of 64-bits");
          for (let r = 0; r < e; r += 8) I(this, r, r + 7), I(this, r + 1, r + 6), I(this, r + 2, r + 5), I(this, r + 3, r + 4);
          return this;
        }, x.prototype.toString = function() {
          const e = this.length;
          return e === 0 ? "" : arguments.length === 0 ? ie(this, 0, e) : de.apply(this, arguments);
        }, x.prototype.toLocaleString = x.prototype.toString, x.prototype.equals = function(e) {
          if (!x.isBuffer(e)) throw new TypeError("Argument must be a Buffer");
          return this === e ? true : x.compare(this, e) === 0;
        }, x.prototype.inspect = function() {
          let e = "";
          const r = f.INSPECT_MAX_BYTES;
          return e = this.toString("hex", 0, r).replace(/(.{2})/g, "$1 ").trim(), this.length > r && (e += " ... "), "<Buffer " + e + ">";
        }, c && (x.prototype[c] = x.prototype.inspect), x.prototype.compare = function(e, r, u, O, N) {
          if (Ee(e, h) && (e = x.from(e, e.offset, e.byteLength)), !x.isBuffer(e)) throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof e);
          if (r === void 0 && (r = 0), u === void 0 && (u = e ? e.length : 0), O === void 0 && (O = 0), N === void 0 && (N = this.length), r < 0 || u > e.length || O < 0 || N > this.length) throw new RangeError("out of range index");
          if (O >= N && r >= u) return 0;
          if (O >= N) return -1;
          if (r >= u) return 1;
          if (r >>>= 0, u >>>= 0, O >>>= 0, N >>>= 0, this === e) return 0;
          let k = N - O, ne = u - r;
          const me = Math.min(k, ne), ge = this.slice(O, N), ve = e.slice(r, u);
          for (let ce = 0; ce < me; ++ce) if (ge[ce] !== ve[ce]) {
            k = ge[ce], ne = ve[ce];
            break;
          }
          return k < ne ? -1 : ne < k ? 1 : 0;
        };
        function B(t, e, r, u, O) {
          if (t.length === 0) return -1;
          if (typeof r == "string" ? (u = r, r = 0) : r > 2147483647 ? r = 2147483647 : r < -2147483648 && (r = -2147483648), r = +r, Re(r) && (r = O ? 0 : t.length - 1), r < 0 && (r = t.length + r), r >= t.length) {
            if (O) return -1;
            r = t.length - 1;
          } else if (r < 0) if (O) r = 0;
          else return -1;
          if (typeof e == "string" && (e = x.from(e, u)), x.isBuffer(e)) return e.length === 0 ? -1 : H(t, e, r, u, O);
          if (typeof e == "number") return e = e & 255, typeof h.prototype.indexOf == "function" ? O ? h.prototype.indexOf.call(t, e, r) : h.prototype.lastIndexOf.call(t, e, r) : H(t, [
            e
          ], r, u, O);
          throw new TypeError("val must be string, number or Buffer");
        }
        function H(t, e, r, u, O) {
          let N = 1, k = t.length, ne = e.length;
          if (u !== void 0 && (u = String(u).toLowerCase(), u === "ucs2" || u === "ucs-2" || u === "utf16le" || u === "utf-16le")) {
            if (t.length < 2 || e.length < 2) return -1;
            N = 2, k /= 2, ne /= 2, r /= 2;
          }
          function me(ve, ce) {
            return N === 1 ? ve[ce] : ve.readUInt16BE(ce * N);
          }
          let ge;
          if (O) {
            let ve = -1;
            for (ge = r; ge < k; ge++) if (me(t, ge) === me(e, ve === -1 ? 0 : ge - ve)) {
              if (ve === -1 && (ve = ge), ge - ve + 1 === ne) return ve * N;
            } else ve !== -1 && (ge -= ge - ve), ve = -1;
          } else for (r + ne > k && (r = k - ne), ge = r; ge >= 0; ge--) {
            let ve = true;
            for (let ce = 0; ce < ne; ce++) if (me(t, ge + ce) !== me(e, ce)) {
              ve = false;
              break;
            }
            if (ve) return ge;
          }
          return -1;
        }
        x.prototype.includes = function(e, r, u) {
          return this.indexOf(e, r, u) !== -1;
        }, x.prototype.indexOf = function(e, r, u) {
          return B(this, e, r, u, true);
        }, x.prototype.lastIndexOf = function(e, r, u) {
          return B(this, e, r, u, false);
        };
        function V(t, e, r, u) {
          r = Number(r) || 0;
          const O = t.length - r;
          u ? (u = Number(u), u > O && (u = O)) : u = O;
          const N = e.length;
          u > N / 2 && (u = N / 2);
          let k;
          for (k = 0; k < u; ++k) {
            const ne = parseInt(e.substr(k * 2, 2), 16);
            if (Re(ne)) return k;
            t[r + k] = ne;
          }
          return k;
        }
        function X(t, e, r, u) {
          return xe(ue(e, t.length - r), t, r, u);
        }
        function a(t, e, r, u) {
          return xe(pe(e), t, r, u);
        }
        function l(t, e, r, u) {
          return xe(te(e), t, r, u);
        }
        function W(t, e, r, u) {
          return xe(ye(e, t.length - r), t, r, u);
        }
        x.prototype.write = function(e, r, u, O) {
          if (r === void 0) O = "utf8", u = this.length, r = 0;
          else if (u === void 0 && typeof r == "string") O = r, u = this.length, r = 0;
          else if (isFinite(r)) r = r >>> 0, isFinite(u) ? (u = u >>> 0, O === void 0 && (O = "utf8")) : (O = u, u = void 0);
          else throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
          const N = this.length - r;
          if ((u === void 0 || u > N) && (u = N), e.length > 0 && (u < 0 || r < 0) || r > this.length) throw new RangeError("Attempt to write outside buffer bounds");
          O || (O = "utf8");
          let k = false;
          for (; ; ) switch (O) {
            case "hex":
              return V(this, e, r, u);
            case "utf8":
            case "utf-8":
              return X(this, e, r, u);
            case "ascii":
            case "latin1":
            case "binary":
              return a(this, e, r, u);
            case "base64":
              return l(this, e, r, u);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return W(this, e, r, u);
            default:
              if (k) throw new TypeError("Unknown encoding: " + O);
              O = ("" + O).toLowerCase(), k = true;
          }
        }, x.prototype.toJSON = function() {
          return {
            type: "Buffer",
            data: Array.prototype.slice.call(this._arr || this, 0)
          };
        };
        function G(t, e, r) {
          return e === 0 && r === t.length ? v.fromByteArray(t) : v.fromByteArray(t.slice(e, r));
        }
        function ie(t, e, r) {
          r = Math.min(t.length, r);
          const u = [];
          let O = e;
          for (; O < r; ) {
            const N = t[O];
            let k = null, ne = N > 239 ? 4 : N > 223 ? 3 : N > 191 ? 2 : 1;
            if (O + ne <= r) {
              let me, ge, ve, ce;
              switch (ne) {
                case 1:
                  N < 128 && (k = N);
                  break;
                case 2:
                  me = t[O + 1], (me & 192) === 128 && (ce = (N & 31) << 6 | me & 63, ce > 127 && (k = ce));
                  break;
                case 3:
                  me = t[O + 1], ge = t[O + 2], (me & 192) === 128 && (ge & 192) === 128 && (ce = (N & 15) << 12 | (me & 63) << 6 | ge & 63, ce > 2047 && (ce < 55296 || ce > 57343) && (k = ce));
                  break;
                case 4:
                  me = t[O + 1], ge = t[O + 2], ve = t[O + 3], (me & 192) === 128 && (ge & 192) === 128 && (ve & 192) === 128 && (ce = (N & 15) << 18 | (me & 63) << 12 | (ge & 63) << 6 | ve & 63, ce > 65535 && ce < 1114112 && (k = ce));
              }
            }
            k === null ? (k = 65533, ne = 1) : k > 65535 && (k -= 65536, u.push(k >>> 10 & 1023 | 55296), k = 56320 | k & 1023), u.push(k), O += ne;
          }
          return ae(u);
        }
        const re = 4096;
        function ae(t) {
          const e = t.length;
          if (e <= re) return String.fromCharCode.apply(String, t);
          let r = "", u = 0;
          for (; u < e; ) r += String.fromCharCode.apply(String, t.slice(u, u += re));
          return r;
        }
        function Se(t, e, r) {
          let u = "";
          r = Math.min(t.length, r);
          for (let O = e; O < r; ++O) u += String.fromCharCode(t[O] & 127);
          return u;
        }
        function Ne(t, e, r) {
          let u = "";
          r = Math.min(t.length, r);
          for (let O = e; O < r; ++O) u += String.fromCharCode(t[O]);
          return u;
        }
        function ke(t, e, r) {
          const u = t.length;
          (!e || e < 0) && (e = 0), (!r || r < 0 || r > u) && (r = u);
          let O = "";
          for (let N = e; N < r; ++N) O += Fe[t[N]];
          return O;
        }
        function ze(t, e, r) {
          const u = t.slice(e, r);
          let O = "";
          for (let N = 0; N < u.length - 1; N += 2) O += String.fromCharCode(u[N] + u[N + 1] * 256);
          return O;
        }
        x.prototype.slice = function(e, r) {
          const u = this.length;
          e = ~~e, r = r === void 0 ? u : ~~r, e < 0 ? (e += u, e < 0 && (e = 0)) : e > u && (e = u), r < 0 ? (r += u, r < 0 && (r = 0)) : r > u && (r = u), r < e && (r = e);
          const O = this.subarray(e, r);
          return Object.setPrototypeOf(O, x.prototype), O;
        };
        function be(t, e, r) {
          if (t % 1 !== 0 || t < 0) throw new RangeError("offset is not uint");
          if (t + e > r) throw new RangeError("Trying to access beyond buffer length");
        }
        x.prototype.readUintLE = x.prototype.readUIntLE = function(e, r, u) {
          e = e >>> 0, r = r >>> 0, u || be(e, r, this.length);
          let O = this[e], N = 1, k = 0;
          for (; ++k < r && (N *= 256); ) O += this[e + k] * N;
          return O;
        }, x.prototype.readUintBE = x.prototype.readUIntBE = function(e, r, u) {
          e = e >>> 0, r = r >>> 0, u || be(e, r, this.length);
          let O = this[e + --r], N = 1;
          for (; r > 0 && (N *= 256); ) O += this[e + --r] * N;
          return O;
        }, x.prototype.readUint8 = x.prototype.readUInt8 = function(e, r) {
          return e = e >>> 0, r || be(e, 1, this.length), this[e];
        }, x.prototype.readUint16LE = x.prototype.readUInt16LE = function(e, r) {
          return e = e >>> 0, r || be(e, 2, this.length), this[e] | this[e + 1] << 8;
        }, x.prototype.readUint16BE = x.prototype.readUInt16BE = function(e, r) {
          return e = e >>> 0, r || be(e, 2, this.length), this[e] << 8 | this[e + 1];
        }, x.prototype.readUint32LE = x.prototype.readUInt32LE = function(e, r) {
          return e = e >>> 0, r || be(e, 4, this.length), (this[e] | this[e + 1] << 8 | this[e + 2] << 16) + this[e + 3] * 16777216;
        }, x.prototype.readUint32BE = x.prototype.readUInt32BE = function(e, r) {
          return e = e >>> 0, r || be(e, 4, this.length), this[e] * 16777216 + (this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3]);
        }, x.prototype.readBigUInt64LE = Oe(function(e) {
          e = e >>> 0, Be(e, "offset");
          const r = this[e], u = this[e + 7];
          (r === void 0 || u === void 0) && Me(e, this.length - 8);
          const O = r + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + this[++e] * 2 ** 24, N = this[++e] + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + u * 2 ** 24;
          return BigInt(O) + (BigInt(N) << BigInt(32));
        }), x.prototype.readBigUInt64BE = Oe(function(e) {
          e = e >>> 0, Be(e, "offset");
          const r = this[e], u = this[e + 7];
          (r === void 0 || u === void 0) && Me(e, this.length - 8);
          const O = r * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + this[++e], N = this[++e] * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + u;
          return (BigInt(O) << BigInt(32)) + BigInt(N);
        }), x.prototype.readIntLE = function(e, r, u) {
          e = e >>> 0, r = r >>> 0, u || be(e, r, this.length);
          let O = this[e], N = 1, k = 0;
          for (; ++k < r && (N *= 256); ) O += this[e + k] * N;
          return N *= 128, O >= N && (O -= Math.pow(2, 8 * r)), O;
        }, x.prototype.readIntBE = function(e, r, u) {
          e = e >>> 0, r = r >>> 0, u || be(e, r, this.length);
          let O = r, N = 1, k = this[e + --O];
          for (; O > 0 && (N *= 256); ) k += this[e + --O] * N;
          return N *= 128, k >= N && (k -= Math.pow(2, 8 * r)), k;
        }, x.prototype.readInt8 = function(e, r) {
          return e = e >>> 0, r || be(e, 1, this.length), this[e] & 128 ? (255 - this[e] + 1) * -1 : this[e];
        }, x.prototype.readInt16LE = function(e, r) {
          e = e >>> 0, r || be(e, 2, this.length);
          const u = this[e] | this[e + 1] << 8;
          return u & 32768 ? u | 4294901760 : u;
        }, x.prototype.readInt16BE = function(e, r) {
          e = e >>> 0, r || be(e, 2, this.length);
          const u = this[e + 1] | this[e] << 8;
          return u & 32768 ? u | 4294901760 : u;
        }, x.prototype.readInt32LE = function(e, r) {
          return e = e >>> 0, r || be(e, 4, this.length), this[e] | this[e + 1] << 8 | this[e + 2] << 16 | this[e + 3] << 24;
        }, x.prototype.readInt32BE = function(e, r) {
          return e = e >>> 0, r || be(e, 4, this.length), this[e] << 24 | this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3];
        }, x.prototype.readBigInt64LE = Oe(function(e) {
          e = e >>> 0, Be(e, "offset");
          const r = this[e], u = this[e + 7];
          (r === void 0 || u === void 0) && Me(e, this.length - 8);
          const O = this[e + 4] + this[e + 5] * 2 ** 8 + this[e + 6] * 2 ** 16 + (u << 24);
          return (BigInt(O) << BigInt(32)) + BigInt(r + this[++e] * 2 ** 8 + this[++e] * 2 ** 16 + this[++e] * 2 ** 24);
        }), x.prototype.readBigInt64BE = Oe(function(e) {
          e = e >>> 0, Be(e, "offset");
          const r = this[e], u = this[e + 7];
          (r === void 0 || u === void 0) && Me(e, this.length - 8);
          const O = (r << 24) + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + this[++e];
          return (BigInt(O) << BigInt(32)) + BigInt(this[++e] * 2 ** 24 + this[++e] * 2 ** 16 + this[++e] * 2 ** 8 + u);
        }), x.prototype.readFloatLE = function(e, r) {
          return e = e >>> 0, r || be(e, 4, this.length), y.read(this, e, true, 23, 4);
        }, x.prototype.readFloatBE = function(e, r) {
          return e = e >>> 0, r || be(e, 4, this.length), y.read(this, e, false, 23, 4);
        }, x.prototype.readDoubleLE = function(e, r) {
          return e = e >>> 0, r || be(e, 8, this.length), y.read(this, e, true, 52, 8);
        }, x.prototype.readDoubleBE = function(e, r) {
          return e = e >>> 0, r || be(e, 8, this.length), y.read(this, e, false, 52, 8);
        };
        function _e(t, e, r, u, O, N) {
          if (!x.isBuffer(t)) throw new TypeError('"buffer" argument must be a Buffer instance');
          if (e > O || e < N) throw new RangeError('"value" argument is out of bounds');
          if (r + u > t.length) throw new RangeError("Index out of range");
        }
        x.prototype.writeUintLE = x.prototype.writeUIntLE = function(e, r, u, O) {
          if (e = +e, r = r >>> 0, u = u >>> 0, !O) {
            const ne = Math.pow(2, 8 * u) - 1;
            _e(this, e, r, u, ne, 0);
          }
          let N = 1, k = 0;
          for (this[r] = e & 255; ++k < u && (N *= 256); ) this[r + k] = e / N & 255;
          return r + u;
        }, x.prototype.writeUintBE = x.prototype.writeUIntBE = function(e, r, u, O) {
          if (e = +e, r = r >>> 0, u = u >>> 0, !O) {
            const ne = Math.pow(2, 8 * u) - 1;
            _e(this, e, r, u, ne, 0);
          }
          let N = u - 1, k = 1;
          for (this[r + N] = e & 255; --N >= 0 && (k *= 256); ) this[r + N] = e / k & 255;
          return r + u;
        }, x.prototype.writeUint8 = x.prototype.writeUInt8 = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 1, 255, 0), this[r] = e & 255, r + 1;
        }, x.prototype.writeUint16LE = x.prototype.writeUInt16LE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 2, 65535, 0), this[r] = e & 255, this[r + 1] = e >>> 8, r + 2;
        }, x.prototype.writeUint16BE = x.prototype.writeUInt16BE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 2, 65535, 0), this[r] = e >>> 8, this[r + 1] = e & 255, r + 2;
        }, x.prototype.writeUint32LE = x.prototype.writeUInt32LE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 4, 4294967295, 0), this[r + 3] = e >>> 24, this[r + 2] = e >>> 16, this[r + 1] = e >>> 8, this[r] = e & 255, r + 4;
        }, x.prototype.writeUint32BE = x.prototype.writeUInt32BE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 4, 4294967295, 0), this[r] = e >>> 24, this[r + 1] = e >>> 16, this[r + 2] = e >>> 8, this[r + 3] = e & 255, r + 4;
        };
        function Pe(t, e, r, u, O) {
          Je(e, u, O, t, r, 7);
          let N = Number(e & BigInt(4294967295));
          t[r++] = N, N = N >> 8, t[r++] = N, N = N >> 8, t[r++] = N, N = N >> 8, t[r++] = N;
          let k = Number(e >> BigInt(32) & BigInt(4294967295));
          return t[r++] = k, k = k >> 8, t[r++] = k, k = k >> 8, t[r++] = k, k = k >> 8, t[r++] = k, r;
        }
        function De(t, e, r, u, O) {
          Je(e, u, O, t, r, 7);
          let N = Number(e & BigInt(4294967295));
          t[r + 7] = N, N = N >> 8, t[r + 6] = N, N = N >> 8, t[r + 5] = N, N = N >> 8, t[r + 4] = N;
          let k = Number(e >> BigInt(32) & BigInt(4294967295));
          return t[r + 3] = k, k = k >> 8, t[r + 2] = k, k = k >> 8, t[r + 1] = k, k = k >> 8, t[r] = k, r + 8;
        }
        x.prototype.writeBigUInt64LE = Oe(function(e, r = 0) {
          return Pe(this, e, r, BigInt(0), BigInt("0xffffffffffffffff"));
        }), x.prototype.writeBigUInt64BE = Oe(function(e, r = 0) {
          return De(this, e, r, BigInt(0), BigInt("0xffffffffffffffff"));
        }), x.prototype.writeIntLE = function(e, r, u, O) {
          if (e = +e, r = r >>> 0, !O) {
            const me = Math.pow(2, 8 * u - 1);
            _e(this, e, r, u, me - 1, -me);
          }
          let N = 0, k = 1, ne = 0;
          for (this[r] = e & 255; ++N < u && (k *= 256); ) e < 0 && ne === 0 && this[r + N - 1] !== 0 && (ne = 1), this[r + N] = (e / k >> 0) - ne & 255;
          return r + u;
        }, x.prototype.writeIntBE = function(e, r, u, O) {
          if (e = +e, r = r >>> 0, !O) {
            const me = Math.pow(2, 8 * u - 1);
            _e(this, e, r, u, me - 1, -me);
          }
          let N = u - 1, k = 1, ne = 0;
          for (this[r + N] = e & 255; --N >= 0 && (k *= 256); ) e < 0 && ne === 0 && this[r + N + 1] !== 0 && (ne = 1), this[r + N] = (e / k >> 0) - ne & 255;
          return r + u;
        }, x.prototype.writeInt8 = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 1, 127, -128), e < 0 && (e = 255 + e + 1), this[r] = e & 255, r + 1;
        }, x.prototype.writeInt16LE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 2, 32767, -32768), this[r] = e & 255, this[r + 1] = e >>> 8, r + 2;
        }, x.prototype.writeInt16BE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 2, 32767, -32768), this[r] = e >>> 8, this[r + 1] = e & 255, r + 2;
        }, x.prototype.writeInt32LE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 4, 2147483647, -2147483648), this[r] = e & 255, this[r + 1] = e >>> 8, this[r + 2] = e >>> 16, this[r + 3] = e >>> 24, r + 4;
        }, x.prototype.writeInt32BE = function(e, r, u) {
          return e = +e, r = r >>> 0, u || _e(this, e, r, 4, 2147483647, -2147483648), e < 0 && (e = 4294967295 + e + 1), this[r] = e >>> 24, this[r + 1] = e >>> 16, this[r + 2] = e >>> 8, this[r + 3] = e & 255, r + 4;
        }, x.prototype.writeBigInt64LE = Oe(function(e, r = 0) {
          return Pe(this, e, r, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
        }), x.prototype.writeBigInt64BE = Oe(function(e, r = 0) {
          return De(this, e, r, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
        });
        function Ce(t, e, r, u, O, N) {
          if (r + u > t.length) throw new RangeError("Index out of range");
          if (r < 0) throw new RangeError("Index out of range");
        }
        function Te(t, e, r, u, O) {
          return e = +e, r = r >>> 0, O || Ce(t, e, r, 4), y.write(t, e, r, u, 23, 4), r + 4;
        }
        x.prototype.writeFloatLE = function(e, r, u) {
          return Te(this, e, r, true, u);
        }, x.prototype.writeFloatBE = function(e, r, u) {
          return Te(this, e, r, false, u);
        };
        function Ie(t, e, r, u, O) {
          return e = +e, r = r >>> 0, O || Ce(t, e, r, 8), y.write(t, e, r, u, 52, 8), r + 8;
        }
        x.prototype.writeDoubleLE = function(e, r, u) {
          return Ie(this, e, r, true, u);
        }, x.prototype.writeDoubleBE = function(e, r, u) {
          return Ie(this, e, r, false, u);
        }, x.prototype.copy = function(e, r, u, O) {
          if (!x.isBuffer(e)) throw new TypeError("argument should be a Buffer");
          if (u || (u = 0), !O && O !== 0 && (O = this.length), r >= e.length && (r = e.length), r || (r = 0), O > 0 && O < u && (O = u), O === u || e.length === 0 || this.length === 0) return 0;
          if (r < 0) throw new RangeError("targetStart out of bounds");
          if (u < 0 || u >= this.length) throw new RangeError("Index out of range");
          if (O < 0) throw new RangeError("sourceEnd out of bounds");
          O > this.length && (O = this.length), e.length - r < O - u && (O = e.length - r + u);
          const N = O - u;
          return this === e && typeof h.prototype.copyWithin == "function" ? this.copyWithin(r, u, O) : h.prototype.set.call(e, this.subarray(u, O), r), N;
        }, x.prototype.fill = function(e, r, u, O) {
          if (typeof e == "string") {
            if (typeof r == "string" ? (O = r, r = 0, u = this.length) : typeof u == "string" && (O = u, u = this.length), O !== void 0 && typeof O != "string") throw new TypeError("encoding must be a string");
            if (typeof O == "string" && !x.isEncoding(O)) throw new TypeError("Unknown encoding: " + O);
            if (e.length === 1) {
              const k = e.charCodeAt(0);
              (O === "utf8" && k < 128 || O === "latin1") && (e = k);
            }
          } else typeof e == "number" ? e = e & 255 : typeof e == "boolean" && (e = Number(e));
          if (r < 0 || this.length < r || this.length < u) throw new RangeError("Out of range index");
          if (u <= r) return this;
          r = r >>> 0, u = u === void 0 ? this.length : u >>> 0, e || (e = 0);
          let N;
          if (typeof e == "number") for (N = r; N < u; ++N) this[N] = e;
          else {
            const k = x.isBuffer(e) ? e : x.from(e, O), ne = k.length;
            if (ne === 0) throw new TypeError('The value "' + e + '" is invalid for argument "value"');
            for (N = 0; N < u - r; ++N) this[N + r] = k[N % ne];
          }
          return this;
        };
        const Ae = {};
        function We(t, e, r) {
          Ae[t] = class extends r {
            constructor() {
              super(), Object.defineProperty(this, "message", {
                value: e.apply(this, arguments),
                writable: true,
                configurable: true
              }), this.name = `${this.name} [${t}]`, this.stack, delete this.name;
            }
            get code() {
              return t;
            }
            set code(O) {
              Object.defineProperty(this, "code", {
                configurable: true,
                enumerable: true,
                value: O,
                writable: true
              });
            }
            toString() {
              return `${this.name} [${t}]: ${this.message}`;
            }
          };
        }
        We("ERR_BUFFER_OUT_OF_BOUNDS", function(t) {
          return t ? `${t} is outside of buffer bounds` : "Attempt to access memory outside buffer bounds";
        }, RangeError), We("ERR_INVALID_ARG_TYPE", function(t, e) {
          return `The "${t}" argument must be of type number. Received type ${typeof e}`;
        }, TypeError), We("ERR_OUT_OF_RANGE", function(t, e, r) {
          let u = `The value of "${t}" is out of range.`, O = r;
          return Number.isInteger(r) && Math.abs(r) > 2 ** 32 ? O = Ye(String(r)) : typeof r == "bigint" && (O = String(r), (r > BigInt(2) ** BigInt(32) || r < -(BigInt(2) ** BigInt(32))) && (O = Ye(O)), O += "n"), u += ` It must be ${e}. Received ${O}`, u;
        }, RangeError);
        function Ye(t) {
          let e = "", r = t.length;
          const u = t[0] === "-" ? 1 : 0;
          for (; r >= u + 4; r -= 3) e = `_${t.slice(r - 3, r)}${e}`;
          return `${t.slice(0, r)}${e}`;
        }
        function fr(t, e, r) {
          Be(e, "offset"), (t[e] === void 0 || t[e + r] === void 0) && Me(e, t.length - (r + 1));
        }
        function Je(t, e, r, u, O, N) {
          if (t > r || t < e) {
            const k = typeof e == "bigint" ? "n" : "";
            let ne;
            throw e === 0 || e === BigInt(0) ? ne = `>= 0${k} and < 2${k} ** ${(N + 1) * 8}${k}` : ne = `>= -(2${k} ** ${(N + 1) * 8 - 1}${k}) and < 2 ** ${(N + 1) * 8 - 1}${k}`, new Ae.ERR_OUT_OF_RANGE("value", ne, t);
          }
          fr(u, O, N);
        }
        function Be(t, e) {
          if (typeof t != "number") throw new Ae.ERR_INVALID_ARG_TYPE(e, "number", t);
        }
        function Me(t, e, r) {
          throw Math.floor(t) !== t ? (Be(t, r), new Ae.ERR_OUT_OF_RANGE("offset", "an integer", t)) : e < 0 ? new Ae.ERR_BUFFER_OUT_OF_BOUNDS() : new Ae.ERR_OUT_OF_RANGE("offset", `>= 0 and <= ${e}`, t);
        }
        const F = /[^+/0-9A-Za-z-_]/g;
        function P(t) {
          if (t = t.split("=")[0], t = t.trim().replace(F, ""), t.length < 2) return "";
          for (; t.length % 4 !== 0; ) t = t + "=";
          return t;
        }
        function ue(t, e) {
          e = e || 1 / 0;
          let r;
          const u = t.length;
          let O = null;
          const N = [];
          for (let k = 0; k < u; ++k) {
            if (r = t.charCodeAt(k), r > 55295 && r < 57344) {
              if (!O) {
                if (r > 56319) {
                  (e -= 3) > -1 && N.push(239, 191, 189);
                  continue;
                } else if (k + 1 === u) {
                  (e -= 3) > -1 && N.push(239, 191, 189);
                  continue;
                }
                O = r;
                continue;
              }
              if (r < 56320) {
                (e -= 3) > -1 && N.push(239, 191, 189), O = r;
                continue;
              }
              r = (O - 55296 << 10 | r - 56320) + 65536;
            } else O && (e -= 3) > -1 && N.push(239, 191, 189);
            if (O = null, r < 128) {
              if ((e -= 1) < 0) break;
              N.push(r);
            } else if (r < 2048) {
              if ((e -= 2) < 0) break;
              N.push(r >> 6 | 192, r & 63 | 128);
            } else if (r < 65536) {
              if ((e -= 3) < 0) break;
              N.push(r >> 12 | 224, r >> 6 & 63 | 128, r & 63 | 128);
            } else if (r < 1114112) {
              if ((e -= 4) < 0) break;
              N.push(r >> 18 | 240, r >> 12 & 63 | 128, r >> 6 & 63 | 128, r & 63 | 128);
            } else throw new Error("Invalid code point");
          }
          return N;
        }
        function pe(t) {
          const e = [];
          for (let r = 0; r < t.length; ++r) e.push(t.charCodeAt(r) & 255);
          return e;
        }
        function ye(t, e) {
          let r, u, O;
          const N = [];
          for (let k = 0; k < t.length && !((e -= 2) < 0); ++k) r = t.charCodeAt(k), u = r >> 8, O = r % 256, N.push(O), N.push(u);
          return N;
        }
        function te(t) {
          return v.toByteArray(P(t));
        }
        function xe(t, e, r, u) {
          let O;
          for (O = 0; O < u && !(O + r >= e.length || O >= t.length); ++O) e[O + r] = t[O];
          return O;
        }
        function Ee(t, e) {
          return t instanceof e || t != null && t.constructor != null && t.constructor.name != null && t.constructor.name === e.name;
        }
        function Re(t) {
          return t !== t;
        }
        const Fe = (function() {
          const t = "0123456789abcdef", e = new Array(256);
          for (let r = 0; r < 16; ++r) {
            const u = r * 16;
            for (let O = 0; O < 16; ++O) e[u + O] = t[r] + t[O];
          }
          return e;
        })();
        function Oe(t) {
          return typeof BigInt > "u" ? Ue : t;
        }
        function Ue() {
          throw new Error("BigInt not supported");
        }
      })(m);
      const s = m.Buffer;
      n.Blob = m.Blob, n.BlobOptions = m.BlobOptions, n.Buffer = m.Buffer, n.File = m.File, n.FileOptions = m.FileOptions, n.INSPECT_MAX_BYTES = m.INSPECT_MAX_BYTES, n.SlowBuffer = m.SlowBuffer, n.TranscodeEncoding = m.TranscodeEncoding, n.atob = m.atob, n.btoa = m.btoa, n.constants = m.constants, n.default = s, n.isAscii = m.isAscii, n.isUtf8 = m.isUtf8, n.kMaxLength = m.kMaxLength, n.kStringMaxLength = m.kStringMaxLength, n.resolveObjectURL = m.resolveObjectURL, n.transcode = m.transcode;
    })(pr)), pr;
  }
  var yr, et;
  function mn() {
    if (et) return yr;
    et = 1;
    function n(w, C) {
      var p = Object.keys(w);
      if (Object.getOwnPropertySymbols) {
        var s = Object.getOwnPropertySymbols(w);
        C && (s = s.filter(function(f) {
          return Object.getOwnPropertyDescriptor(w, f).enumerable;
        })), p.push.apply(p, s);
      }
      return p;
    }
    function m(w) {
      for (var C = 1; C < arguments.length; C++) {
        var p = arguments[C] != null ? arguments[C] : {};
        C % 2 ? n(Object(p), true).forEach(function(s) {
          i(w, s, p[s]);
        }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(w, Object.getOwnPropertyDescriptors(p)) : n(Object(p)).forEach(function(s) {
          Object.defineProperty(w, s, Object.getOwnPropertyDescriptor(p, s));
        });
      }
      return w;
    }
    function i(w, C, p) {
      return C = A(C), C in w ? Object.defineProperty(w, C, {
        value: p,
        enumerable: true,
        configurable: true,
        writable: true
      }) : w[C] = p, w;
    }
    function T(w, C) {
      if (!(w instanceof C)) throw new TypeError("Cannot call a class as a function");
    }
    function U(w, C) {
      for (var p = 0; p < C.length; p++) {
        var s = C[p];
        s.enumerable = s.enumerable || false, s.configurable = true, "value" in s && (s.writable = true), Object.defineProperty(w, A(s.key), s);
      }
    }
    function b(w, C, p) {
      return C && U(w.prototype, C), Object.defineProperty(w, "prototype", {
        writable: false
      }), w;
    }
    function A(w) {
      var C = o(w, "string");
      return typeof C == "symbol" ? C : String(C);
    }
    function o(w, C) {
      if (typeof w != "object" || w === null) return w;
      var p = w[Symbol.toPrimitive];
      if (p !== void 0) {
        var s = p.call(w, C);
        if (typeof s != "object") return s;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return String(w);
    }
    var R = ar(), _ = R.Buffer, d = qt(), S = d.inspect, M = S && S.custom || "inspect";
    function D(w, C, p) {
      _.prototype.copy.call(w, C, p);
    }
    return yr = (function() {
      function w() {
        T(this, w), this.head = null, this.tail = null, this.length = 0;
      }
      return b(w, [
        {
          key: "push",
          value: function(p) {
            var s = {
              data: p,
              next: null
            };
            this.length > 0 ? this.tail.next = s : this.head = s, this.tail = s, ++this.length;
          }
        },
        {
          key: "unshift",
          value: function(p) {
            var s = {
              data: p,
              next: this.head
            };
            this.length === 0 && (this.tail = s), this.head = s, ++this.length;
          }
        },
        {
          key: "shift",
          value: function() {
            if (this.length !== 0) {
              var p = this.head.data;
              return this.length === 1 ? this.head = this.tail = null : this.head = this.head.next, --this.length, p;
            }
          }
        },
        {
          key: "clear",
          value: function() {
            this.head = this.tail = null, this.length = 0;
          }
        },
        {
          key: "join",
          value: function(p) {
            if (this.length === 0) return "";
            for (var s = this.head, f = "" + s.data; s = s.next; ) f += p + s.data;
            return f;
          }
        },
        {
          key: "concat",
          value: function(p) {
            if (this.length === 0) return _.alloc(0);
            for (var s = _.allocUnsafe(p >>> 0), f = this.head, v = 0; f; ) D(f.data, s, v), v += f.data.length, f = f.next;
            return s;
          }
        },
        {
          key: "consume",
          value: function(p, s) {
            var f;
            return p < this.head.data.length ? (f = this.head.data.slice(0, p), this.head.data = this.head.data.slice(p)) : p === this.head.data.length ? f = this.shift() : f = s ? this._getString(p) : this._getBuffer(p), f;
          }
        },
        {
          key: "first",
          value: function() {
            return this.head.data;
          }
        },
        {
          key: "_getString",
          value: function(p) {
            var s = this.head, f = 1, v = s.data;
            for (p -= v.length; s = s.next; ) {
              var y = s.data, c = p > y.length ? y.length : p;
              if (c === y.length ? v += y : v += y.slice(0, p), p -= c, p === 0) {
                c === y.length ? (++f, s.next ? this.head = s.next : this.head = this.tail = null) : (this.head = s, s.data = y.slice(c));
                break;
              }
              ++f;
            }
            return this.length -= f, v;
          }
        },
        {
          key: "_getBuffer",
          value: function(p) {
            var s = _.allocUnsafe(p), f = this.head, v = 1;
            for (f.data.copy(s), p -= f.data.length; f = f.next; ) {
              var y = f.data, c = p > y.length ? y.length : p;
              if (y.copy(s, s.length - p, 0, c), p -= c, p === 0) {
                c === y.length ? (++v, f.next ? this.head = f.next : this.head = this.tail = null) : (this.head = f, f.data = y.slice(c));
                break;
              }
              ++v;
            }
            return this.length -= v, s;
          }
        },
        {
          key: M,
          value: function(p, s) {
            return S(this, m(m({}, s), {}, {
              depth: 0,
              customInspect: false
            }));
          }
        }
      ]), w;
    })(), yr;
  }
  var gr, rt;
  function Gt() {
    if (rt) return gr;
    rt = 1;
    function n(A, o) {
      var R = this, _ = this._readableState && this._readableState.destroyed, d = this._writableState && this._writableState.destroyed;
      return _ || d ? (o ? o(A) : A && (this._writableState ? this._writableState.errorEmitted || (this._writableState.errorEmitted = true, he.nextTick(U, this, A)) : he.nextTick(U, this, A)), this) : (this._readableState && (this._readableState.destroyed = true), this._writableState && (this._writableState.destroyed = true), this._destroy(A || null, function(S) {
        !o && S ? R._writableState ? R._writableState.errorEmitted ? he.nextTick(i, R) : (R._writableState.errorEmitted = true, he.nextTick(m, R, S)) : he.nextTick(m, R, S) : o ? (he.nextTick(i, R), o(S)) : he.nextTick(i, R);
      }), this);
    }
    function m(A, o) {
      U(A, o), i(A);
    }
    function i(A) {
      A._writableState && !A._writableState.emitClose || A._readableState && !A._readableState.emitClose || A.emit("close");
    }
    function T() {
      this._readableState && (this._readableState.destroyed = false, this._readableState.reading = false, this._readableState.ended = false, this._readableState.endEmitted = false), this._writableState && (this._writableState.destroyed = false, this._writableState.ended = false, this._writableState.ending = false, this._writableState.finalCalled = false, this._writableState.prefinished = false, this._writableState.finished = false, this._writableState.errorEmitted = false);
    }
    function U(A, o) {
      A.emit("error", o);
    }
    function b(A, o) {
      var R = A._readableState, _ = A._writableState;
      R && R.autoDestroy || _ && _.autoDestroy ? A.destroy(o) : A.emit("error", o);
    }
    return gr = {
      destroy: n,
      undestroy: T,
      errorOrDestroy: b
    }, gr;
  }
  var mr = {}, tt;
  function Ve() {
    if (tt) return mr;
    tt = 1;
    function n(o, R) {
      o.prototype = Object.create(R.prototype), o.prototype.constructor = o, o.__proto__ = R;
    }
    var m = {};
    function i(o, R, _) {
      _ || (_ = Error);
      function d(M, D, w) {
        return typeof R == "string" ? R : R(M, D, w);
      }
      var S = (function(M) {
        n(D, M);
        function D(w, C, p) {
          return M.call(this, d(w, C, p)) || this;
        }
        return D;
      })(_);
      S.prototype.name = _.name, S.prototype.code = o, m[o] = S;
    }
    function T(o, R) {
      if (Array.isArray(o)) {
        var _ = o.length;
        return o = o.map(function(d) {
          return String(d);
        }), _ > 2 ? "one of ".concat(R, " ").concat(o.slice(0, _ - 1).join(", "), ", or ") + o[_ - 1] : _ === 2 ? "one of ".concat(R, " ").concat(o[0], " or ").concat(o[1]) : "of ".concat(R, " ").concat(o[0]);
      } else return "of ".concat(R, " ").concat(String(o));
    }
    function U(o, R, _) {
      return o.substr(0, R.length) === R;
    }
    function b(o, R, _) {
      return (_ === void 0 || _ > o.length) && (_ = o.length), o.substring(_ - R.length, _) === R;
    }
    function A(o, R, _) {
      return typeof _ != "number" && (_ = 0), _ + R.length > o.length ? false : o.indexOf(R, _) !== -1;
    }
    return i("ERR_INVALID_OPT_VALUE", function(o, R) {
      return 'The value "' + R + '" is invalid for option "' + o + '"';
    }, TypeError), i("ERR_INVALID_ARG_TYPE", function(o, R, _) {
      var d;
      typeof R == "string" && U(R, "not ") ? (d = "must not be", R = R.replace(/^not /, "")) : d = "must be";
      var S;
      if (b(o, " argument")) S = "The ".concat(o, " ").concat(d, " ").concat(T(R, "type"));
      else {
        var M = A(o, ".") ? "property" : "argument";
        S = 'The "'.concat(o, '" ').concat(M, " ").concat(d, " ").concat(T(R, "type"));
      }
      return S += ". Received type ".concat(typeof _), S;
    }, TypeError), i("ERR_STREAM_PUSH_AFTER_EOF", "stream.push() after EOF"), i("ERR_METHOD_NOT_IMPLEMENTED", function(o) {
      return "The " + o + " method is not implemented";
    }), i("ERR_STREAM_PREMATURE_CLOSE", "Premature close"), i("ERR_STREAM_DESTROYED", function(o) {
      return "Cannot call " + o + " after a stream was destroyed";
    }), i("ERR_MULTIPLE_CALLBACK", "Callback called multiple times"), i("ERR_STREAM_CANNOT_PIPE", "Cannot pipe, not readable"), i("ERR_STREAM_WRITE_AFTER_END", "write after end"), i("ERR_STREAM_NULL_VALUES", "May not write null values to stream", TypeError), i("ERR_UNKNOWN_ENCODING", function(o) {
      return "Unknown encoding: " + o;
    }, TypeError), i("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", "stream.unshift() after end event"), mr.codes = m, mr;
  }
  var vr, nt;
  function Kt() {
    if (nt) return vr;
    nt = 1;
    var n = Ve().codes.ERR_INVALID_OPT_VALUE;
    function m(T, U, b) {
      return T.highWaterMark != null ? T.highWaterMark : U ? T[b] : null;
    }
    function i(T, U, b, A) {
      var o = m(U, A, b);
      if (o != null) {
        if (!(isFinite(o) && Math.floor(o) === o) || o < 0) {
          var R = A ? b : "highWaterMark";
          throw new n(R, o);
        }
        return Math.floor(o);
      }
      return T.objectMode ? 16 : 16 * 1024;
    }
    return vr = {
      getHighWaterMark: i
    }, vr;
  }
  var wr, it;
  function vn() {
    if (it) return wr;
    it = 1, wr = n;
    function n(i, T) {
      if (m("noDeprecation")) return i;
      var U = false;
      function b() {
        if (!U) {
          if (m("throwDeprecation")) throw new Error(T);
          m("traceDeprecation") ? console.trace(T) : console.warn(T), U = true;
        }
        return i.apply(this, arguments);
      }
      return b;
    }
    function m(i) {
      try {
        if (!we.localStorage) return false;
      } catch {
        return false;
      }
      var T = we.localStorage[i];
      return T == null ? false : String(T).toLowerCase() === "true";
    }
    return wr;
  }
  var br, at;
  function Vt() {
    if (at) return br;
    at = 1, br = g;
    function n(I) {
      var B = this;
      this.next = null, this.entry = null, this.finish = function() {
        de(B, I);
      };
    }
    var m;
    g.WritableState = E;
    var i = {
      deprecate: vn()
    }, T = $t(), U = ar().Buffer, b = (typeof we < "u" ? we : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
    };
    function A(I) {
      return U.from(I);
    }
    function o(I) {
      return U.isBuffer(I) || I instanceof b;
    }
    var R = Gt(), _ = Kt(), d = _.getHighWaterMark, S = Ve().codes, M = S.ERR_INVALID_ARG_TYPE, D = S.ERR_METHOD_NOT_IMPLEMENTED, w = S.ERR_MULTIPLE_CALLBACK, C = S.ERR_STREAM_CANNOT_PIPE, p = S.ERR_STREAM_DESTROYED, s = S.ERR_STREAM_NULL_VALUES, f = S.ERR_STREAM_WRITE_AFTER_END, v = S.ERR_UNKNOWN_ENCODING, y = R.errorOrDestroy;
    je()(g, T);
    function c() {
    }
    function E(I, B, H) {
      m = m || Ke(), I = I || {}, typeof H != "boolean" && (H = B instanceof m), this.objectMode = !!I.objectMode, H && (this.objectMode = this.objectMode || !!I.writableObjectMode), this.highWaterMark = d(this, I, "writableHighWaterMark", H), this.finalCalled = false, this.needDrain = false, this.ending = false, this.ended = false, this.finished = false, this.destroyed = false;
      var V = I.decodeStrings === false;
      this.decodeStrings = !V, this.defaultEncoding = I.defaultEncoding || "utf8", this.length = 0, this.writing = false, this.corked = 0, this.sync = true, this.bufferProcessing = false, this.onwrite = function(X) {
        J(B, X);
      }, this.writecb = null, this.writelen = 0, this.bufferedRequest = null, this.lastBufferedRequest = null, this.pendingcb = 0, this.prefinished = false, this.errorEmitted = false, this.emitClose = I.emitClose !== false, this.autoDestroy = !!I.autoDestroy, this.bufferedRequestCount = 0, this.corkedRequestsFree = new n(this);
    }
    E.prototype.getBuffer = function() {
      for (var B = this.bufferedRequest, H = []; B; ) H.push(B), B = B.next;
      return H;
    }, (function() {
      try {
        Object.defineProperty(E.prototype, "buffer", {
          get: i.deprecate(function() {
            return this.getBuffer();
          }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
        });
      } catch {
      }
    })();
    var h;
    typeof Symbol == "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] == "function" ? (h = Function.prototype[Symbol.hasInstance], Object.defineProperty(g, Symbol.hasInstance, {
      value: function(B) {
        return h.call(this, B) ? true : this !== g ? false : B && B._writableState instanceof E;
      }
    })) : h = function(B) {
      return B instanceof this;
    };
    function g(I) {
      m = m || Ke();
      var B = this instanceof m;
      if (!B && !h.call(g, this)) return new g(I);
      this._writableState = new E(I, this, B), this.writable = true, I && (typeof I.write == "function" && (this._write = I.write), typeof I.writev == "function" && (this._writev = I.writev), typeof I.destroy == "function" && (this._destroy = I.destroy), typeof I.final == "function" && (this._final = I.final)), T.call(this);
    }
    g.prototype.pipe = function() {
      y(this, new C());
    };
    function L(I, B) {
      var H = new f();
      y(I, H), he.nextTick(B, H);
    }
    function q(I, B, H, V) {
      var X;
      return H === null ? X = new s() : typeof H != "string" && !B.objectMode && (X = new M("chunk", [
        "string",
        "Buffer"
      ], H)), X ? (y(I, X), he.nextTick(V, X), false) : true;
    }
    g.prototype.write = function(I, B, H) {
      var V = this._writableState, X = false, a = !V.objectMode && o(I);
      return a && !U.isBuffer(I) && (I = A(I)), typeof B == "function" && (H = B, B = null), a ? B = "buffer" : B || (B = V.defaultEncoding), typeof H != "function" && (H = c), V.ending ? L(this, H) : (a || q(this, V, I, H)) && (V.pendingcb++, X = x(this, V, a, I, B, H)), X;
    }, g.prototype.cork = function() {
      this._writableState.corked++;
    }, g.prototype.uncork = function() {
      var I = this._writableState;
      I.corked && (I.corked--, !I.writing && !I.corked && !I.bufferProcessing && I.bufferedRequest && le(this, I));
    }, g.prototype.setDefaultEncoding = function(B) {
      if (typeof B == "string" && (B = B.toLowerCase()), !([
        "hex",
        "utf8",
        "utf-8",
        "ascii",
        "binary",
        "base64",
        "ucs2",
        "ucs-2",
        "utf16le",
        "utf-16le",
        "raw"
      ].indexOf((B + "").toLowerCase()) > -1)) throw new v(B);
      return this._writableState.defaultEncoding = B, this;
    }, Object.defineProperty(g.prototype, "writableBuffer", {
      enumerable: false,
      get: function() {
        return this._writableState && this._writableState.getBuffer();
      }
    });
    function $(I, B, H) {
      return !I.objectMode && I.decodeStrings !== false && typeof B == "string" && (B = U.from(B, H)), B;
    }
    Object.defineProperty(g.prototype, "writableHighWaterMark", {
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    });
    function x(I, B, H, V, X, a) {
      if (!H) {
        var l = $(B, V, X);
        V !== l && (H = true, X = "buffer", V = l);
      }
      var W = B.objectMode ? 1 : V.length;
      B.length += W;
      var G = B.length < B.highWaterMark;
      if (G || (B.needDrain = true), B.writing || B.corked) {
        var ie = B.lastBufferedRequest;
        B.lastBufferedRequest = {
          chunk: V,
          encoding: X,
          isBuf: H,
          callback: a,
          next: null
        }, ie ? ie.next = B.lastBufferedRequest : B.bufferedRequest = B.lastBufferedRequest, B.bufferedRequestCount += 1;
      } else z(I, B, false, W, V, X, a);
      return G;
    }
    function z(I, B, H, V, X, a, l) {
      B.writelen = V, B.writecb = l, B.writing = true, B.sync = true, B.destroyed ? B.onwrite(new p("write")) : H ? I._writev(X, B.onwrite) : I._write(X, a, B.onwrite), B.sync = false;
    }
    function Q(I, B, H, V, X) {
      --B.pendingcb, H ? (he.nextTick(X, V), he.nextTick(oe, I, B), I._writableState.errorEmitted = true, y(I, V)) : (X(V), I._writableState.errorEmitted = true, y(I, V), oe(I, B));
    }
    function Z(I) {
      I.writing = false, I.writecb = null, I.length -= I.writelen, I.writelen = 0;
    }
    function J(I, B) {
      var H = I._writableState, V = H.sync, X = H.writecb;
      if (typeof X != "function") throw new w();
      if (Z(H), B) Q(I, H, V, B, X);
      else {
        var a = K(H) || I.destroyed;
        !a && !H.corked && !H.bufferProcessing && H.bufferedRequest && le(I, H), V ? he.nextTick(se, I, H, a, X) : se(I, H, a, X);
      }
    }
    function se(I, B, H, V) {
      H || j(I, B), B.pendingcb--, V(), oe(I, B);
    }
    function j(I, B) {
      B.length === 0 && B.needDrain && (B.needDrain = false, I.emit("drain"));
    }
    function le(I, B) {
      B.bufferProcessing = true;
      var H = B.bufferedRequest;
      if (I._writev && H && H.next) {
        var V = B.bufferedRequestCount, X = new Array(V), a = B.corkedRequestsFree;
        a.entry = H;
        for (var l = 0, W = true; H; ) X[l] = H, H.isBuf || (W = false), H = H.next, l += 1;
        X.allBuffers = W, z(I, B, true, B.length, X, "", a.finish), B.pendingcb++, B.lastBufferedRequest = null, a.next ? (B.corkedRequestsFree = a.next, a.next = null) : B.corkedRequestsFree = new n(B), B.bufferedRequestCount = 0;
      } else {
        for (; H; ) {
          var G = H.chunk, ie = H.encoding, re = H.callback, ae = B.objectMode ? 1 : G.length;
          if (z(I, B, false, ae, G, ie, re), H = H.next, B.bufferedRequestCount--, B.writing) break;
        }
        H === null && (B.lastBufferedRequest = null);
      }
      B.bufferedRequest = H, B.bufferProcessing = false;
    }
    g.prototype._write = function(I, B, H) {
      H(new D("_write()"));
    }, g.prototype._writev = null, g.prototype.end = function(I, B, H) {
      var V = this._writableState;
      return typeof I == "function" ? (H = I, I = null, B = null) : typeof B == "function" && (H = B, B = null), I != null && this.write(I, B), V.corked && (V.corked = 1, this.uncork()), V.ending || fe(this, V, H), this;
    }, Object.defineProperty(g.prototype, "writableLength", {
      enumerable: false,
      get: function() {
        return this._writableState.length;
      }
    });
    function K(I) {
      return I.ending && I.length === 0 && I.bufferedRequest === null && !I.finished && !I.writing;
    }
    function Y(I, B) {
      I._final(function(H) {
        B.pendingcb--, H && y(I, H), B.prefinished = true, I.emit("prefinish"), oe(I, B);
      });
    }
    function ee(I, B) {
      !B.prefinished && !B.finalCalled && (typeof I._final == "function" && !B.destroyed ? (B.pendingcb++, B.finalCalled = true, he.nextTick(Y, I, B)) : (B.prefinished = true, I.emit("prefinish")));
    }
    function oe(I, B) {
      var H = K(B);
      if (H && (ee(I, B), B.pendingcb === 0 && (B.finished = true, I.emit("finish"), B.autoDestroy))) {
        var V = I._readableState;
        (!V || V.autoDestroy && V.endEmitted) && I.destroy();
      }
      return H;
    }
    function fe(I, B, H) {
      B.ending = true, oe(I, B), H && (B.finished ? he.nextTick(H) : I.once("finish", H)), B.ended = true, I.writable = false;
    }
    function de(I, B, H) {
      var V = I.entry;
      for (I.entry = null; V; ) {
        var X = V.callback;
        B.pendingcb--, X(H), V = V.next;
      }
      B.corkedRequestsFree.next = I;
    }
    return Object.defineProperty(g.prototype, "destroyed", {
      enumerable: false,
      get: function() {
        return this._writableState === void 0 ? false : this._writableState.destroyed;
      },
      set: function(B) {
        this._writableState && (this._writableState.destroyed = B);
      }
    }), g.prototype.destroy = R.destroy, g.prototype._undestroy = R.undestroy, g.prototype._destroy = function(I, B) {
      B(I);
    }, br;
  }
  var _r, ot;
  function Ke() {
    if (ot) return _r;
    ot = 1;
    var n = Object.keys || function(_) {
      var d = [];
      for (var S in _) d.push(S);
      return d;
    };
    _r = A;
    var m = zt(), i = Vt();
    je()(A, m);
    for (var T = n(i.prototype), U = 0; U < T.length; U++) {
      var b = T[U];
      A.prototype[b] || (A.prototype[b] = i.prototype[b]);
    }
    function A(_) {
      if (!(this instanceof A)) return new A(_);
      m.call(this, _), i.call(this, _), this.allowHalfOpen = true, _ && (_.readable === false && (this.readable = false), _.writable === false && (this.writable = false), _.allowHalfOpen === false && (this.allowHalfOpen = false, this.once("end", o)));
    }
    Object.defineProperty(A.prototype, "writableHighWaterMark", {
      enumerable: false,
      get: function() {
        return this._writableState.highWaterMark;
      }
    }), Object.defineProperty(A.prototype, "writableBuffer", {
      enumerable: false,
      get: function() {
        return this._writableState && this._writableState.getBuffer();
      }
    }), Object.defineProperty(A.prototype, "writableLength", {
      enumerable: false,
      get: function() {
        return this._writableState.length;
      }
    });
    function o() {
      this._writableState.ended || he.nextTick(R, this);
    }
    function R(_) {
      _.end();
    }
    return Object.defineProperty(A.prototype, "destroyed", {
      enumerable: false,
      get: function() {
        return this._readableState === void 0 || this._writableState === void 0 ? false : this._readableState.destroyed && this._writableState.destroyed;
      },
      set: function(d) {
        this._readableState === void 0 || this._writableState === void 0 || (this._readableState.destroyed = d, this._writableState.destroyed = d);
      }
    }), _r;
  }
  var Er = {}, nr = {
    exports: {}
  };
  var ft;
  function wn() {
    return ft || (ft = 1, (function(n, m) {
      var i = ar(), T = i.Buffer;
      function U(A, o) {
        for (var R in A) o[R] = A[R];
      }
      T.from && T.alloc && T.allocUnsafe && T.allocUnsafeSlow ? n.exports = i : (U(i, m), m.Buffer = b);
      function b(A, o, R) {
        return T(A, o, R);
      }
      b.prototype = Object.create(T.prototype), U(T, b), b.from = function(A, o, R) {
        if (typeof A == "number") throw new TypeError("Argument must not be a number");
        return T(A, o, R);
      }, b.alloc = function(A, o, R) {
        if (typeof A != "number") throw new TypeError("Argument must be a number");
        var _ = T(A);
        return o !== void 0 ? typeof R == "string" ? _.fill(o, R) : _.fill(o) : _.fill(0), _;
      }, b.allocUnsafe = function(A) {
        if (typeof A != "number") throw new TypeError("Argument must be a number");
        return T(A);
      }, b.allocUnsafeSlow = function(A) {
        if (typeof A != "number") throw new TypeError("Argument must be a number");
        return i.SlowBuffer(A);
      };
    })(nr, nr.exports)), nr.exports;
  }
  var ut;
  function lt() {
    if (ut) return Er;
    ut = 1;
    var n = wn().Buffer, m = n.isEncoding || function(s) {
      switch (s = "" + s, s && s.toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
        case "raw":
          return true;
        default:
          return false;
      }
    };
    function i(s) {
      if (!s) return "utf8";
      for (var f; ; ) switch (s) {
        case "utf8":
        case "utf-8":
          return "utf8";
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return "utf16le";
        case "latin1":
        case "binary":
          return "latin1";
        case "base64":
        case "ascii":
        case "hex":
          return s;
        default:
          if (f) return;
          s = ("" + s).toLowerCase(), f = true;
      }
    }
    function T(s) {
      var f = i(s);
      if (typeof f != "string" && (n.isEncoding === m || !m(s))) throw new Error("Unknown encoding: " + s);
      return f || s;
    }
    Er.StringDecoder = U;
    function U(s) {
      this.encoding = T(s);
      var f;
      switch (this.encoding) {
        case "utf16le":
          this.text = S, this.end = M, f = 4;
          break;
        case "utf8":
          this.fillLast = R, f = 4;
          break;
        case "base64":
          this.text = D, this.end = w, f = 3;
          break;
        default:
          this.write = C, this.end = p;
          return;
      }
      this.lastNeed = 0, this.lastTotal = 0, this.lastChar = n.allocUnsafe(f);
    }
    U.prototype.write = function(s) {
      if (s.length === 0) return "";
      var f, v;
      if (this.lastNeed) {
        if (f = this.fillLast(s), f === void 0) return "";
        v = this.lastNeed, this.lastNeed = 0;
      } else v = 0;
      return v < s.length ? f ? f + this.text(s, v) : this.text(s, v) : f || "";
    }, U.prototype.end = d, U.prototype.text = _, U.prototype.fillLast = function(s) {
      if (this.lastNeed <= s.length) return s.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
      s.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, s.length), this.lastNeed -= s.length;
    };
    function b(s) {
      return s <= 127 ? 0 : s >> 5 === 6 ? 2 : s >> 4 === 14 ? 3 : s >> 3 === 30 ? 4 : s >> 6 === 2 ? -1 : -2;
    }
    function A(s, f, v) {
      var y = f.length - 1;
      if (y < v) return 0;
      var c = b(f[y]);
      return c >= 0 ? (c > 0 && (s.lastNeed = c - 1), c) : --y < v || c === -2 ? 0 : (c = b(f[y]), c >= 0 ? (c > 0 && (s.lastNeed = c - 2), c) : --y < v || c === -2 ? 0 : (c = b(f[y]), c >= 0 ? (c > 0 && (c === 2 ? c = 0 : s.lastNeed = c - 3), c) : 0));
    }
    function o(s, f, v) {
      if ((f[0] & 192) !== 128) return s.lastNeed = 0, "\uFFFD";
      if (s.lastNeed > 1 && f.length > 1) {
        if ((f[1] & 192) !== 128) return s.lastNeed = 1, "\uFFFD";
        if (s.lastNeed > 2 && f.length > 2 && (f[2] & 192) !== 128) return s.lastNeed = 2, "\uFFFD";
      }
    }
    function R(s) {
      var f = this.lastTotal - this.lastNeed, v = o(this, s);
      if (v !== void 0) return v;
      if (this.lastNeed <= s.length) return s.copy(this.lastChar, f, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
      s.copy(this.lastChar, f, 0, s.length), this.lastNeed -= s.length;
    }
    function _(s, f) {
      var v = A(this, s, f);
      if (!this.lastNeed) return s.toString("utf8", f);
      this.lastTotal = v;
      var y = s.length - (v - this.lastNeed);
      return s.copy(this.lastChar, 0, y), s.toString("utf8", f, y);
    }
    function d(s) {
      var f = s && s.length ? this.write(s) : "";
      return this.lastNeed ? f + "\uFFFD" : f;
    }
    function S(s, f) {
      if ((s.length - f) % 2 === 0) {
        var v = s.toString("utf16le", f);
        if (v) {
          var y = v.charCodeAt(v.length - 1);
          if (y >= 55296 && y <= 56319) return this.lastNeed = 2, this.lastTotal = 4, this.lastChar[0] = s[s.length - 2], this.lastChar[1] = s[s.length - 1], v.slice(0, -1);
        }
        return v;
      }
      return this.lastNeed = 1, this.lastTotal = 2, this.lastChar[0] = s[s.length - 1], s.toString("utf16le", f, s.length - 1);
    }
    function M(s) {
      var f = s && s.length ? this.write(s) : "";
      if (this.lastNeed) {
        var v = this.lastTotal - this.lastNeed;
        return f + this.lastChar.toString("utf16le", 0, v);
      }
      return f;
    }
    function D(s, f) {
      var v = (s.length - f) % 3;
      return v === 0 ? s.toString("base64", f) : (this.lastNeed = 3 - v, this.lastTotal = 3, v === 1 ? this.lastChar[0] = s[s.length - 1] : (this.lastChar[0] = s[s.length - 2], this.lastChar[1] = s[s.length - 1]), s.toString("base64", f, s.length - v));
    }
    function w(s) {
      var f = s && s.length ? this.write(s) : "";
      return this.lastNeed ? f + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : f;
    }
    function C(s) {
      return s.toString(this.encoding);
    }
    function p(s) {
      return s && s.length ? this.write(s) : "";
    }
    return Er;
  }
  var Sr, st;
  function Gr() {
    if (st) return Sr;
    st = 1;
    var n = Ve().codes.ERR_STREAM_PREMATURE_CLOSE;
    function m(b) {
      var A = false;
      return function() {
        if (!A) {
          A = true;
          for (var o = arguments.length, R = new Array(o), _ = 0; _ < o; _++) R[_] = arguments[_];
          b.apply(this, R);
        }
      };
    }
    function i() {
    }
    function T(b) {
      return b.setHeader && typeof b.abort == "function";
    }
    function U(b, A, o) {
      if (typeof A == "function") return U(b, null, A);
      A || (A = {}), o = m(o || i);
      var R = A.readable || A.readable !== false && b.readable, _ = A.writable || A.writable !== false && b.writable, d = function() {
        b.writable || M();
      }, S = b._writableState && b._writableState.finished, M = function() {
        _ = false, S = true, R || o.call(b);
      }, D = b._readableState && b._readableState.endEmitted, w = function() {
        R = false, D = true, _ || o.call(b);
      }, C = function(v) {
        o.call(b, v);
      }, p = function() {
        var v;
        if (R && !D) return (!b._readableState || !b._readableState.ended) && (v = new n()), o.call(b, v);
        if (_ && !S) return (!b._writableState || !b._writableState.ended) && (v = new n()), o.call(b, v);
      }, s = function() {
        b.req.on("finish", M);
      };
      return T(b) ? (b.on("complete", M), b.on("abort", p), b.req ? s() : b.on("request", s)) : _ && !b._writableState && (b.on("end", d), b.on("close", d)), b.on("end", w), b.on("finish", M), A.error !== false && b.on("error", C), b.on("close", p), function() {
        b.removeListener("complete", M), b.removeListener("abort", p), b.removeListener("request", s), b.req && b.req.removeListener("finish", M), b.removeListener("end", d), b.removeListener("close", d), b.removeListener("finish", M), b.removeListener("end", w), b.removeListener("error", C), b.removeListener("close", p);
      };
    }
    return Sr = U, Sr;
  }
  var Rr, ct;
  function bn() {
    if (ct) return Rr;
    ct = 1;
    var n;
    function m(v, y, c) {
      return y = i(y), y in v ? Object.defineProperty(v, y, {
        value: c,
        enumerable: true,
        configurable: true,
        writable: true
      }) : v[y] = c, v;
    }
    function i(v) {
      var y = T(v, "string");
      return typeof y == "symbol" ? y : String(y);
    }
    function T(v, y) {
      if (typeof v != "object" || v === null) return v;
      var c = v[Symbol.toPrimitive];
      if (c !== void 0) {
        var E = c.call(v, y);
        if (typeof E != "object") return E;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return (y === "string" ? String : Number)(v);
    }
    var U = Gr(), b = /* @__PURE__ */ Symbol("lastResolve"), A = /* @__PURE__ */ Symbol("lastReject"), o = /* @__PURE__ */ Symbol("error"), R = /* @__PURE__ */ Symbol("ended"), _ = /* @__PURE__ */ Symbol("lastPromise"), d = /* @__PURE__ */ Symbol("handlePromise"), S = /* @__PURE__ */ Symbol("stream");
    function M(v, y) {
      return {
        value: v,
        done: y
      };
    }
    function D(v) {
      var y = v[b];
      if (y !== null) {
        var c = v[S].read();
        c !== null && (v[_] = null, v[b] = null, v[A] = null, y(M(c, false)));
      }
    }
    function w(v) {
      he.nextTick(D, v);
    }
    function C(v, y) {
      return function(c, E) {
        v.then(function() {
          if (y[R]) {
            c(M(void 0, true));
            return;
          }
          y[d](c, E);
        }, E);
      };
    }
    var p = Object.getPrototypeOf(function() {
    }), s = Object.setPrototypeOf((n = {
      get stream() {
        return this[S];
      },
      next: function() {
        var y = this, c = this[o];
        if (c !== null) return Promise.reject(c);
        if (this[R]) return Promise.resolve(M(void 0, true));
        if (this[S].destroyed) return new Promise(function(L, q) {
          he.nextTick(function() {
            y[o] ? q(y[o]) : L(M(void 0, true));
          });
        });
        var E = this[_], h;
        if (E) h = new Promise(C(E, this));
        else {
          var g = this[S].read();
          if (g !== null) return Promise.resolve(M(g, false));
          h = new Promise(this[d]);
        }
        return this[_] = h, h;
      }
    }, m(n, Symbol.asyncIterator, function() {
      return this;
    }), m(n, "return", function() {
      var y = this;
      return new Promise(function(c, E) {
        y[S].destroy(null, function(h) {
          if (h) {
            E(h);
            return;
          }
          c(M(void 0, true));
        });
      });
    }), n), p), f = function(y) {
      var c, E = Object.create(s, (c = {}, m(c, S, {
        value: y,
        writable: true
      }), m(c, b, {
        value: null,
        writable: true
      }), m(c, A, {
        value: null,
        writable: true
      }), m(c, o, {
        value: null,
        writable: true
      }), m(c, R, {
        value: y._readableState.endEmitted,
        writable: true
      }), m(c, d, {
        value: function(g, L) {
          var q = E[S].read();
          q ? (E[_] = null, E[b] = null, E[A] = null, g(M(q, false))) : (E[b] = g, E[A] = L);
        },
        writable: true
      }), c));
      return E[_] = null, U(y, function(h) {
        if (h && h.code !== "ERR_STREAM_PREMATURE_CLOSE") {
          var g = E[A];
          g !== null && (E[_] = null, E[b] = null, E[A] = null, g(h)), E[o] = h;
          return;
        }
        var L = E[b];
        L !== null && (E[_] = null, E[b] = null, E[A] = null, L(M(void 0, true))), E[R] = true;
      }), y.on("readable", w.bind(null, E)), E;
    };
    return Rr = f, Rr;
  }
  var xr, ht;
  function _n() {
    return ht || (ht = 1, xr = function() {
      throw new Error("Readable.from is not available in the browser");
    }), xr;
  }
  var Tr, dt;
  function zt() {
    if (dt) return Tr;
    dt = 1, Tr = L;
    var n;
    L.ReadableState = g, jt().EventEmitter;
    var m = function(l, W) {
      return l.listeners(W).length;
    }, i = $t(), T = ar().Buffer, U = (typeof we < "u" ? we : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
    };
    function b(a) {
      return T.from(a);
    }
    function A(a) {
      return T.isBuffer(a) || a instanceof U;
    }
    var o = qt(), R;
    o && o.debuglog ? R = o.debuglog("stream") : R = function() {
    };
    var _ = mn(), d = Gt(), S = Kt(), M = S.getHighWaterMark, D = Ve().codes, w = D.ERR_INVALID_ARG_TYPE, C = D.ERR_STREAM_PUSH_AFTER_EOF, p = D.ERR_METHOD_NOT_IMPLEMENTED, s = D.ERR_STREAM_UNSHIFT_AFTER_END_EVENT, f, v, y;
    je()(L, i);
    var c = d.errorOrDestroy, E = [
      "error",
      "close",
      "destroy",
      "pause",
      "resume"
    ];
    function h(a, l, W) {
      if (typeof a.prependListener == "function") return a.prependListener(l, W);
      !a._events || !a._events[l] ? a.on(l, W) : Array.isArray(a._events[l]) ? a._events[l].unshift(W) : a._events[l] = [
        W,
        a._events[l]
      ];
    }
    function g(a, l, W) {
      n = n || Ke(), a = a || {}, typeof W != "boolean" && (W = l instanceof n), this.objectMode = !!a.objectMode, W && (this.objectMode = this.objectMode || !!a.readableObjectMode), this.highWaterMark = M(this, a, "readableHighWaterMark", W), this.buffer = new _(), this.length = 0, this.pipes = null, this.pipesCount = 0, this.flowing = null, this.ended = false, this.endEmitted = false, this.reading = false, this.sync = true, this.needReadable = false, this.emittedReadable = false, this.readableListening = false, this.resumeScheduled = false, this.paused = true, this.emitClose = a.emitClose !== false, this.autoDestroy = !!a.autoDestroy, this.destroyed = false, this.defaultEncoding = a.defaultEncoding || "utf8", this.awaitDrain = 0, this.readingMore = false, this.decoder = null, this.encoding = null, a.encoding && (f || (f = lt().StringDecoder), this.decoder = new f(a.encoding), this.encoding = a.encoding);
    }
    function L(a) {
      if (n = n || Ke(), !(this instanceof L)) return new L(a);
      var l = this instanceof n;
      this._readableState = new g(a, this, l), this.readable = true, a && (typeof a.read == "function" && (this._read = a.read), typeof a.destroy == "function" && (this._destroy = a.destroy)), i.call(this);
    }
    Object.defineProperty(L.prototype, "destroyed", {
      enumerable: false,
      get: function() {
        return this._readableState === void 0 ? false : this._readableState.destroyed;
      },
      set: function(l) {
        this._readableState && (this._readableState.destroyed = l);
      }
    }), L.prototype.destroy = d.destroy, L.prototype._undestroy = d.undestroy, L.prototype._destroy = function(a, l) {
      l(a);
    }, L.prototype.push = function(a, l) {
      var W = this._readableState, G;
      return W.objectMode ? G = true : typeof a == "string" && (l = l || W.defaultEncoding, l !== W.encoding && (a = T.from(a, l), l = ""), G = true), q(this, a, l, false, G);
    }, L.prototype.unshift = function(a) {
      return q(this, a, null, true, false);
    };
    function q(a, l, W, G, ie) {
      R("readableAddChunk", l);
      var re = a._readableState;
      if (l === null) re.reading = false, J(a, re);
      else {
        var ae;
        if (ie || (ae = x(re, l)), ae) c(a, ae);
        else if (re.objectMode || l && l.length > 0) if (typeof l != "string" && !re.objectMode && Object.getPrototypeOf(l) !== T.prototype && (l = b(l)), G) re.endEmitted ? c(a, new s()) : $(a, re, l, true);
        else if (re.ended) c(a, new C());
        else {
          if (re.destroyed) return false;
          re.reading = false, re.decoder && !W ? (l = re.decoder.write(l), re.objectMode || l.length !== 0 ? $(a, re, l, false) : le(a, re)) : $(a, re, l, false);
        }
        else G || (re.reading = false, le(a, re));
      }
      return !re.ended && (re.length < re.highWaterMark || re.length === 0);
    }
    function $(a, l, W, G) {
      l.flowing && l.length === 0 && !l.sync ? (l.awaitDrain = 0, a.emit("data", W)) : (l.length += l.objectMode ? 1 : W.length, G ? l.buffer.unshift(W) : l.buffer.push(W), l.needReadable && se(a)), le(a, l);
    }
    function x(a, l) {
      var W;
      return !A(l) && typeof l != "string" && l !== void 0 && !a.objectMode && (W = new w("chunk", [
        "string",
        "Buffer",
        "Uint8Array"
      ], l)), W;
    }
    L.prototype.isPaused = function() {
      return this._readableState.flowing === false;
    }, L.prototype.setEncoding = function(a) {
      f || (f = lt().StringDecoder);
      var l = new f(a);
      this._readableState.decoder = l, this._readableState.encoding = this._readableState.decoder.encoding;
      for (var W = this._readableState.buffer.head, G = ""; W !== null; ) G += l.write(W.data), W = W.next;
      return this._readableState.buffer.clear(), G !== "" && this._readableState.buffer.push(G), this._readableState.length = G.length, this;
    };
    var z = 1073741824;
    function Q(a) {
      return a >= z ? a = z : (a--, a |= a >>> 1, a |= a >>> 2, a |= a >>> 4, a |= a >>> 8, a |= a >>> 16, a++), a;
    }
    function Z(a, l) {
      return a <= 0 || l.length === 0 && l.ended ? 0 : l.objectMode ? 1 : a !== a ? l.flowing && l.length ? l.buffer.head.data.length : l.length : (a > l.highWaterMark && (l.highWaterMark = Q(a)), a <= l.length ? a : l.ended ? l.length : (l.needReadable = true, 0));
    }
    L.prototype.read = function(a) {
      R("read", a), a = parseInt(a, 10);
      var l = this._readableState, W = a;
      if (a !== 0 && (l.emittedReadable = false), a === 0 && l.needReadable && ((l.highWaterMark !== 0 ? l.length >= l.highWaterMark : l.length > 0) || l.ended)) return R("read: emitReadable", l.length, l.ended), l.length === 0 && l.ended ? H(this) : se(this), null;
      if (a = Z(a, l), a === 0 && l.ended) return l.length === 0 && H(this), null;
      var G = l.needReadable;
      R("need readable", G), (l.length === 0 || l.length - a < l.highWaterMark) && (G = true, R("length less than watermark", G)), l.ended || l.reading ? (G = false, R("reading or ended", G)) : G && (R("do read"), l.reading = true, l.sync = true, l.length === 0 && (l.needReadable = true), this._read(l.highWaterMark), l.sync = false, l.reading || (a = Z(W, l)));
      var ie;
      return a > 0 ? ie = B(a, l) : ie = null, ie === null ? (l.needReadable = l.length <= l.highWaterMark, a = 0) : (l.length -= a, l.awaitDrain = 0), l.length === 0 && (l.ended || (l.needReadable = true), W !== a && l.ended && H(this)), ie !== null && this.emit("data", ie), ie;
    };
    function J(a, l) {
      if (R("onEofChunk"), !l.ended) {
        if (l.decoder) {
          var W = l.decoder.end();
          W && W.length && (l.buffer.push(W), l.length += l.objectMode ? 1 : W.length);
        }
        l.ended = true, l.sync ? se(a) : (l.needReadable = false, l.emittedReadable || (l.emittedReadable = true, j(a)));
      }
    }
    function se(a) {
      var l = a._readableState;
      R("emitReadable", l.needReadable, l.emittedReadable), l.needReadable = false, l.emittedReadable || (R("emitReadable", l.flowing), l.emittedReadable = true, he.nextTick(j, a));
    }
    function j(a) {
      var l = a._readableState;
      R("emitReadable_", l.destroyed, l.length, l.ended), !l.destroyed && (l.length || l.ended) && (a.emit("readable"), l.emittedReadable = false), l.needReadable = !l.flowing && !l.ended && l.length <= l.highWaterMark, I(a);
    }
    function le(a, l) {
      l.readingMore || (l.readingMore = true, he.nextTick(K, a, l));
    }
    function K(a, l) {
      for (; !l.reading && !l.ended && (l.length < l.highWaterMark || l.flowing && l.length === 0); ) {
        var W = l.length;
        if (R("maybeReadMore read 0"), a.read(0), W === l.length) break;
      }
      l.readingMore = false;
    }
    L.prototype._read = function(a) {
      c(this, new p("_read()"));
    }, L.prototype.pipe = function(a, l) {
      var W = this, G = this._readableState;
      switch (G.pipesCount) {
        case 0:
          G.pipes = a;
          break;
        case 1:
          G.pipes = [
            G.pipes,
            a
          ];
          break;
        default:
          G.pipes.push(a);
          break;
      }
      G.pipesCount += 1, R("pipe count=%d opts=%j", G.pipesCount, l);
      var ie = (!l || l.end !== false) && a !== he.stdout && a !== he.stderr, re = ie ? Se : Ce;
      G.endEmitted ? he.nextTick(re) : W.once("end", re), a.on("unpipe", ae);
      function ae(Te, Ie) {
        R("onunpipe"), Te === W && Ie && Ie.hasUnpiped === false && (Ie.hasUnpiped = true, ze());
      }
      function Se() {
        R("onend"), a.end();
      }
      var Ne = Y(W);
      a.on("drain", Ne);
      var ke = false;
      function ze() {
        R("cleanup"), a.removeListener("close", Pe), a.removeListener("finish", De), a.removeListener("drain", Ne), a.removeListener("error", _e), a.removeListener("unpipe", ae), W.removeListener("end", Se), W.removeListener("end", Ce), W.removeListener("data", be), ke = true, G.awaitDrain && (!a._writableState || a._writableState.needDrain) && Ne();
      }
      W.on("data", be);
      function be(Te) {
        R("ondata");
        var Ie = a.write(Te);
        R("dest.write", Ie), Ie === false && ((G.pipesCount === 1 && G.pipes === a || G.pipesCount > 1 && X(G.pipes, a) !== -1) && !ke && (R("false write response, pause", G.awaitDrain), G.awaitDrain++), W.pause());
      }
      function _e(Te) {
        R("onerror", Te), Ce(), a.removeListener("error", _e), m(a, "error") === 0 && c(a, Te);
      }
      h(a, "error", _e);
      function Pe() {
        a.removeListener("finish", De), Ce();
      }
      a.once("close", Pe);
      function De() {
        R("onfinish"), a.removeListener("close", Pe), Ce();
      }
      a.once("finish", De);
      function Ce() {
        R("unpipe"), W.unpipe(a);
      }
      return a.emit("pipe", W), G.flowing || (R("pipe resume"), W.resume()), a;
    };
    function Y(a) {
      return function() {
        var W = a._readableState;
        R("pipeOnDrain", W.awaitDrain), W.awaitDrain && W.awaitDrain--, W.awaitDrain === 0 && m(a, "data") && (W.flowing = true, I(a));
      };
    }
    L.prototype.unpipe = function(a) {
      var l = this._readableState, W = {
        hasUnpiped: false
      };
      if (l.pipesCount === 0) return this;
      if (l.pipesCount === 1) return a && a !== l.pipes ? this : (a || (a = l.pipes), l.pipes = null, l.pipesCount = 0, l.flowing = false, a && a.emit("unpipe", this, W), this);
      if (!a) {
        var G = l.pipes, ie = l.pipesCount;
        l.pipes = null, l.pipesCount = 0, l.flowing = false;
        for (var re = 0; re < ie; re++) G[re].emit("unpipe", this, {
          hasUnpiped: false
        });
        return this;
      }
      var ae = X(l.pipes, a);
      return ae === -1 ? this : (l.pipes.splice(ae, 1), l.pipesCount -= 1, l.pipesCount === 1 && (l.pipes = l.pipes[0]), a.emit("unpipe", this, W), this);
    }, L.prototype.on = function(a, l) {
      var W = i.prototype.on.call(this, a, l), G = this._readableState;
      return a === "data" ? (G.readableListening = this.listenerCount("readable") > 0, G.flowing !== false && this.resume()) : a === "readable" && !G.endEmitted && !G.readableListening && (G.readableListening = G.needReadable = true, G.flowing = false, G.emittedReadable = false, R("on readable", G.length, G.reading), G.length ? se(this) : G.reading || he.nextTick(oe, this)), W;
    }, L.prototype.addListener = L.prototype.on, L.prototype.removeListener = function(a, l) {
      var W = i.prototype.removeListener.call(this, a, l);
      return a === "readable" && he.nextTick(ee, this), W;
    }, L.prototype.removeAllListeners = function(a) {
      var l = i.prototype.removeAllListeners.apply(this, arguments);
      return (a === "readable" || a === void 0) && he.nextTick(ee, this), l;
    };
    function ee(a) {
      var l = a._readableState;
      l.readableListening = a.listenerCount("readable") > 0, l.resumeScheduled && !l.paused ? l.flowing = true : a.listenerCount("data") > 0 && a.resume();
    }
    function oe(a) {
      R("readable nexttick read 0"), a.read(0);
    }
    L.prototype.resume = function() {
      var a = this._readableState;
      return a.flowing || (R("resume"), a.flowing = !a.readableListening, fe(this, a)), a.paused = false, this;
    };
    function fe(a, l) {
      l.resumeScheduled || (l.resumeScheduled = true, he.nextTick(de, a, l));
    }
    function de(a, l) {
      R("resume", l.reading), l.reading || a.read(0), l.resumeScheduled = false, a.emit("resume"), I(a), l.flowing && !l.reading && a.read(0);
    }
    L.prototype.pause = function() {
      return R("call pause flowing=%j", this._readableState.flowing), this._readableState.flowing !== false && (R("pause"), this._readableState.flowing = false, this.emit("pause")), this._readableState.paused = true, this;
    };
    function I(a) {
      var l = a._readableState;
      for (R("flow", l.flowing); l.flowing && a.read() !== null; ) ;
    }
    L.prototype.wrap = function(a) {
      var l = this, W = this._readableState, G = false;
      a.on("end", function() {
        if (R("wrapped end"), W.decoder && !W.ended) {
          var ae = W.decoder.end();
          ae && ae.length && l.push(ae);
        }
        l.push(null);
      }), a.on("data", function(ae) {
        if (R("wrapped data"), W.decoder && (ae = W.decoder.write(ae)), !(W.objectMode && ae == null) && !(!W.objectMode && (!ae || !ae.length))) {
          var Se = l.push(ae);
          Se || (G = true, a.pause());
        }
      });
      for (var ie in a) this[ie] === void 0 && typeof a[ie] == "function" && (this[ie] = /* @__PURE__ */ (function(Se) {
        return function() {
          return a[Se].apply(a, arguments);
        };
      })(ie));
      for (var re = 0; re < E.length; re++) a.on(E[re], this.emit.bind(this, E[re]));
      return this._read = function(ae) {
        R("wrapped _read", ae), G && (G = false, a.resume());
      }, this;
    }, typeof Symbol == "function" && (L.prototype[Symbol.asyncIterator] = function() {
      return v === void 0 && (v = bn()), v(this);
    }), Object.defineProperty(L.prototype, "readableHighWaterMark", {
      enumerable: false,
      get: function() {
        return this._readableState.highWaterMark;
      }
    }), Object.defineProperty(L.prototype, "readableBuffer", {
      enumerable: false,
      get: function() {
        return this._readableState && this._readableState.buffer;
      }
    }), Object.defineProperty(L.prototype, "readableFlowing", {
      enumerable: false,
      get: function() {
        return this._readableState.flowing;
      },
      set: function(l) {
        this._readableState && (this._readableState.flowing = l);
      }
    }), L._fromList = B, Object.defineProperty(L.prototype, "readableLength", {
      enumerable: false,
      get: function() {
        return this._readableState.length;
      }
    });
    function B(a, l) {
      if (l.length === 0) return null;
      var W;
      return l.objectMode ? W = l.buffer.shift() : !a || a >= l.length ? (l.decoder ? W = l.buffer.join("") : l.buffer.length === 1 ? W = l.buffer.first() : W = l.buffer.concat(l.length), l.buffer.clear()) : W = l.buffer.consume(a, l.decoder), W;
    }
    function H(a) {
      var l = a._readableState;
      R("endReadable", l.endEmitted), l.endEmitted || (l.ended = true, he.nextTick(V, l, a));
    }
    function V(a, l) {
      if (R("endReadableNT", a.endEmitted, a.length), !a.endEmitted && a.length === 0 && (a.endEmitted = true, l.readable = false, l.emit("end"), a.autoDestroy)) {
        var W = l._writableState;
        (!W || W.autoDestroy && W.finished) && l.destroy();
      }
    }
    typeof Symbol == "function" && (L.from = function(a, l) {
      return y === void 0 && (y = _n()), y(L, a, l);
    });
    function X(a, l) {
      for (var W = 0, G = a.length; W < G; W++) if (a[W] === l) return W;
      return -1;
    }
    return Tr;
  }
  var Ar, pt;
  function Yt() {
    if (pt) return Ar;
    pt = 1, Ar = o;
    var n = Ve().codes, m = n.ERR_METHOD_NOT_IMPLEMENTED, i = n.ERR_MULTIPLE_CALLBACK, T = n.ERR_TRANSFORM_ALREADY_TRANSFORMING, U = n.ERR_TRANSFORM_WITH_LENGTH_0, b = Ke();
    je()(o, b);
    function A(d, S) {
      var M = this._transformState;
      M.transforming = false;
      var D = M.writecb;
      if (D === null) return this.emit("error", new i());
      M.writechunk = null, M.writecb = null, S != null && this.push(S), D(d);
      var w = this._readableState;
      w.reading = false, (w.needReadable || w.length < w.highWaterMark) && this._read(w.highWaterMark);
    }
    function o(d) {
      if (!(this instanceof o)) return new o(d);
      b.call(this, d), this._transformState = {
        afterTransform: A.bind(this),
        needTransform: false,
        transforming: false,
        writecb: null,
        writechunk: null,
        writeencoding: null
      }, this._readableState.needReadable = true, this._readableState.sync = false, d && (typeof d.transform == "function" && (this._transform = d.transform), typeof d.flush == "function" && (this._flush = d.flush)), this.on("prefinish", R);
    }
    function R() {
      var d = this;
      typeof this._flush == "function" && !this._readableState.destroyed ? this._flush(function(S, M) {
        _(d, S, M);
      }) : _(this, null, null);
    }
    o.prototype.push = function(d, S) {
      return this._transformState.needTransform = false, b.prototype.push.call(this, d, S);
    }, o.prototype._transform = function(d, S, M) {
      M(new m("_transform()"));
    }, o.prototype._write = function(d, S, M) {
      var D = this._transformState;
      if (D.writecb = M, D.writechunk = d, D.writeencoding = S, !D.transforming) {
        var w = this._readableState;
        (D.needTransform || w.needReadable || w.length < w.highWaterMark) && this._read(w.highWaterMark);
      }
    }, o.prototype._read = function(d) {
      var S = this._transformState;
      S.writechunk !== null && !S.transforming ? (S.transforming = true, this._transform(S.writechunk, S.writeencoding, S.afterTransform)) : S.needTransform = true;
    }, o.prototype._destroy = function(d, S) {
      b.prototype._destroy.call(this, d, function(M) {
        S(M);
      });
    };
    function _(d, S, M) {
      if (S) return d.emit("error", S);
      if (M != null && d.push(M), d._writableState.length) throw new U();
      if (d._transformState.transforming) throw new T();
      return d.push(null);
    }
    return Ar;
  }
  var Or, yt;
  function En() {
    if (yt) return Or;
    yt = 1, Or = m;
    var n = Yt();
    je()(m, n);
    function m(i) {
      if (!(this instanceof m)) return new m(i);
      n.call(this, i);
    }
    return m.prototype._transform = function(i, T, U) {
      U(null, i);
    }, Or;
  }
  var Lr, gt;
  function Sn() {
    if (gt) return Lr;
    gt = 1;
    var n;
    function m(M) {
      var D = false;
      return function() {
        D || (D = true, M.apply(void 0, arguments));
      };
    }
    var i = Ve().codes, T = i.ERR_MISSING_ARGS, U = i.ERR_STREAM_DESTROYED;
    function b(M) {
      if (M) throw M;
    }
    function A(M) {
      return M.setHeader && typeof M.abort == "function";
    }
    function o(M, D, w, C) {
      C = m(C);
      var p = false;
      M.on("close", function() {
        p = true;
      }), n === void 0 && (n = Gr()), n(M, {
        readable: D,
        writable: w
      }, function(f) {
        if (f) return C(f);
        p = true, C();
      });
      var s = false;
      return function(f) {
        if (!p && !s) {
          if (s = true, A(M)) return M.abort();
          if (typeof M.destroy == "function") return M.destroy();
          C(f || new U("pipe"));
        }
      };
    }
    function R(M) {
      M();
    }
    function _(M, D) {
      return M.pipe(D);
    }
    function d(M) {
      return !M.length || typeof M[M.length - 1] != "function" ? b : M.pop();
    }
    function S() {
      for (var M = arguments.length, D = new Array(M), w = 0; w < M; w++) D[w] = arguments[w];
      var C = d(D);
      if (Array.isArray(D[0]) && (D = D[0]), D.length < 2) throw new T("streams");
      var p, s = D.map(function(f, v) {
        var y = v < D.length - 1, c = v > 0;
        return o(f, y, c, function(E) {
          p || (p = E), E && s.forEach(R), !y && (s.forEach(R), C(p));
        });
      });
      return D.reduce(_);
    }
    return Lr = S, Lr;
  }
  var mt;
  function Xt() {
    return mt || (mt = 1, (function(n, m) {
      m = n.exports = zt(), m.Stream = m, m.Readable = m, m.Writable = Vt(), m.Duplex = Ke(), m.Transform = Yt(), m.PassThrough = En(), m.finished = Gr(), m.pipeline = Sn();
    })(rr, rr.exports)), rr.exports;
  }
  var vt;
  function Qt() {
    if (vt) return er;
    vt = 1;
    var n = Ht(), m = je(), i = Xt(), T = er.readyStates = {
      UNSENT: 0,
      OPENED: 1,
      HEADERS_RECEIVED: 2,
      LOADING: 3,
      DONE: 4
    }, U = er.IncomingMessage = function(b, A, o, R) {
      var _ = this;
      if (i.Readable.call(_), _._mode = o, _.headers = {}, _.rawHeaders = [], _.trailers = {}, _.rawTrailers = [], _.on("end", function() {
        he.nextTick(function() {
          _.emit("close");
        });
      }), o === "fetch") {
        let C = function() {
          S.read().then(function(p) {
            if (!_._destroyed) {
              if (R(p.done), p.done) {
                _.push(null);
                return;
              }
              _.push(He.from(p.value)), C();
            }
          }).catch(function(p) {
            R(true), _._destroyed || _.emit("error", p);
          });
        };
        if (_._fetchResponse = A, _.url = A.url, _.statusCode = A.status, _.statusMessage = A.statusText, A.headers.forEach(function(p, s) {
          _.headers[s.toLowerCase()] = p, _.rawHeaders.push(s, p);
        }), n.writableStream) {
          var d = new WritableStream({
            write: function(p) {
              return R(false), new Promise(function(s, f) {
                _._destroyed ? f() : _.push(He.from(p)) ? s() : _._resumeFetch = s;
              });
            },
            close: function() {
              R(true), _._destroyed || _.push(null);
            },
            abort: function(p) {
              R(true), _._destroyed || _.emit("error", p);
            }
          });
          try {
            A.body.pipeTo(d).catch(function(p) {
              R(true), _._destroyed || _.emit("error", p);
            });
            return;
          } catch {
          }
        }
        var S = A.body.getReader();
        C();
      } else {
        _._xhr = b, _._pos = 0, _.url = b.responseURL, _.statusCode = b.status, _.statusMessage = b.statusText;
        var M = b.getAllResponseHeaders().split(/\r?\n/);
        if (M.forEach(function(C) {
          var p = C.match(/^([^:]+):\s*(.*)/);
          if (p) {
            var s = p[1].toLowerCase();
            s === "set-cookie" ? (_.headers[s] === void 0 && (_.headers[s] = []), _.headers[s].push(p[2])) : _.headers[s] !== void 0 ? _.headers[s] += ", " + p[2] : _.headers[s] = p[2], _.rawHeaders.push(p[1], p[2]);
          }
        }), _._charset = "x-user-defined", !n.overrideMimeType) {
          var D = _.rawHeaders["mime-type"];
          if (D) {
            var w = D.match(/;\s*charset=([^;])(;|$)/);
            w && (_._charset = w[1].toLowerCase());
          }
          _._charset || (_._charset = "utf-8");
        }
      }
    };
    return m(U, i.Readable), U.prototype._read = function() {
      var b = this, A = b._resumeFetch;
      A && (b._resumeFetch = null, A());
    }, U.prototype._onXHRProgress = function(b) {
      var A = this, o = A._xhr, R = null;
      switch (A._mode) {
        case "text":
          if (R = o.responseText, R.length > A._pos) {
            var _ = R.substr(A._pos);
            if (A._charset === "x-user-defined") {
              for (var d = He.alloc(_.length), S = 0; S < _.length; S++) d[S] = _.charCodeAt(S) & 255;
              A.push(d);
            } else A.push(_, A._charset);
            A._pos = R.length;
          }
          break;
        case "arraybuffer":
          if (o.readyState !== T.DONE || !o.response) break;
          R = o.response, A.push(He.from(new Uint8Array(R)));
          break;
        case "moz-chunked-arraybuffer":
          if (R = o.response, o.readyState !== T.LOADING || !R) break;
          A.push(He.from(new Uint8Array(R)));
          break;
        case "ms-stream":
          if (R = o.response, o.readyState !== T.LOADING) break;
          var M = new we.MSStreamReader();
          M.onprogress = function() {
            M.result.byteLength > A._pos && (A.push(He.from(new Uint8Array(M.result.slice(A._pos)))), A._pos = M.result.byteLength);
          }, M.onload = function() {
            b(true), A.push(null);
          }, M.readAsArrayBuffer(R);
          break;
      }
      A._xhr.readyState === T.DONE && A._mode !== "ms-stream" && (b(true), A.push(null));
    }, er;
  }
  var wt;
  function Rn() {
    if (wt) return cr.exports;
    wt = 1;
    var n = Ht(), m = je(), i = Qt(), T = Xt(), U = i.IncomingMessage, b = i.readyStates;
    function A(d, S) {
      return n.fetch && S ? "fetch" : n.mozchunkedarraybuffer ? "moz-chunked-arraybuffer" : n.msstream ? "ms-stream" : n.arraybuffer && d ? "arraybuffer" : "text";
    }
    var o = cr.exports = function(d) {
      var S = this;
      T.Writable.call(S), S._opts = d, S._body = [], S._headers = {}, d.auth && S.setHeader("Authorization", "Basic " + He.from(d.auth).toString("base64")), Object.keys(d.headers).forEach(function(w) {
        S.setHeader(w, d.headers[w]);
      });
      var M, D = true;
      if (d.mode === "disable-fetch" || "requestTimeout" in d && !n.abortController) D = false, M = true;
      else if (d.mode === "prefer-streaming") M = false;
      else if (d.mode === "allow-wrong-content-type") M = !n.overrideMimeType;
      else if (!d.mode || d.mode === "default" || d.mode === "prefer-fast") M = true;
      else throw new Error("Invalid value for opts.mode");
      S._mode = A(M, D), S._fetchTimer = null, S._socketTimeout = null, S._socketTimer = null, S.on("finish", function() {
        S._onFinish();
      });
    };
    m(o, T.Writable), o.prototype.setHeader = function(d, S) {
      var M = this, D = d.toLowerCase();
      _.indexOf(D) === -1 && (M._headers[D] = {
        name: d,
        value: S
      });
    }, o.prototype.getHeader = function(d) {
      var S = this._headers[d.toLowerCase()];
      return S ? S.value : null;
    }, o.prototype.removeHeader = function(d) {
      var S = this;
      delete S._headers[d.toLowerCase()];
    }, o.prototype._onFinish = function() {
      var d = this;
      if (!d._destroyed) {
        var S = d._opts;
        "timeout" in S && S.timeout !== 0 && d.setTimeout(S.timeout);
        var M = d._headers, D = null;
        S.method !== "GET" && S.method !== "HEAD" && (D = new Blob(d._body, {
          type: (M["content-type"] || {}).value || ""
        }));
        var w = [];
        if (Object.keys(M).forEach(function(f) {
          var v = M[f].name, y = M[f].value;
          Array.isArray(y) ? y.forEach(function(c) {
            w.push([
              v,
              c
            ]);
          }) : w.push([
            v,
            y
          ]);
        }), d._mode === "fetch") {
          var C = null;
          if (n.abortController) {
            var p = new AbortController();
            C = p.signal, d._fetchAbortController = p, "requestTimeout" in S && S.requestTimeout !== 0 && (d._fetchTimer = we.setTimeout(function() {
              d.emit("requestTimeout"), d._fetchAbortController && d._fetchAbortController.abort();
            }, S.requestTimeout));
          }
          we.fetch(d._opts.url, {
            method: d._opts.method,
            headers: w,
            body: D || void 0,
            mode: "cors",
            credentials: S.withCredentials ? "include" : "same-origin",
            signal: C
          }).then(function(f) {
            d._fetchResponse = f, d._resetTimers(false), d._connect();
          }, function(f) {
            d._resetTimers(true), d._destroyed || d.emit("error", f);
          });
        } else {
          var s = d._xhr = new we.XMLHttpRequest();
          try {
            s.open(d._opts.method, d._opts.url, true);
          } catch (f) {
            he.nextTick(function() {
              d.emit("error", f);
            });
            return;
          }
          "responseType" in s && (s.responseType = d._mode), "withCredentials" in s && (s.withCredentials = !!S.withCredentials), d._mode === "text" && "overrideMimeType" in s && s.overrideMimeType("text/plain; charset=x-user-defined"), "requestTimeout" in S && (s.timeout = S.requestTimeout, s.ontimeout = function() {
            d.emit("requestTimeout");
          }), w.forEach(function(f) {
            s.setRequestHeader(f[0], f[1]);
          }), d._response = null, s.onreadystatechange = function() {
            switch (s.readyState) {
              case b.LOADING:
              case b.DONE:
                d._onXHRProgress();
                break;
            }
          }, d._mode === "moz-chunked-arraybuffer" && (s.onprogress = function() {
            d._onXHRProgress();
          }), s.onerror = function() {
            d._destroyed || (d._resetTimers(true), d.emit("error", new Error("XHR error")));
          };
          try {
            s.send(D);
          } catch (f) {
            he.nextTick(function() {
              d.emit("error", f);
            });
            return;
          }
        }
      }
    };
    function R(d) {
      try {
        var S = d.status;
        return S !== null && S !== 0;
      } catch {
        return false;
      }
    }
    o.prototype._onXHRProgress = function() {
      var d = this;
      d._resetTimers(false), !(!R(d._xhr) || d._destroyed) && (d._response || d._connect(), d._response._onXHRProgress(d._resetTimers.bind(d)));
    }, o.prototype._connect = function() {
      var d = this;
      d._destroyed || (d._response = new U(d._xhr, d._fetchResponse, d._mode, d._resetTimers.bind(d)), d._response.on("error", function(S) {
        d.emit("error", S);
      }), d.emit("response", d._response));
    }, o.prototype._write = function(d, S, M) {
      var D = this;
      D._body.push(d), M();
    }, o.prototype._resetTimers = function(d) {
      var S = this;
      we.clearTimeout(S._socketTimer), S._socketTimer = null, d ? (we.clearTimeout(S._fetchTimer), S._fetchTimer = null) : S._socketTimeout && (S._socketTimer = we.setTimeout(function() {
        S.emit("timeout");
      }, S._socketTimeout));
    }, o.prototype.abort = o.prototype.destroy = function(d) {
      var S = this;
      S._destroyed = true, S._resetTimers(true), S._response && (S._response._destroyed = true), S._xhr ? S._xhr.abort() : S._fetchAbortController && S._fetchAbortController.abort(), d && S.emit("error", d);
    }, o.prototype.end = function(d, S, M) {
      var D = this;
      typeof d == "function" && (M = d, d = void 0), T.Writable.prototype.end.call(D, d, S, M);
    }, o.prototype.setTimeout = function(d, S) {
      var M = this;
      S && M.once("timeout", S), M._socketTimeout = d, M._resetTimers(false);
    }, o.prototype.flushHeaders = function() {
    }, o.prototype.setNoDelay = function() {
    }, o.prototype.setSocketKeepAlive = function() {
    };
    var _ = [
      "accept-charset",
      "accept-encoding",
      "access-control-request-headers",
      "access-control-request-method",
      "connection",
      "content-length",
      "cookie",
      "cookie2",
      "date",
      "dnt",
      "expect",
      "host",
      "keep-alive",
      "origin",
      "referer",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade",
      "via"
    ];
    return cr.exports;
  }
  var Ir, bt;
  function xn() {
    if (bt) return Ir;
    bt = 1, Ir = m;
    var n = Object.prototype.hasOwnProperty;
    function m() {
      for (var i = {}, T = 0; T < arguments.length; T++) {
        var U = arguments[T];
        for (var b in U) n.call(U, b) && (i[b] = U[b]);
      }
      return i;
    }
    return Ir;
  }
  var Cr, _t;
  function Tn() {
    return _t || (_t = 1, Cr = {
      100: "Continue",
      101: "Switching Protocols",
      102: "Processing",
      200: "OK",
      201: "Created",
      202: "Accepted",
      203: "Non-Authoritative Information",
      204: "No Content",
      205: "Reset Content",
      206: "Partial Content",
      207: "Multi-Status",
      208: "Already Reported",
      226: "IM Used",
      300: "Multiple Choices",
      301: "Moved Permanently",
      302: "Found",
      303: "See Other",
      304: "Not Modified",
      305: "Use Proxy",
      307: "Temporary Redirect",
      308: "Permanent Redirect",
      400: "Bad Request",
      401: "Unauthorized",
      402: "Payment Required",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      406: "Not Acceptable",
      407: "Proxy Authentication Required",
      408: "Request Timeout",
      409: "Conflict",
      410: "Gone",
      411: "Length Required",
      412: "Precondition Failed",
      413: "Payload Too Large",
      414: "URI Too Long",
      415: "Unsupported Media Type",
      416: "Range Not Satisfiable",
      417: "Expectation Failed",
      418: "I'm a teapot",
      421: "Misdirected Request",
      422: "Unprocessable Entity",
      423: "Locked",
      424: "Failed Dependency",
      425: "Unordered Collection",
      426: "Upgrade Required",
      428: "Precondition Required",
      429: "Too Many Requests",
      431: "Request Header Fields Too Large",
      451: "Unavailable For Legal Reasons",
      500: "Internal Server Error",
      501: "Not Implemented",
      502: "Bad Gateway",
      503: "Service Unavailable",
      504: "Gateway Timeout",
      505: "HTTP Version Not Supported",
      506: "Variant Also Negotiates",
      507: "Insufficient Storage",
      508: "Loop Detected",
      509: "Bandwidth Limit Exceeded",
      510: "Not Extended",
      511: "Network Authentication Required"
    }), Cr;
  }
  var Xe = {
    exports: {}
  };
  var An = Xe.exports, Et;
  function On() {
    return Et || (Et = 1, (function(n, m) {
      (function(i) {
        var T = m && !m.nodeType && m, U = n && !n.nodeType && n, b = typeof we == "object" && we;
        (b.global === b || b.window === b || b.self === b) && (i = b);
        var A, o = 2147483647, R = 36, _ = 1, d = 26, S = 38, M = 700, D = 72, w = 128, C = "-", p = /^xn--/, s = /[^\x20-\x7E]/, f = /[\x2E\u3002\uFF0E\uFF61]/g, v = {
          overflow: "Overflow: input needs wider integers to process",
          "not-basic": "Illegal input >= 0x80 (not a basic code point)",
          "invalid-input": "Invalid input"
        }, y = R - _, c = Math.floor, E = String.fromCharCode, h;
        function g(K) {
          throw new RangeError(v[K]);
        }
        function L(K, Y) {
          for (var ee = K.length, oe = []; ee--; ) oe[ee] = Y(K[ee]);
          return oe;
        }
        function q(K, Y) {
          var ee = K.split("@"), oe = "";
          ee.length > 1 && (oe = ee[0] + "@", K = ee[1]), K = K.replace(f, ".");
          var fe = K.split("."), de = L(fe, Y).join(".");
          return oe + de;
        }
        function $(K) {
          for (var Y = [], ee = 0, oe = K.length, fe, de; ee < oe; ) fe = K.charCodeAt(ee++), fe >= 55296 && fe <= 56319 && ee < oe ? (de = K.charCodeAt(ee++), (de & 64512) == 56320 ? Y.push(((fe & 1023) << 10) + (de & 1023) + 65536) : (Y.push(fe), ee--)) : Y.push(fe);
          return Y;
        }
        function x(K) {
          return L(K, function(Y) {
            var ee = "";
            return Y > 65535 && (Y -= 65536, ee += E(Y >>> 10 & 1023 | 55296), Y = 56320 | Y & 1023), ee += E(Y), ee;
          }).join("");
        }
        function z(K) {
          return K - 48 < 10 ? K - 22 : K - 65 < 26 ? K - 65 : K - 97 < 26 ? K - 97 : R;
        }
        function Q(K, Y) {
          return K + 22 + 75 * (K < 26) - ((Y != 0) << 5);
        }
        function Z(K, Y, ee) {
          var oe = 0;
          for (K = ee ? c(K / M) : K >> 1, K += c(K / Y); K > y * d >> 1; oe += R) K = c(K / y);
          return c(oe + (y + 1) * K / (K + S));
        }
        function J(K) {
          var Y = [], ee = K.length, oe, fe = 0, de = w, I = D, B, H, V, X, a, l, W, G, ie;
          for (B = K.lastIndexOf(C), B < 0 && (B = 0), H = 0; H < B; ++H) K.charCodeAt(H) >= 128 && g("not-basic"), Y.push(K.charCodeAt(H));
          for (V = B > 0 ? B + 1 : 0; V < ee; ) {
            for (X = fe, a = 1, l = R; V >= ee && g("invalid-input"), W = z(K.charCodeAt(V++)), (W >= R || W > c((o - fe) / a)) && g("overflow"), fe += W * a, G = l <= I ? _ : l >= I + d ? d : l - I, !(W < G); l += R) ie = R - G, a > c(o / ie) && g("overflow"), a *= ie;
            oe = Y.length + 1, I = Z(fe - X, oe, X == 0), c(fe / oe) > o - de && g("overflow"), de += c(fe / oe), fe %= oe, Y.splice(fe++, 0, de);
          }
          return x(Y);
        }
        function se(K) {
          var Y, ee, oe, fe, de, I, B, H, V, X, a, l = [], W, G, ie, re;
          for (K = $(K), W = K.length, Y = w, ee = 0, de = D, I = 0; I < W; ++I) a = K[I], a < 128 && l.push(E(a));
          for (oe = fe = l.length, fe && l.push(C); oe < W; ) {
            for (B = o, I = 0; I < W; ++I) a = K[I], a >= Y && a < B && (B = a);
            for (G = oe + 1, B - Y > c((o - ee) / G) && g("overflow"), ee += (B - Y) * G, Y = B, I = 0; I < W; ++I) if (a = K[I], a < Y && ++ee > o && g("overflow"), a == Y) {
              for (H = ee, V = R; X = V <= de ? _ : V >= de + d ? d : V - de, !(H < X); V += R) re = H - X, ie = R - X, l.push(E(Q(X + re % ie, 0))), H = c(re / ie);
              l.push(E(Q(H, 0))), de = Z(ee, G, oe == fe), ee = 0, ++oe;
            }
            ++ee, ++Y;
          }
          return l.join("");
        }
        function j(K) {
          return q(K, function(Y) {
            return p.test(Y) ? J(Y.slice(4).toLowerCase()) : Y;
          });
        }
        function le(K) {
          return q(K, function(Y) {
            return s.test(Y) ? "xn--" + se(Y) : Y;
          });
        }
        if (A = {
          version: "1.4.1",
          ucs2: {
            decode: $,
            encode: x
          },
          decode: J,
          encode: se,
          toASCII: le,
          toUnicode: j
        }, T && U) if (n.exports == T) U.exports = A;
        else for (h in A) A.hasOwnProperty(h) && (T[h] = A[h]);
        else i.punycode = A;
      })(An);
    })(Xe, Xe.exports)), Xe.exports;
  }
  var Ln = On();
  const In = Dt(Ln), Cn = Ut(yn);
  var Br, St;
  function or() {
    if (St) return Br;
    St = 1;
    var n = typeof Map == "function" && Map.prototype, m = Object.getOwnPropertyDescriptor && n ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null, i = n && m && typeof m.get == "function" ? m.get : null, T = n && Map.prototype.forEach, U = typeof Set == "function" && Set.prototype, b = Object.getOwnPropertyDescriptor && U ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null, A = U && b && typeof b.get == "function" ? b.get : null, o = U && Set.prototype.forEach, R = typeof WeakMap == "function" && WeakMap.prototype, _ = R ? WeakMap.prototype.has : null, d = typeof WeakSet == "function" && WeakSet.prototype, S = d ? WeakSet.prototype.has : null, M = typeof WeakRef == "function" && WeakRef.prototype, D = M ? WeakRef.prototype.deref : null, w = Boolean.prototype.valueOf, C = Object.prototype.toString, p = Function.prototype.toString, s = String.prototype.match, f = String.prototype.slice, v = String.prototype.replace, y = String.prototype.toUpperCase, c = String.prototype.toLowerCase, E = RegExp.prototype.test, h = Array.prototype.concat, g = Array.prototype.join, L = Array.prototype.slice, q = Math.floor, $ = typeof BigInt == "function" ? BigInt.prototype.valueOf : null, x = Object.getOwnPropertySymbols, z = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? Symbol.prototype.toString : null, Q = typeof Symbol == "function" && typeof Symbol.iterator == "object", Z = typeof Symbol == "function" && Symbol.toStringTag && (typeof Symbol.toStringTag === Q || true) ? Symbol.toStringTag : null, J = Object.prototype.propertyIsEnumerable, se = (typeof Reflect == "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function(F) {
      return F.__proto__;
    } : null);
    function j(F, P) {
      if (F === 1 / 0 || F === -1 / 0 || F !== F || F && F > -1e3 && F < 1e3 || E.call(/e/, P)) return P;
      var ue = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
      if (typeof F == "number") {
        var pe = F < 0 ? -q(-F) : q(F);
        if (pe !== F) {
          var ye = String(pe), te = f.call(P, ye.length + 1);
          return v.call(ye, ue, "$&_") + "." + v.call(v.call(te, /([0-9]{3})/g, "$&_"), /_$/, "");
        }
      }
      return v.call(P, ue, "$&_");
    }
    var le = Cn, K = le.custom, Y = G(K) ? K : null, ee = {
      __proto__: null,
      double: '"',
      single: "'"
    }, oe = {
      __proto__: null,
      double: /(["\\])/g,
      single: /(['\\])/g
    };
    Br = function F(P, ue, pe, ye) {
      var te = ue || {};
      if (ae(te, "quoteStyle") && !ae(ee, te.quoteStyle)) throw new TypeError('option "quoteStyle" must be "single" or "double"');
      if (ae(te, "maxStringLength") && (typeof te.maxStringLength == "number" ? te.maxStringLength < 0 && te.maxStringLength !== 1 / 0 : te.maxStringLength !== null)) throw new TypeError('option "maxStringLength", if provided, must be a positive integer, Infinity, or `null`');
      var xe = ae(te, "customInspect") ? te.customInspect : true;
      if (typeof xe != "boolean" && xe !== "symbol") throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
      if (ae(te, "indent") && te.indent !== null && te.indent !== "	" && !(parseInt(te.indent, 10) === te.indent && te.indent > 0)) throw new TypeError('option "indent" must be "\\t", an integer > 0, or `null`');
      if (ae(te, "numericSeparator") && typeof te.numericSeparator != "boolean") throw new TypeError('option "numericSeparator", if provided, must be `true` or `false`');
      var Ee = te.numericSeparator;
      if (typeof P > "u") return "undefined";
      if (P === null) return "null";
      if (typeof P == "boolean") return P ? "true" : "false";
      if (typeof P == "string") return Te(P, te);
      if (typeof P == "number") {
        if (P === 0) return 1 / 0 / P > 0 ? "0" : "-0";
        var Re = String(P);
        return Ee ? j(P, Re) : Re;
      }
      if (typeof P == "bigint") {
        var Fe = String(P) + "n";
        return Ee ? j(P, Fe) : Fe;
      }
      var Oe = typeof te.depth > "u" ? 5 : te.depth;
      if (typeof pe > "u" && (pe = 0), pe >= Oe && Oe > 0 && typeof P == "object") return B(P) ? "[Array]" : "[Object]";
      var Ue = Je(te, pe);
      if (typeof ye > "u") ye = [];
      else if (ke(ye, P) >= 0) return "[Circular]";
      function t($e, Ze, pn) {
        if (Ze && (ye = L.call(ye), ye.push(Ze)), pn) {
          var Yr = {
            depth: te.depth
          };
          return ae(te, "quoteStyle") && (Yr.quoteStyle = te.quoteStyle), F($e, Yr, pe + 1, ye);
        }
        return F($e, te, pe + 1, ye);
      }
      if (typeof P == "function" && !V(P)) {
        var e = Ne(P), r = Me(P, t);
        return "[Function" + (e ? ": " + e : " (anonymous)") + "]" + (r.length > 0 ? " { " + g.call(r, ", ") + " }" : "");
      }
      if (G(P)) {
        var u = Q ? v.call(String(P), /^(Symbol\(.*\))_[^)]*$/, "$1") : z.call(P);
        return typeof P == "object" && !Q ? Ae(u) : u;
      }
      if (Ce(P)) {
        for (var O = "<" + c.call(String(P.nodeName)), N = P.attributes || [], k = 0; k < N.length; k++) O += " " + N[k].name + "=" + fe(de(N[k].value), "double", te);
        return O += ">", P.childNodes && P.childNodes.length && (O += "..."), O += "</" + c.call(String(P.nodeName)) + ">", O;
      }
      if (B(P)) {
        if (P.length === 0) return "[]";
        var ne = Me(P, t);
        return Ue && !fr(ne) ? "[" + Be(ne, Ue) + "]" : "[ " + g.call(ne, ", ") + " ]";
      }
      if (X(P)) {
        var me = Me(P, t);
        return !("cause" in Error.prototype) && "cause" in P && !J.call(P, "cause") ? "{ [" + String(P) + "] " + g.call(h.call("[cause]: " + t(P.cause), me), ", ") + " }" : me.length === 0 ? "[" + String(P) + "]" : "{ [" + String(P) + "] " + g.call(me, ", ") + " }";
      }
      if (typeof P == "object" && xe) {
        if (Y && typeof P[Y] == "function" && le) return le(P, {
          depth: Oe - pe
        });
        if (xe !== "symbol" && typeof P.inspect == "function") return P.inspect();
      }
      if (ze(P)) {
        var ge = [];
        return T && T.call(P, function($e, Ze) {
          ge.push(t(Ze, P, true) + " => " + t($e, P));
        }), Ye("Map", i.call(P), ge, Ue);
      }
      if (Pe(P)) {
        var ve = [];
        return o && o.call(P, function($e) {
          ve.push(t($e, P));
        }), Ye("Set", A.call(P), ve, Ue);
      }
      if (be(P)) return We("WeakMap");
      if (De(P)) return We("WeakSet");
      if (_e(P)) return We("WeakRef");
      if (l(P)) return Ae(t(Number(P)));
      if (ie(P)) return Ae(t($.call(P)));
      if (W(P)) return Ae(w.call(P));
      if (a(P)) return Ae(t(String(P)));
      if (typeof window < "u" && P === window) return "{ [object Window] }";
      if (typeof globalThis < "u" && P === globalThis || typeof we < "u" && P === we) return "{ [object globalThis] }";
      if (!H(P) && !V(P)) {
        var ce = Me(P, t), Vr = se ? se(P) === Object.prototype : P instanceof Object || P.constructor === Object, ur = P instanceof Object ? "" : "null prototype", zr = !Vr && Z && Object(P) === P && Z in P ? f.call(Se(P), 8, -1) : ur ? "Object" : "", dn = Vr || typeof P.constructor != "function" ? "" : P.constructor.name ? P.constructor.name + " " : "", lr = dn + (zr || ur ? "[" + g.call(h.call([], zr || [], ur || []), ": ") + "] " : "");
        return ce.length === 0 ? lr + "{}" : Ue ? lr + "{" + Be(ce, Ue) + "}" : lr + "{ " + g.call(ce, ", ") + " }";
      }
      return String(P);
    };
    function fe(F, P, ue) {
      var pe = ue.quoteStyle || P, ye = ee[pe];
      return ye + F + ye;
    }
    function de(F) {
      return v.call(String(F), /"/g, "&quot;");
    }
    function I(F) {
      return !Z || !(typeof F == "object" && (Z in F || typeof F[Z] < "u"));
    }
    function B(F) {
      return Se(F) === "[object Array]" && I(F);
    }
    function H(F) {
      return Se(F) === "[object Date]" && I(F);
    }
    function V(F) {
      return Se(F) === "[object RegExp]" && I(F);
    }
    function X(F) {
      return Se(F) === "[object Error]" && I(F);
    }
    function a(F) {
      return Se(F) === "[object String]" && I(F);
    }
    function l(F) {
      return Se(F) === "[object Number]" && I(F);
    }
    function W(F) {
      return Se(F) === "[object Boolean]" && I(F);
    }
    function G(F) {
      if (Q) return F && typeof F == "object" && F instanceof Symbol;
      if (typeof F == "symbol") return true;
      if (!F || typeof F != "object" || !z) return false;
      try {
        return z.call(F), true;
      } catch {
      }
      return false;
    }
    function ie(F) {
      if (!F || typeof F != "object" || !$) return false;
      try {
        return $.call(F), true;
      } catch {
      }
      return false;
    }
    var re = Object.prototype.hasOwnProperty || function(F) {
      return F in this;
    };
    function ae(F, P) {
      return re.call(F, P);
    }
    function Se(F) {
      return C.call(F);
    }
    function Ne(F) {
      if (F.name) return F.name;
      var P = s.call(p.call(F), /^function\s*([\w$]+)/);
      return P ? P[1] : null;
    }
    function ke(F, P) {
      if (F.indexOf) return F.indexOf(P);
      for (var ue = 0, pe = F.length; ue < pe; ue++) if (F[ue] === P) return ue;
      return -1;
    }
    function ze(F) {
      if (!i || !F || typeof F != "object") return false;
      try {
        i.call(F);
        try {
          A.call(F);
        } catch {
          return true;
        }
        return F instanceof Map;
      } catch {
      }
      return false;
    }
    function be(F) {
      if (!_ || !F || typeof F != "object") return false;
      try {
        _.call(F, _);
        try {
          S.call(F, S);
        } catch {
          return true;
        }
        return F instanceof WeakMap;
      } catch {
      }
      return false;
    }
    function _e(F) {
      if (!D || !F || typeof F != "object") return false;
      try {
        return D.call(F), true;
      } catch {
      }
      return false;
    }
    function Pe(F) {
      if (!A || !F || typeof F != "object") return false;
      try {
        A.call(F);
        try {
          i.call(F);
        } catch {
          return true;
        }
        return F instanceof Set;
      } catch {
      }
      return false;
    }
    function De(F) {
      if (!S || !F || typeof F != "object") return false;
      try {
        S.call(F, S);
        try {
          _.call(F, _);
        } catch {
          return true;
        }
        return F instanceof WeakSet;
      } catch {
      }
      return false;
    }
    function Ce(F) {
      return !F || typeof F != "object" ? false : typeof HTMLElement < "u" && F instanceof HTMLElement ? true : typeof F.nodeName == "string" && typeof F.getAttribute == "function";
    }
    function Te(F, P) {
      if (F.length > P.maxStringLength) {
        var ue = F.length - P.maxStringLength, pe = "... " + ue + " more character" + (ue > 1 ? "s" : "");
        return Te(f.call(F, 0, P.maxStringLength), P) + pe;
      }
      var ye = oe[P.quoteStyle || "single"];
      ye.lastIndex = 0;
      var te = v.call(v.call(F, ye, "\\$1"), /[\x00-\x1f]/g, Ie);
      return fe(te, "single", P);
    }
    function Ie(F) {
      var P = F.charCodeAt(0), ue = {
        8: "b",
        9: "t",
        10: "n",
        12: "f",
        13: "r"
      }[P];
      return ue ? "\\" + ue : "\\x" + (P < 16 ? "0" : "") + y.call(P.toString(16));
    }
    function Ae(F) {
      return "Object(" + F + ")";
    }
    function We(F) {
      return F + " { ? }";
    }
    function Ye(F, P, ue, pe) {
      var ye = pe ? Be(ue, pe) : g.call(ue, ", ");
      return F + " (" + P + ") {" + ye + "}";
    }
    function fr(F) {
      for (var P = 0; P < F.length; P++) if (ke(F[P], `
`) >= 0) return false;
      return true;
    }
    function Je(F, P) {
      var ue;
      if (F.indent === "	") ue = "	";
      else if (typeof F.indent == "number" && F.indent > 0) ue = g.call(Array(F.indent + 1), " ");
      else return null;
      return {
        base: ue,
        prev: g.call(Array(P + 1), ue)
      };
    }
    function Be(F, P) {
      if (F.length === 0) return "";
      var ue = `
` + P.prev + P.base;
      return ue + g.call(F, "," + ue) + `
` + P.prev;
    }
    function Me(F, P) {
      var ue = B(F), pe = [];
      if (ue) {
        pe.length = F.length;
        for (var ye = 0; ye < F.length; ye++) pe[ye] = ae(F, ye) ? P(F[ye], F) : "";
      }
      var te = typeof x == "function" ? x(F) : [], xe;
      if (Q) {
        xe = {};
        for (var Ee = 0; Ee < te.length; Ee++) xe["$" + te[Ee]] = te[Ee];
      }
      for (var Re in F) ae(F, Re) && (ue && String(Number(Re)) === Re && Re < F.length || Q && xe["$" + Re] instanceof Symbol || (E.call(/[^\w$]/, Re) ? pe.push(P(Re, F) + ": " + P(F[Re], F)) : pe.push(Re + ": " + P(F[Re], F))));
      if (typeof x == "function") for (var Fe = 0; Fe < te.length; Fe++) J.call(F, te[Fe]) && pe.push("[" + P(te[Fe]) + "]: " + P(F[te[Fe]], F));
      return pe;
    }
    return Br;
  }
  var Mr, Rt;
  function Bn() {
    if (Rt) return Mr;
    Rt = 1;
    var n = or(), m = ir(), i = function(o, R, _) {
      for (var d = o, S; (S = d.next) != null; d = S) if (S.key === R) return d.next = S.next, _ || (S.next = o.next, o.next = S), S;
    }, T = function(o, R) {
      if (o) {
        var _ = i(o, R);
        return _ && _.value;
      }
    }, U = function(o, R, _) {
      var d = i(o, R);
      d ? d.value = _ : o.next = {
        key: R,
        next: o.next,
        value: _
      };
    }, b = function(o, R) {
      return o ? !!i(o, R) : false;
    }, A = function(o, R) {
      if (o) return i(o, R, true);
    };
    return Mr = function() {
      var R, _ = {
        assert: function(d) {
          if (!_.has(d)) throw new m("Side channel does not contain " + n(d));
        },
        delete: function(d) {
          var S = R && R.next, M = A(R, d);
          return M && S && S === M && (R = void 0), !!M;
        },
        get: function(d) {
          return T(R, d);
        },
        has: function(d) {
          return b(R, d);
        },
        set: function(d, S) {
          R || (R = {
            next: void 0
          }), U(R, d, S);
        }
      };
      return _;
    }, Mr;
  }
  var Fr, xt;
  function Jt() {
    if (xt) return Fr;
    xt = 1;
    var n = kt(), m = Wt(), i = or(), T = ir(), U = n("%Map%", true), b = m("Map.prototype.get", true), A = m("Map.prototype.set", true), o = m("Map.prototype.has", true), R = m("Map.prototype.delete", true), _ = m("Map.prototype.size", true);
    return Fr = !!U && function() {
      var S, M = {
        assert: function(D) {
          if (!M.has(D)) throw new T("Side channel does not contain " + i(D));
        },
        delete: function(D) {
          if (S) {
            var w = R(S, D);
            return _(S) === 0 && (S = void 0), w;
          }
          return false;
        },
        get: function(D) {
          if (S) return b(S, D);
        },
        has: function(D) {
          return S ? o(S, D) : false;
        },
        set: function(D, w) {
          S || (S = new U()), A(S, D, w);
        }
      };
      return M;
    }, Fr;
  }
  var Nr, Tt;
  function Mn() {
    if (Tt) return Nr;
    Tt = 1;
    var n = kt(), m = Wt(), i = or(), T = Jt(), U = ir(), b = n("%WeakMap%", true), A = m("WeakMap.prototype.get", true), o = m("WeakMap.prototype.set", true), R = m("WeakMap.prototype.has", true), _ = m("WeakMap.prototype.delete", true);
    return Nr = b ? function() {
      var S, M, D = {
        assert: function(w) {
          if (!D.has(w)) throw new U("Side channel does not contain " + i(w));
        },
        delete: function(w) {
          if (b && w && (typeof w == "object" || typeof w == "function")) {
            if (S) return _(S, w);
          } else if (T && M) return M.delete(w);
          return false;
        },
        get: function(w) {
          return b && w && (typeof w == "object" || typeof w == "function") && S ? A(S, w) : M && M.get(w);
        },
        has: function(w) {
          return b && w && (typeof w == "object" || typeof w == "function") && S ? R(S, w) : !!M && M.has(w);
        },
        set: function(w, C) {
          b && w && (typeof w == "object" || typeof w == "function") ? (S || (S = new b()), o(S, w, C)) : T && (M || (M = T()), M.set(w, C));
        }
      };
      return D;
    } : T, Nr;
  }
  var Pr, At;
  function Zt() {
    if (At) return Pr;
    At = 1;
    var n = ir(), m = or(), i = Bn(), T = Jt(), U = Mn(), b = U || T || i;
    return Pr = function() {
      var o, R = {
        assert: function(_) {
          if (!R.has(_)) throw new n("Side channel does not contain " + m(_));
        },
        delete: function(_) {
          return !!o && o.delete(_);
        },
        get: function(_) {
          return o && o.get(_);
        },
        has: function(_) {
          return !!o && o.has(_);
        },
        set: function(_, d) {
          o || (o = b()), o.set(_, d);
        }
      };
      return R;
    }, Pr;
  }
  var Dr, Ot;
  function Kr() {
    if (Ot) return Dr;
    Ot = 1;
    var n = String.prototype.replace, m = /%20/g, i = {
      RFC1738: "RFC1738",
      RFC3986: "RFC3986"
    };
    return Dr = {
      default: i.RFC3986,
      formatters: {
        RFC1738: function(T) {
          return n.call(T, m, "+");
        },
        RFC3986: function(T) {
          return String(T);
        }
      },
      RFC1738: i.RFC1738,
      RFC3986: i.RFC3986
    }, Dr;
  }
  var Ur, Lt;
  function en() {
    if (Lt) return Ur;
    Lt = 1;
    var n = Kr(), m = Zt(), i = Object.prototype.hasOwnProperty, T = Array.isArray, U = m(), b = function(h, g) {
      return U.set(h, g), h;
    }, A = function(h) {
      return U.has(h);
    }, o = function(h) {
      return U.get(h);
    }, R = function(h, g) {
      U.set(h, g);
    }, _ = (function() {
      for (var E = [], h = 0; h < 256; ++h) E[E.length] = "%" + ((h < 16 ? "0" : "") + h.toString(16)).toUpperCase();
      return E;
    })(), d = function(h) {
      for (; h.length > 1; ) {
        var g = h.pop(), L = g.obj[g.prop];
        if (T(L)) {
          for (var q = [], $ = 0; $ < L.length; ++$) typeof L[$] < "u" && (q[q.length] = L[$]);
          g.obj[g.prop] = q;
        }
      }
    }, S = function(h, g) {
      for (var L = g && g.plainObjects ? {
        __proto__: null
      } : {}, q = 0; q < h.length; ++q) typeof h[q] < "u" && (L[q] = h[q]);
      return L;
    }, M = function E(h, g, L) {
      if (!g) return h;
      if (typeof g != "object" && typeof g != "function") {
        if (T(h)) {
          var q = h.length;
          if (L && typeof L.arrayLimit == "number" && q > L.arrayLimit) return b(S(h.concat(g), L), q);
          h[q] = g;
        } else if (h && typeof h == "object") if (A(h)) {
          var $ = o(h) + 1;
          h[$] = g, R(h, $);
        } else {
          if (L && L.strictMerge) return [
            h,
            g
          ];
          (L && (L.plainObjects || L.allowPrototypes) || !i.call(Object.prototype, g)) && (h[g] = true);
        }
        else return [
          h,
          g
        ];
        return h;
      }
      if (!h || typeof h != "object") {
        if (A(g)) {
          for (var x = Object.keys(g), z = L && L.plainObjects ? {
            __proto__: null,
            0: h
          } : {
            0: h
          }, Q = 0; Q < x.length; Q++) {
            var Z = parseInt(x[Q], 10);
            z[Z + 1] = g[x[Q]];
          }
          return b(z, o(g) + 1);
        }
        var J = [
          h
        ].concat(g);
        return L && typeof L.arrayLimit == "number" && J.length > L.arrayLimit ? b(S(J, L), J.length - 1) : J;
      }
      var se = h;
      return T(h) && !T(g) && (se = S(h, L)), T(h) && T(g) ? (g.forEach(function(j, le) {
        if (i.call(h, le)) {
          var K = h[le];
          K && typeof K == "object" && j && typeof j == "object" ? h[le] = E(K, j, L) : h[h.length] = j;
        } else h[le] = j;
      }), h) : Object.keys(g).reduce(function(j, le) {
        var K = g[le];
        if (i.call(j, le) ? j[le] = E(j[le], K, L) : j[le] = K, A(g) && !A(j) && b(j, o(g)), A(j)) {
          var Y = parseInt(le, 10);
          String(Y) === le && Y >= 0 && Y > o(j) && R(j, Y);
        }
        return j;
      }, se);
    }, D = function(h, g) {
      return Object.keys(g).reduce(function(L, q) {
        return L[q] = g[q], L;
      }, h);
    }, w = function(E, h, g) {
      var L = E.replace(/\+/g, " ");
      if (g === "iso-8859-1") return L.replace(/%[0-9a-f]{2}/gi, unescape);
      try {
        return decodeURIComponent(L);
      } catch {
        return L;
      }
    }, C = 1024, p = function(h, g, L, q, $) {
      if (h.length === 0) return h;
      var x = h;
      if (typeof h == "symbol" ? x = Symbol.prototype.toString.call(h) : typeof h != "string" && (x = String(h)), L === "iso-8859-1") return escape(x).replace(/%u[0-9a-f]{4}/gi, function(le) {
        return "%26%23" + parseInt(le.slice(2), 16) + "%3B";
      });
      for (var z = "", Q = 0; Q < x.length; Q += C) {
        for (var Z = x.length >= C ? x.slice(Q, Q + C) : x, J = [], se = 0; se < Z.length; ++se) {
          var j = Z.charCodeAt(se);
          if (j === 45 || j === 46 || j === 95 || j === 126 || j >= 48 && j <= 57 || j >= 65 && j <= 90 || j >= 97 && j <= 122 || $ === n.RFC1738 && (j === 40 || j === 41)) {
            J[J.length] = Z.charAt(se);
            continue;
          }
          if (j < 128) {
            J[J.length] = _[j];
            continue;
          }
          if (j < 2048) {
            J[J.length] = _[192 | j >> 6] + _[128 | j & 63];
            continue;
          }
          if (j < 55296 || j >= 57344) {
            J[J.length] = _[224 | j >> 12] + _[128 | j >> 6 & 63] + _[128 | j & 63];
            continue;
          }
          se += 1, j = 65536 + ((j & 1023) << 10 | Z.charCodeAt(se) & 1023), J[J.length] = _[240 | j >> 18] + _[128 | j >> 12 & 63] + _[128 | j >> 6 & 63] + _[128 | j & 63];
        }
        z += J.join("");
      }
      return z;
    }, s = function(h) {
      for (var g = [
        {
          obj: {
            o: h
          },
          prop: "o"
        }
      ], L = [], q = 0; q < g.length; ++q) for (var $ = g[q], x = $.obj[$.prop], z = Object.keys(x), Q = 0; Q < z.length; ++Q) {
        var Z = z[Q], J = x[Z];
        typeof J == "object" && J !== null && L.indexOf(J) === -1 && (g[g.length] = {
          obj: x,
          prop: Z
        }, L[L.length] = J);
      }
      return d(g), h;
    }, f = function(h) {
      return Object.prototype.toString.call(h) === "[object RegExp]";
    }, v = function(h) {
      return !h || typeof h != "object" ? false : !!(h.constructor && h.constructor.isBuffer && h.constructor.isBuffer(h));
    }, y = function(h, g, L, q) {
      if (A(h)) {
        var $ = o(h) + 1;
        return h[$] = g, R(h, $), h;
      }
      var x = [].concat(h, g);
      return x.length > L ? b(S(x, {
        plainObjects: q
      }), x.length - 1) : x;
    }, c = function(h, g) {
      if (T(h)) {
        for (var L = [], q = 0; q < h.length; q += 1) L[L.length] = g(h[q]);
        return L;
      }
      return g(h);
    };
    return Ur = {
      arrayToObject: S,
      assign: D,
      combine: y,
      compact: s,
      decode: w,
      encode: p,
      isBuffer: v,
      isOverflow: A,
      isRegExp: f,
      markOverflow: b,
      maybeMap: c,
      merge: M
    }, Ur;
  }
  var qr, It;
  function Fn() {
    if (It) return qr;
    It = 1;
    var n = Zt(), m = en(), i = Kr(), T = Object.prototype.hasOwnProperty, U = {
      brackets: function(p) {
        return p + "[]";
      },
      comma: "comma",
      indices: function(p, s) {
        return p + "[" + s + "]";
      },
      repeat: function(p) {
        return p;
      }
    }, b = Array.isArray, A = Array.prototype.push, o = function(C, p) {
      A.apply(C, b(p) ? p : [
        p
      ]);
    }, R = Date.prototype.toISOString, _ = i.default, d = {
      addQueryPrefix: false,
      allowDots: false,
      allowEmptyArrays: false,
      arrayFormat: "indices",
      charset: "utf-8",
      charsetSentinel: false,
      commaRoundTrip: false,
      delimiter: "&",
      encode: true,
      encodeDotInKeys: false,
      encoder: m.encode,
      encodeValuesOnly: false,
      filter: void 0,
      format: _,
      formatter: i.formatters[_],
      indices: false,
      serializeDate: function(p) {
        return R.call(p);
      },
      skipNulls: false,
      strictNullHandling: false
    }, S = function(p) {
      return typeof p == "string" || typeof p == "number" || typeof p == "boolean" || typeof p == "symbol" || typeof p == "bigint";
    }, M = {}, D = function C(p, s, f, v, y, c, E, h, g, L, q, $, x, z, Q, Z, J, se) {
      for (var j = p, le = se, K = 0, Y = false; (le = le.get(M)) !== void 0 && !Y; ) {
        var ee = le.get(p);
        if (K += 1, typeof ee < "u") {
          if (ee === K) throw new RangeError("Cyclic object value");
          Y = true;
        }
        typeof le.get(M) > "u" && (K = 0);
      }
      if (typeof L == "function" ? j = L(s, j) : j instanceof Date ? j = x(j) : f === "comma" && b(j) && (j = m.maybeMap(j, function(ie) {
        return ie instanceof Date ? x(ie) : ie;
      })), j === null) {
        if (c) return g && !Z ? g(s, d.encoder, J, "key", z) : s;
        j = "";
      }
      if (S(j) || m.isBuffer(j)) {
        if (g) {
          var oe = Z ? s : g(s, d.encoder, J, "key", z);
          return [
            Q(oe) + "=" + Q(g(j, d.encoder, J, "value", z))
          ];
        }
        return [
          Q(s) + "=" + Q(String(j))
        ];
      }
      var fe = [];
      if (typeof j > "u") return fe;
      var de;
      if (f === "comma" && b(j)) Z && g && (j = m.maybeMap(j, g)), de = [
        {
          value: j.length > 0 ? j.join(",") || null : void 0
        }
      ];
      else if (b(L)) de = L;
      else {
        var I = Object.keys(j);
        de = q ? I.sort(q) : I;
      }
      var B = h ? String(s).replace(/\./g, "%2E") : String(s), H = v && b(j) && j.length === 1 ? B + "[]" : B;
      if (y && b(j) && j.length === 0) return H + "[]";
      for (var V = 0; V < de.length; ++V) {
        var X = de[V], a = typeof X == "object" && X && typeof X.value < "u" ? X.value : j[X];
        if (!(E && a === null)) {
          var l = $ && h ? String(X).replace(/\./g, "%2E") : String(X), W = b(j) ? typeof f == "function" ? f(H, l) : H : H + ($ ? "." + l : "[" + l + "]");
          se.set(p, K);
          var G = n();
          G.set(M, se), o(fe, C(a, W, f, v, y, c, E, h, f === "comma" && Z && b(j) ? null : g, L, q, $, x, z, Q, Z, J, G));
        }
      }
      return fe;
    }, w = function(p) {
      if (!p) return d;
      if (typeof p.allowEmptyArrays < "u" && typeof p.allowEmptyArrays != "boolean") throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
      if (typeof p.encodeDotInKeys < "u" && typeof p.encodeDotInKeys != "boolean") throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
      if (p.encoder !== null && typeof p.encoder < "u" && typeof p.encoder != "function") throw new TypeError("Encoder has to be a function.");
      var s = p.charset || d.charset;
      if (typeof p.charset < "u" && p.charset !== "utf-8" && p.charset !== "iso-8859-1") throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
      var f = i.default;
      if (typeof p.format < "u") {
        if (!T.call(i.formatters, p.format)) throw new TypeError("Unknown format option provided.");
        f = p.format;
      }
      var v = i.formatters[f], y = d.filter;
      (typeof p.filter == "function" || b(p.filter)) && (y = p.filter);
      var c;
      if (p.arrayFormat in U ? c = p.arrayFormat : "indices" in p ? c = p.indices ? "indices" : "repeat" : c = d.arrayFormat, "commaRoundTrip" in p && typeof p.commaRoundTrip != "boolean") throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
      var E = typeof p.allowDots > "u" ? p.encodeDotInKeys === true ? true : d.allowDots : !!p.allowDots;
      return {
        addQueryPrefix: typeof p.addQueryPrefix == "boolean" ? p.addQueryPrefix : d.addQueryPrefix,
        allowDots: E,
        allowEmptyArrays: typeof p.allowEmptyArrays == "boolean" ? !!p.allowEmptyArrays : d.allowEmptyArrays,
        arrayFormat: c,
        charset: s,
        charsetSentinel: typeof p.charsetSentinel == "boolean" ? p.charsetSentinel : d.charsetSentinel,
        commaRoundTrip: !!p.commaRoundTrip,
        delimiter: typeof p.delimiter > "u" ? d.delimiter : p.delimiter,
        encode: typeof p.encode == "boolean" ? p.encode : d.encode,
        encodeDotInKeys: typeof p.encodeDotInKeys == "boolean" ? p.encodeDotInKeys : d.encodeDotInKeys,
        encoder: typeof p.encoder == "function" ? p.encoder : d.encoder,
        encodeValuesOnly: typeof p.encodeValuesOnly == "boolean" ? p.encodeValuesOnly : d.encodeValuesOnly,
        filter: y,
        format: f,
        formatter: v,
        serializeDate: typeof p.serializeDate == "function" ? p.serializeDate : d.serializeDate,
        skipNulls: typeof p.skipNulls == "boolean" ? p.skipNulls : d.skipNulls,
        sort: typeof p.sort == "function" ? p.sort : null,
        strictNullHandling: typeof p.strictNullHandling == "boolean" ? p.strictNullHandling : d.strictNullHandling
      };
    };
    return qr = function(C, p) {
      var s = C, f = w(p), v, y;
      typeof f.filter == "function" ? (y = f.filter, s = y("", s)) : b(f.filter) && (y = f.filter, v = y);
      var c = [];
      if (typeof s != "object" || s === null) return "";
      var E = U[f.arrayFormat], h = E === "comma" && f.commaRoundTrip;
      v || (v = Object.keys(s)), f.sort && v.sort(f.sort);
      for (var g = n(), L = 0; L < v.length; ++L) {
        var q = v[L], $ = s[q];
        f.skipNulls && $ === null || o(c, D($, q, E, h, f.allowEmptyArrays, f.strictNullHandling, f.skipNulls, f.encodeDotInKeys, f.encode ? f.encoder : null, f.filter, f.sort, f.allowDots, f.serializeDate, f.format, f.formatter, f.encodeValuesOnly, f.charset, g));
      }
      var x = c.join(f.delimiter), z = f.addQueryPrefix === true ? "?" : "";
      return f.charsetSentinel && (f.charset === "iso-8859-1" ? z += "utf8=%26%2310003%3B&" : z += "utf8=%E2%9C%93&"), x.length > 0 ? z + x : "";
    }, qr;
  }
  var kr, Ct;
  function Nn() {
    if (Ct) return kr;
    Ct = 1;
    var n = en(), m = Object.prototype.hasOwnProperty, i = Array.isArray, T = {
      allowDots: false,
      allowEmptyArrays: false,
      allowPrototypes: false,
      allowSparse: false,
      arrayLimit: 20,
      charset: "utf-8",
      charsetSentinel: false,
      comma: false,
      decodeDotInKeys: false,
      decoder: n.decode,
      delimiter: "&",
      depth: 5,
      duplicates: "combine",
      ignoreQueryPrefix: false,
      interpretNumericEntities: false,
      parameterLimit: 1e3,
      parseArrays: true,
      plainObjects: false,
      strictDepth: false,
      strictMerge: true,
      strictNullHandling: false,
      throwOnLimitExceeded: false
    }, U = function(D) {
      return D.replace(/&#(\d+);/g, function(w, C) {
        return String.fromCharCode(parseInt(C, 10));
      });
    }, b = function(D, w, C) {
      if (D && typeof D == "string" && w.comma && D.indexOf(",") > -1) return D.split(",");
      if (w.throwOnLimitExceeded && C >= w.arrayLimit) throw new RangeError("Array limit exceeded. Only " + w.arrayLimit + " element" + (w.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
      return D;
    }, A = "utf8=%26%2310003%3B", o = "utf8=%E2%9C%93", R = function(w, C) {
      var p = {
        __proto__: null
      }, s = C.ignoreQueryPrefix ? w.replace(/^\?/, "") : w;
      s = s.replace(/%5B/gi, "[").replace(/%5D/gi, "]");
      var f = C.parameterLimit === 1 / 0 ? void 0 : C.parameterLimit, v = s.split(C.delimiter, C.throwOnLimitExceeded ? f + 1 : f);
      if (C.throwOnLimitExceeded && v.length > f) throw new RangeError("Parameter limit exceeded. Only " + f + " parameter" + (f === 1 ? "" : "s") + " allowed.");
      var y = -1, c, E = C.charset;
      if (C.charsetSentinel) for (c = 0; c < v.length; ++c) v[c].indexOf("utf8=") === 0 && (v[c] === o ? E = "utf-8" : v[c] === A && (E = "iso-8859-1"), y = c, c = v.length);
      for (c = 0; c < v.length; ++c) if (c !== y) {
        var h = v[c], g = h.indexOf("]="), L = g === -1 ? h.indexOf("=") : g + 1, q, $;
        if (L === -1 ? (q = C.decoder(h, T.decoder, E, "key"), $ = C.strictNullHandling ? null : "") : (q = C.decoder(h.slice(0, L), T.decoder, E, "key"), q !== null && ($ = n.maybeMap(b(h.slice(L + 1), C, i(p[q]) ? p[q].length : 0), function(z) {
          return C.decoder(z, T.decoder, E, "value");
        }))), $ && C.interpretNumericEntities && E === "iso-8859-1" && ($ = U(String($))), h.indexOf("[]=") > -1 && ($ = i($) ? [
          $
        ] : $), C.comma && i($) && $.length > C.arrayLimit) {
          if (C.throwOnLimitExceeded) throw new RangeError("Array limit exceeded. Only " + C.arrayLimit + " element" + (C.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
          $ = n.combine([], $, C.arrayLimit, C.plainObjects);
        }
        if (q !== null) {
          var x = m.call(p, q);
          x && (C.duplicates === "combine" || h.indexOf("[]=") > -1) ? p[q] = n.combine(p[q], $, C.arrayLimit, C.plainObjects) : (!x || C.duplicates === "last") && (p[q] = $);
        }
      }
      return p;
    }, _ = function(D, w, C, p) {
      var s = 0;
      if (D.length > 0 && D[D.length - 1] === "[]") {
        var f = D.slice(0, -1).join("");
        s = Array.isArray(w) && w[f] ? w[f].length : 0;
      }
      for (var v = p ? w : b(w, C, s), y = D.length - 1; y >= 0; --y) {
        var c, E = D[y];
        if (E === "[]" && C.parseArrays) n.isOverflow(v) ? c = v : c = C.allowEmptyArrays && (v === "" || C.strictNullHandling && v === null) ? [] : n.combine([], v, C.arrayLimit, C.plainObjects);
        else {
          c = C.plainObjects ? {
            __proto__: null
          } : {};
          var h = E.charAt(0) === "[" && E.charAt(E.length - 1) === "]" ? E.slice(1, -1) : E, g = C.decodeDotInKeys ? h.replace(/%2E/g, ".") : h, L = parseInt(g, 10), q = !isNaN(L) && E !== g && String(L) === g && L >= 0 && C.parseArrays;
          if (!C.parseArrays && g === "") c = {
            0: v
          };
          else if (q && L < C.arrayLimit) c = [], c[L] = v;
          else {
            if (q && C.throwOnLimitExceeded) throw new RangeError("Array limit exceeded. Only " + C.arrayLimit + " element" + (C.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
            q ? (c[L] = v, n.markOverflow(c, L)) : g !== "__proto__" && (c[g] = v);
          }
        }
        v = c;
      }
      return v;
    }, d = function(w, C) {
      var p = C.allowDots ? w.replace(/\.([^.[]+)/g, "[$1]") : w;
      if (C.depth <= 0) return !C.plainObjects && m.call(Object.prototype, p) && !C.allowPrototypes ? void 0 : [
        p
      ];
      var s = /(\[[^[\]]*])/, f = /(\[[^[\]]*])/g, v = s.exec(p), y = v ? p.slice(0, v.index) : p, c = [];
      if (y) {
        if (!C.plainObjects && m.call(Object.prototype, y) && !C.allowPrototypes) return;
        c[c.length] = y;
      }
      for (var E = 0; (v = f.exec(p)) !== null && E < C.depth; ) {
        E += 1;
        var h = v[1].slice(1, -1);
        if (!C.plainObjects && m.call(Object.prototype, h) && !C.allowPrototypes) return;
        c[c.length] = v[1];
      }
      if (v) {
        if (C.strictDepth === true) throw new RangeError("Input depth exceeded depth option of " + C.depth + " and strictDepth is true");
        c[c.length] = "[" + p.slice(v.index) + "]";
      }
      return c;
    }, S = function(w, C, p, s) {
      if (w) {
        var f = d(w, p);
        if (f) return _(f, C, p, s);
      }
    }, M = function(w) {
      if (!w) return T;
      if (typeof w.allowEmptyArrays < "u" && typeof w.allowEmptyArrays != "boolean") throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
      if (typeof w.decodeDotInKeys < "u" && typeof w.decodeDotInKeys != "boolean") throw new TypeError("`decodeDotInKeys` option can only be `true` or `false`, when provided");
      if (w.decoder !== null && typeof w.decoder < "u" && typeof w.decoder != "function") throw new TypeError("Decoder has to be a function.");
      if (typeof w.charset < "u" && w.charset !== "utf-8" && w.charset !== "iso-8859-1") throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
      if (typeof w.throwOnLimitExceeded < "u" && typeof w.throwOnLimitExceeded != "boolean") throw new TypeError("`throwOnLimitExceeded` option must be a boolean");
      var C = typeof w.charset > "u" ? T.charset : w.charset, p = typeof w.duplicates > "u" ? T.duplicates : w.duplicates;
      if (p !== "combine" && p !== "first" && p !== "last") throw new TypeError("The duplicates option must be either combine, first, or last");
      var s = typeof w.allowDots > "u" ? w.decodeDotInKeys === true ? true : T.allowDots : !!w.allowDots;
      return {
        allowDots: s,
        allowEmptyArrays: typeof w.allowEmptyArrays == "boolean" ? !!w.allowEmptyArrays : T.allowEmptyArrays,
        allowPrototypes: typeof w.allowPrototypes == "boolean" ? w.allowPrototypes : T.allowPrototypes,
        allowSparse: typeof w.allowSparse == "boolean" ? w.allowSparse : T.allowSparse,
        arrayLimit: typeof w.arrayLimit == "number" ? w.arrayLimit : T.arrayLimit,
        charset: C,
        charsetSentinel: typeof w.charsetSentinel == "boolean" ? w.charsetSentinel : T.charsetSentinel,
        comma: typeof w.comma == "boolean" ? w.comma : T.comma,
        decodeDotInKeys: typeof w.decodeDotInKeys == "boolean" ? w.decodeDotInKeys : T.decodeDotInKeys,
        decoder: typeof w.decoder == "function" ? w.decoder : T.decoder,
        delimiter: typeof w.delimiter == "string" || n.isRegExp(w.delimiter) ? w.delimiter : T.delimiter,
        depth: typeof w.depth == "number" || w.depth === false ? +w.depth : T.depth,
        duplicates: p,
        ignoreQueryPrefix: w.ignoreQueryPrefix === true,
        interpretNumericEntities: typeof w.interpretNumericEntities == "boolean" ? w.interpretNumericEntities : T.interpretNumericEntities,
        parameterLimit: typeof w.parameterLimit == "number" ? w.parameterLimit : T.parameterLimit,
        parseArrays: w.parseArrays !== false,
        plainObjects: typeof w.plainObjects == "boolean" ? w.plainObjects : T.plainObjects,
        strictDepth: typeof w.strictDepth == "boolean" ? !!w.strictDepth : T.strictDepth,
        strictMerge: typeof w.strictMerge == "boolean" ? !!w.strictMerge : T.strictMerge,
        strictNullHandling: typeof w.strictNullHandling == "boolean" ? w.strictNullHandling : T.strictNullHandling,
        throwOnLimitExceeded: typeof w.throwOnLimitExceeded == "boolean" ? w.throwOnLimitExceeded : false
      };
    };
    return kr = function(D, w) {
      var C = M(w);
      if (D === "" || D === null || typeof D > "u") return C.plainObjects ? {
        __proto__: null
      } : {};
      for (var p = typeof D == "string" ? R(D, C) : D, s = C.plainObjects ? {
        __proto__: null
      } : {}, f = Object.keys(p), v = 0; v < f.length; ++v) {
        var y = f[v], c = S(y, p[y], C, typeof D == "string");
        s = n.merge(s, c, C);
      }
      return C.allowSparse === true ? s : n.compact(s);
    }, kr;
  }
  var Wr, Bt;
  function Pn() {
    if (Bt) return Wr;
    Bt = 1;
    var n = Fn(), m = Nn(), i = Kr();
    return Wr = {
      formats: i,
      parse: m,
      stringify: n
    }, Wr;
  }
  var Dn = Pn();
  const Un = Dt(Dn);
  var qn = In;
  function Le() {
    this.protocol = null, this.slashes = null, this.auth = null, this.host = null, this.port = null, this.hostname = null, this.hash = null, this.search = null, this.query = null, this.pathname = null, this.path = null, this.href = null;
  }
  var kn = /^([a-z0-9.+-]+:)/i, Wn = /:[0-9]*$/, Hn = /^(\/\/?(?!\/)[^?\s]*)(\?[^\s]*)?$/, jn = [
    "<",
    ">",
    '"',
    "`",
    " ",
    "\r",
    `
`,
    "	"
  ], $n = [
    "{",
    "}",
    "|",
    "\\",
    "^",
    "`"
  ].concat(jn), Hr = [
    "'"
  ].concat($n), Mt = [
    "%",
    "/",
    "?",
    ";",
    "#"
  ].concat(Hr), Ft = [
    "/",
    "?",
    "#"
  ], Gn = 255, Nt = /^[+a-z0-9A-Z_-]{0,63}$/, Kn = /^([+a-z0-9A-Z_-]{0,63})(.*)$/, Vn = {
    javascript: true,
    "javascript:": true
  }, jr = {
    javascript: true,
    "javascript:": true
  }, Ge = {
    http: true,
    https: true,
    ftp: true,
    gopher: true,
    file: true,
    "http:": true,
    "https:": true,
    "ftp:": true,
    "gopher:": true,
    "file:": true
  }, $r = Un;
  function Qe(n, m, i) {
    if (n && typeof n == "object" && n instanceof Le) return n;
    var T = new Le();
    return T.parse(n, m, i), T;
  }
  Le.prototype.parse = function(n, m, i) {
    if (typeof n != "string") throw new TypeError("Parameter 'url' must be a string, not " + typeof n);
    var T = n.indexOf("?"), U = T !== -1 && T < n.indexOf("#") ? "?" : "#", b = n.split(U), A = /\\/g;
    b[0] = b[0].replace(A, "/"), n = b.join(U);
    var o = n;
    if (o = o.trim(), !i && n.split("#").length === 1) {
      var R = Hn.exec(o);
      if (R) return this.path = o, this.href = o, this.pathname = R[1], R[2] ? (this.search = R[2], m ? this.query = $r.parse(this.search.substr(1)) : this.query = this.search.substr(1)) : m && (this.search = "", this.query = {}), this;
    }
    var _ = kn.exec(o);
    if (_) {
      _ = _[0];
      var d = _.toLowerCase();
      this.protocol = d, o = o.substr(_.length);
    }
    if (i || _ || o.match(/^\/\/[^@/]+@[^@/]+/)) {
      var S = o.substr(0, 2) === "//";
      S && !(_ && jr[_]) && (o = o.substr(2), this.slashes = true);
    }
    if (!jr[_] && (S || _ && !Ge[_])) {
      for (var M = -1, D = 0; D < Ft.length; D++) {
        var w = o.indexOf(Ft[D]);
        w !== -1 && (M === -1 || w < M) && (M = w);
      }
      var C, p;
      M === -1 ? p = o.lastIndexOf("@") : p = o.lastIndexOf("@", M), p !== -1 && (C = o.slice(0, p), o = o.slice(p + 1), this.auth = decodeURIComponent(C)), M = -1;
      for (var D = 0; D < Mt.length; D++) {
        var w = o.indexOf(Mt[D]);
        w !== -1 && (M === -1 || w < M) && (M = w);
      }
      M === -1 && (M = o.length), this.host = o.slice(0, M), o = o.slice(M), this.parseHost(), this.hostname = this.hostname || "";
      var s = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
      if (!s) for (var f = this.hostname.split(/\./), D = 0, v = f.length; D < v; D++) {
        var y = f[D];
        if (y && !y.match(Nt)) {
          for (var c = "", E = 0, h = y.length; E < h; E++) y.charCodeAt(E) > 127 ? c += "x" : c += y[E];
          if (!c.match(Nt)) {
            var g = f.slice(0, D), L = f.slice(D + 1), q = y.match(Kn);
            q && (g.push(q[1]), L.unshift(q[2])), L.length && (o = "/" + L.join(".") + o), this.hostname = g.join(".");
            break;
          }
        }
      }
      this.hostname.length > Gn ? this.hostname = "" : this.hostname = this.hostname.toLowerCase(), s || (this.hostname = qn.toASCII(this.hostname));
      var $ = this.port ? ":" + this.port : "", x = this.hostname || "";
      this.host = x + $, this.href += this.host, s && (this.hostname = this.hostname.substr(1, this.hostname.length - 2), o[0] !== "/" && (o = "/" + o));
    }
    if (!Vn[d]) for (var D = 0, v = Hr.length; D < v; D++) {
      var z = Hr[D];
      if (o.indexOf(z) !== -1) {
        var Q = encodeURIComponent(z);
        Q === z && (Q = escape(z)), o = o.split(z).join(Q);
      }
    }
    var Z = o.indexOf("#");
    Z !== -1 && (this.hash = o.substr(Z), o = o.slice(0, Z));
    var J = o.indexOf("?");
    if (J !== -1 ? (this.search = o.substr(J), this.query = o.substr(J + 1), m && (this.query = $r.parse(this.query)), o = o.slice(0, J)) : m && (this.search = "", this.query = {}), o && (this.pathname = o), Ge[d] && this.hostname && !this.pathname && (this.pathname = "/"), this.pathname || this.search) {
      var $ = this.pathname || "", se = this.search || "";
      this.path = $ + se;
    }
    return this.href = this.format(), this;
  };
  function zn(n) {
    return typeof n == "string" && (n = Qe(n)), n instanceof Le ? n.format() : Le.prototype.format.call(n);
  }
  Le.prototype.format = function() {
    var n = this.auth || "";
    n && (n = encodeURIComponent(n), n = n.replace(/%3A/i, ":"), n += "@");
    var m = this.protocol || "", i = this.pathname || "", T = this.hash || "", U = false, b = "";
    this.host ? U = n + this.host : this.hostname && (U = n + (this.hostname.indexOf(":") === -1 ? this.hostname : "[" + this.hostname + "]"), this.port && (U += ":" + this.port)), this.query && typeof this.query == "object" && Object.keys(this.query).length && (b = $r.stringify(this.query, {
      arrayFormat: "repeat",
      addQueryPrefix: false
    }));
    var A = this.search || b && "?" + b || "";
    return m && m.substr(-1) !== ":" && (m += ":"), this.slashes || (!m || Ge[m]) && U !== false ? (U = "//" + (U || ""), i && i.charAt(0) !== "/" && (i = "/" + i)) : U || (U = ""), T && T.charAt(0) !== "#" && (T = "#" + T), A && A.charAt(0) !== "?" && (A = "?" + A), i = i.replace(/[?#]/g, function(o) {
      return encodeURIComponent(o);
    }), A = A.replace("#", "%23"), m + U + i + A + T;
  };
  function Yn(n, m) {
    return Qe(n, false, true).resolve(m);
  }
  Le.prototype.resolve = function(n) {
    return this.resolveObject(Qe(n, false, true)).format();
  };
  function Xn(n, m) {
    return n ? Qe(n, false, true).resolveObject(m) : m;
  }
  Le.prototype.resolveObject = function(n) {
    if (typeof n == "string") {
      var m = new Le();
      m.parse(n, false, true), n = m;
    }
    for (var i = new Le(), T = Object.keys(this), U = 0; U < T.length; U++) {
      var b = T[U];
      i[b] = this[b];
    }
    if (i.hash = n.hash, n.href === "") return i.href = i.format(), i;
    if (n.slashes && !n.protocol) {
      for (var A = Object.keys(n), o = 0; o < A.length; o++) {
        var R = A[o];
        R !== "protocol" && (i[R] = n[R]);
      }
      return Ge[i.protocol] && i.hostname && !i.pathname && (i.pathname = "/", i.path = i.pathname), i.href = i.format(), i;
    }
    if (n.protocol && n.protocol !== i.protocol) {
      if (!Ge[n.protocol]) {
        for (var _ = Object.keys(n), d = 0; d < _.length; d++) {
          var S = _[d];
          i[S] = n[S];
        }
        return i.href = i.format(), i;
      }
      if (i.protocol = n.protocol, !n.host && !jr[n.protocol]) {
        for (var v = (n.pathname || "").split("/"); v.length && !(n.host = v.shift()); ) ;
        n.host || (n.host = ""), n.hostname || (n.hostname = ""), v[0] !== "" && v.unshift(""), v.length < 2 && v.unshift(""), i.pathname = v.join("/");
      } else i.pathname = n.pathname;
      if (i.search = n.search, i.query = n.query, i.host = n.host || "", i.auth = n.auth, i.hostname = n.hostname || n.host, i.port = n.port, i.pathname || i.search) {
        var M = i.pathname || "", D = i.search || "";
        i.path = M + D;
      }
      return i.slashes = i.slashes || n.slashes, i.href = i.format(), i;
    }
    var w = i.pathname && i.pathname.charAt(0) === "/", C = n.host || n.pathname && n.pathname.charAt(0) === "/", p = C || w || i.host && n.pathname, s = p, f = i.pathname && i.pathname.split("/") || [], v = n.pathname && n.pathname.split("/") || [], y = i.protocol && !Ge[i.protocol];
    if (y && (i.hostname = "", i.port = null, i.host && (f[0] === "" ? f[0] = i.host : f.unshift(i.host)), i.host = "", n.protocol && (n.hostname = null, n.port = null, n.host && (v[0] === "" ? v[0] = n.host : v.unshift(n.host)), n.host = null), p = p && (v[0] === "" || f[0] === "")), C) i.host = n.host || n.host === "" ? n.host : i.host, i.hostname = n.hostname || n.hostname === "" ? n.hostname : i.hostname, i.search = n.search, i.query = n.query, f = v;
    else if (v.length) f || (f = []), f.pop(), f = f.concat(v), i.search = n.search, i.query = n.query;
    else if (n.search != null) {
      if (y) {
        i.host = f.shift(), i.hostname = i.host;
        var c = i.host && i.host.indexOf("@") > 0 ? i.host.split("@") : false;
        c && (i.auth = c.shift(), i.hostname = c.shift(), i.host = i.hostname);
      }
      return i.search = n.search, i.query = n.query, (i.pathname !== null || i.search !== null) && (i.path = (i.pathname ? i.pathname : "") + (i.search ? i.search : "")), i.href = i.format(), i;
    }
    if (!f.length) return i.pathname = null, i.search ? i.path = "/" + i.search : i.path = null, i.href = i.format(), i;
    for (var E = f.slice(-1)[0], h = (i.host || n.host || f.length > 1) && (E === "." || E === "..") || E === "", g = 0, L = f.length; L >= 0; L--) E = f[L], E === "." ? f.splice(L, 1) : E === ".." ? (f.splice(L, 1), g++) : g && (f.splice(L, 1), g--);
    if (!p && !s) for (; g--; g) f.unshift("..");
    p && f[0] !== "" && (!f[0] || f[0].charAt(0) !== "/") && f.unshift(""), h && f.join("/").substr(-1) !== "/" && f.push("");
    var q = f[0] === "" || f[0] && f[0].charAt(0) === "/";
    if (y) {
      i.hostname = q ? "" : f.length ? f.shift() : "", i.host = i.hostname;
      var c = i.host && i.host.indexOf("@") > 0 ? i.host.split("@") : false;
      c && (i.auth = c.shift(), i.hostname = c.shift(), i.host = i.hostname);
    }
    return p = p || i.host && f.length, p && !q && f.unshift(""), f.length > 0 ? i.pathname = f.join("/") : (i.pathname = null, i.path = null), (i.pathname !== null || i.search !== null) && (i.path = (i.pathname ? i.pathname : "") + (i.search ? i.search : "")), i.auth = n.auth || i.auth, i.slashes = i.slashes || n.slashes, i.href = i.format(), i;
  };
  Le.prototype.parseHost = function() {
    var n = this.host, m = Wn.exec(n);
    m && (m = m[0], m !== ":" && (this.port = m.substr(1)), n = n.substr(0, n.length - m.length)), n && (this.hostname = n);
  };
  var Qn = Qe, Jn = Yn, rn = Xn, Zn = zn, ei = Le;
  function ri(n, m) {
    for (var i = 0, T = n.length - 1; T >= 0; T--) {
      var U = n[T];
      U === "." ? n.splice(T, 1) : U === ".." ? (n.splice(T, 1), i++) : i && (n.splice(T, 1), i--);
    }
    if (m) for (; i--; i) n.unshift("..");
    return n;
  }
  function ti() {
    for (var n = "", m = false, i = arguments.length - 1; i >= -1 && !m; i--) {
      var T = i >= 0 ? arguments[i] : "/";
      if (typeof T != "string") throw new TypeError("Arguments to path.resolve must be strings");
      if (!T) continue;
      n = T + "/" + n, m = T.charAt(0) === "/";
    }
    return n = ri(ni(n.split("/"), function(U) {
      return !!U;
    }), !m).join("/"), (m ? "/" : "") + n || ".";
  }
  function ni(n, m) {
    if (n.filter) return n.filter(m);
    for (var i = [], T = 0; T < n.length; T++) m(n[T], T, n) && i.push(n[T]);
    return i;
  }
  var tn = (function(n) {
    function m() {
      var T = this || self;
      return delete n.prototype.__magic__, T;
    }
    if (typeof globalThis == "object") return globalThis;
    if (this) return m();
    n.defineProperty(n.prototype, "__magic__", {
      configurable: true,
      get: m
    });
    var i = __magic__;
    return i;
  })(Object), ii = Zn, nn = Qn, an = Jn, on = ei, qe = tn.URL, fn = tn.URLSearchParams, ai = /%/g, oi = /\\/g, fi = /\n/g, ui = /\r/g, li = /\t/g, si = 47;
  function ci(n) {
    var m = n ?? null;
    return !!(m !== null && (m == null ? void 0 : m.href) && (m == null ? void 0 : m.origin));
  }
  function hi(n) {
    if (n.hostname !== "") throw new TypeError('File URL host must be "localhost" or empty on browser');
    for (var m = n.pathname, i = 0; i < m.length; i++) if (m[i] === "%") {
      var T = m.codePointAt(i + 2) | 32;
      if (m[i + 1] === "2" && T === 102) throw new TypeError("File URL path must not include encoded / characters");
    }
    return decodeURIComponent(m);
  }
  function di(n) {
    return n.includes("%") && (n = n.replace(ai, "%25")), n.includes("\\") && (n = n.replace(oi, "%5C")), n.includes(`
`) && (n = n.replace(fi, "%0A")), n.includes("\r") && (n = n.replace(ui, "%0D")), n.includes("	") && (n = n.replace(li, "%09")), n;
  }
  var un = function(m) {
    if (typeof m > "u") throw new TypeError('The "domain" argument must be specified');
    return new qe("http://" + m).hostname;
  }, ln = function(m) {
    if (typeof m > "u") throw new TypeError('The "domain" argument must be specified');
    return new qe("http://" + m).hostname;
  }, sn = function(m) {
    var i = new qe("file://"), T = ti(m), U = m.charCodeAt(m.length - 1);
    return U === si && T[T.length - 1] !== "/" && (T += "/"), i.pathname = di(T), i;
  }, cn = function(m) {
    if (!ci(m) && typeof m != "string") throw new TypeError('The "path" argument must be of type string or an instance of URL. Received type ' + typeof m + " (" + m + ")");
    var i = new qe(m);
    if (i.protocol !== "file:") throw new TypeError("The URL must be of scheme file");
    return hi(i);
  }, hn = function(m, i) {
    var T, U, b, A;
    if (i === void 0 && (i = {}), !(m instanceof qe)) return ii(m);
    if (typeof i != "object" || i === null) throw new TypeError('The "options" argument must be of type object.');
    var o = (T = i.auth) != null ? T : true, R = (U = i.fragment) != null ? U : true, _ = (b = i.search) != null ? b : true;
    (A = i.unicode) != null;
    var d = new qe(m.toString());
    return o || (d.username = "", d.password = ""), R || (d.hash = ""), _ || (d.search = ""), d.toString();
  }, pi = {
    format: hn,
    parse: nn,
    resolve: an,
    resolveObject: rn,
    Url: on,
    URL: qe,
    URLSearchParams: fn,
    domainToASCII: un,
    domainToUnicode: ln,
    pathToFileURL: sn,
    fileURLToPath: cn
  };
  const yi = Object.freeze(Object.defineProperty({
    __proto__: null,
    URL: qe,
    URLSearchParams: fn,
    Url: on,
    default: pi,
    domainToASCII: un,
    domainToUnicode: ln,
    fileURLToPath: cn,
    format: hn,
    parse: nn,
    pathToFileURL: sn,
    resolve: an,
    resolveObject: rn
  }, Symbol.toStringTag, {
    value: "Module"
  })), gi = Ut(yi);
  var Pt;
  function mi() {
    return Pt || (Pt = 1, (function(n) {
      var m = Rn(), i = Qt(), T = xn(), U = Tn(), b = gi, A = n;
      A.request = function(o, R) {
        typeof o == "string" ? o = b.parse(o) : o = T(o);
        var _ = we.location.protocol.search(/^https?:$/) === -1 ? "http:" : "", d = o.protocol || _, S = o.hostname || o.host, M = o.port, D = o.path || "/";
        S && S.indexOf(":") !== -1 && (S = "[" + S + "]"), o.url = (S ? d + "//" + S : "") + (M ? ":" + M : "") + D, o.method = (o.method || "GET").toUpperCase(), o.headers = o.headers || {};
        var w = new m(o);
        return R && w.on("response", R), w;
      }, A.get = function(R, _) {
        var d = A.request(R, _);
        return d.end(), d;
      }, A.ClientRequest = m, A.IncomingMessage = i.IncomingMessage, A.Agent = function() {
      }, A.Agent.defaultMaxSockets = 4, A.globalAgent = new A.Agent(), A.STATUS_CODES = U, A.METHODS = [
        "CHECKOUT",
        "CONNECT",
        "COPY",
        "DELETE",
        "GET",
        "HEAD",
        "LOCK",
        "M-SEARCH",
        "MERGE",
        "MKACTIVITY",
        "MKCOL",
        "MOVE",
        "NOTIFY",
        "OPTIONS",
        "PATCH",
        "POST",
        "PROPFIND",
        "PROPPATCH",
        "PURGE",
        "PUT",
        "REPORT",
        "SEARCH",
        "SUBSCRIBE",
        "TRACE",
        "UNLOCK",
        "UNSUBSCRIBE"
      ];
    })(sr)), sr;
  }
  var vi = mi();
  Ri = gn({
    __proto__: null
  }, [
    vi
  ]);
});
export {
  __tla,
  Ri as i
};
