var Yr = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Wr(f) {
  return f && f.__esModule && Object.prototype.hasOwnProperty.call(f, "default") ? f.default : f;
}
function qr(f) {
  if (Object.prototype.hasOwnProperty.call(f, "__esModule")) return f;
  var c = f.default;
  if (typeof c == "function") {
    var s = function w() {
      var y = false;
      try {
        y = this instanceof w;
      } catch {
      }
      return y ? Reflect.construct(c, arguments, this.constructor) : c.apply(this, arguments);
    };
    s.prototype = c.prototype;
  } else s = {};
  return Object.defineProperty(s, "__esModule", { value: true }), Object.keys(f).forEach(function(w) {
    var y = Object.getOwnPropertyDescriptor(f, w);
    Object.defineProperty(s, w, y.get ? y : { enumerable: true, get: function() {
      return f[w];
    } });
  }), s;
}
var z = {}, $ = {};
$.byteLength = Nr;
$.toByteArray = Pr;
$.fromByteArray = $r;
var _ = [], R = [], Lr = typeof Uint8Array < "u" ? Uint8Array : Array, X = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (var P = 0, Mr = X.length; P < Mr; ++P) _[P] = X[P], R[X.charCodeAt(P)] = P;
R[45] = 62;
R[95] = 63;
function cr(f) {
  var c = f.length;
  if (c % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
  var s = f.indexOf("=");
  s === -1 && (s = c);
  var w = s === c ? 0 : 4 - s % 4;
  return [s, w];
}
function Nr(f) {
  var c = cr(f), s = c[0], w = c[1];
  return (s + w) * 3 / 4 - w;
}
function Dr(f, c, s) {
  return (c + s) * 3 / 4 - s;
}
function Pr(f) {
  var c, s = cr(f), w = s[0], y = s[1], p = new Lr(Dr(f, w, y)), l = 0, m = y > 0 ? w - 4 : w, B;
  for (B = 0; B < m; B += 4) c = R[f.charCodeAt(B)] << 18 | R[f.charCodeAt(B + 1)] << 12 | R[f.charCodeAt(B + 2)] << 6 | R[f.charCodeAt(B + 3)], p[l++] = c >> 16 & 255, p[l++] = c >> 8 & 255, p[l++] = c & 255;
  return y === 2 && (c = R[f.charCodeAt(B)] << 2 | R[f.charCodeAt(B + 1)] >> 4, p[l++] = c & 255), y === 1 && (c = R[f.charCodeAt(B)] << 10 | R[f.charCodeAt(B + 1)] << 4 | R[f.charCodeAt(B + 2)] >> 2, p[l++] = c >> 8 & 255, p[l++] = c & 255), p;
}
function kr(f) {
  return _[f >> 18 & 63] + _[f >> 12 & 63] + _[f >> 6 & 63] + _[f & 63];
}
function Or(f, c, s) {
  for (var w, y = [], p = c; p < s; p += 3) w = (f[p] << 16 & 16711680) + (f[p + 1] << 8 & 65280) + (f[p + 2] & 255), y.push(kr(w));
  return y.join("");
}
function $r(f) {
  for (var c, s = f.length, w = s % 3, y = [], p = 16383, l = 0, m = s - w; l < m; l += p) y.push(Or(f, l, l + p > m ? m : l + p));
  return w === 1 ? (c = f[s - 1], y.push(_[c >> 2] + _[c << 4 & 63] + "==")) : w === 2 && (c = (f[s - 2] << 8) + f[s - 1], y.push(_[c >> 10] + _[c >> 4 & 63] + _[c << 2 & 63] + "=")), y.join("");
}
var J = {};
J.read = function(f, c, s, w, y) {
  var p, l, m = y * 8 - w - 1, B = (1 << m) - 1, F = B >> 1, o = -7, A = s ? y - 1 : 0, b = s ? -1 : 1, T = f[c + A];
  for (A += b, p = T & (1 << -o) - 1, T >>= -o, o += m; o > 0; p = p * 256 + f[c + A], A += b, o -= 8) ;
  for (l = p & (1 << -o) - 1, p >>= -o, o += w; o > 0; l = l * 256 + f[c + A], A += b, o -= 8) ;
  if (p === 0) p = 1 - F;
  else {
    if (p === B) return l ? NaN : (T ? -1 : 1) * (1 / 0);
    l = l + Math.pow(2, w), p = p - F;
  }
  return (T ? -1 : 1) * l * Math.pow(2, p - w);
};
J.write = function(f, c, s, w, y, p) {
  var l, m, B, F = p * 8 - y - 1, o = (1 << F) - 1, A = o >> 1, b = y === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, T = w ? 0 : p - 1, L = w ? 1 : -1, j = c < 0 || c === 0 && 1 / c < 0 ? 1 : 0;
  for (c = Math.abs(c), isNaN(c) || c === 1 / 0 ? (m = isNaN(c) ? 1 : 0, l = o) : (l = Math.floor(Math.log(c) / Math.LN2), c * (B = Math.pow(2, -l)) < 1 && (l--, B *= 2), l + A >= 1 ? c += b / B : c += b * Math.pow(2, 1 - A), c * B >= 2 && (l++, B /= 2), l + A >= o ? (m = 0, l = o) : l + A >= 1 ? (m = (c * B - 1) * Math.pow(2, y), l = l + A) : (m = c * Math.pow(2, A - 1) * Math.pow(2, y), l = 0)); y >= 8; f[s + T] = m & 255, T += L, m /= 256, y -= 8) ;
  for (l = l << y | m, F += y; F > 0; f[s + T] = l & 255, T += L, l /= 256, F -= 8) ;
  f[s + T - L] |= j * 128;
};
(function(f) {
  const c = $, s = J, w = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom") : null;
  f.Buffer = o, f.SlowBuffer = sr, f.INSPECT_MAX_BYTES = 50;
  const y = 2147483647;
  f.kMaxLength = y;
  const { Uint8Array: p, ArrayBuffer: l, SharedArrayBuffer: m } = globalThis;
  o.TYPED_ARRAY_SUPPORT = B(), !o.TYPED_ARRAY_SUPPORT && typeof console < "u" && typeof console.error == "function" && console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support.");
  function B() {
    try {
      const e = new p(1), r = { foo: function() {
        return 42;
      } };
      return Object.setPrototypeOf(r, p.prototype), Object.setPrototypeOf(e, r), e.foo() === 42;
    } catch {
      return false;
    }
  }
  Object.defineProperty(o.prototype, "parent", { enumerable: true, get: function() {
    if (o.isBuffer(this)) return this.buffer;
  } }), Object.defineProperty(o.prototype, "offset", { enumerable: true, get: function() {
    if (o.isBuffer(this)) return this.byteOffset;
  } });
  function F(e) {
    if (e > y) throw new RangeError('The value "' + e + '" is invalid for option "size"');
    const r = new p(e);
    return Object.setPrototypeOf(r, o.prototype), r;
  }
  function o(e, r, t) {
    if (typeof e == "number") {
      if (typeof r == "string") throw new TypeError('The "string" argument must be of type string. Received type number');
      return L(e);
    }
    return A(e, r, t);
  }
  o.poolSize = 8192;
  function A(e, r, t) {
    if (typeof e == "string") return j(e, r);
    if (l.isView(e)) return pr(e);
    if (e == null) throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof e);
    if (C(e, l) || e && C(e.buffer, l) || typeof m < "u" && (C(e, m) || e && C(e.buffer, m))) return Y(e, r, t);
    if (typeof e == "number") throw new TypeError('The "value" argument must not be of type number. Received type number');
    const i = e.valueOf && e.valueOf();
    if (i != null && i !== e) return o.from(i, r, t);
    const n = lr(e);
    if (n) return n;
    if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof e[Symbol.toPrimitive] == "function") return o.from(e[Symbol.toPrimitive]("string"), r, t);
    throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof e);
  }
  o.from = function(e, r, t) {
    return A(e, r, t);
  }, Object.setPrototypeOf(o.prototype, p.prototype), Object.setPrototypeOf(o, p);
  function b(e) {
    if (typeof e != "number") throw new TypeError('"size" argument must be of type number');
    if (e < 0) throw new RangeError('The value "' + e + '" is invalid for option "size"');
  }
  function T(e, r, t) {
    return b(e), e <= 0 ? F(e) : r !== void 0 ? typeof t == "string" ? F(e).fill(r, t) : F(e).fill(r) : F(e);
  }
  o.alloc = function(e, r, t) {
    return T(e, r, t);
  };
  function L(e) {
    return b(e), F(e < 0 ? 0 : W(e) | 0);
  }
  o.allocUnsafe = function(e) {
    return L(e);
  }, o.allocUnsafeSlow = function(e) {
    return L(e);
  };
  function j(e, r) {
    if ((typeof r != "string" || r === "") && (r = "utf8"), !o.isEncoding(r)) throw new TypeError("Unknown encoding: " + r);
    const t = K(e, r) | 0;
    let i = F(t);
    const n = i.write(e, r);
    return n !== t && (i = i.slice(0, n)), i;
  }
  function G(e) {
    const r = e.length < 0 ? 0 : W(e.length) | 0, t = F(r);
    for (let i = 0; i < r; i += 1) t[i] = e[i] & 255;
    return t;
  }
  function pr(e) {
    if (C(e, p)) {
      const r = new p(e);
      return Y(r.buffer, r.byteOffset, r.byteLength);
    }
    return G(e);
  }
  function Y(e, r, t) {
    if (r < 0 || e.byteLength < r) throw new RangeError('"offset" is outside of buffer bounds');
    if (e.byteLength < r + (t || 0)) throw new RangeError('"length" is outside of buffer bounds');
    let i;
    return r === void 0 && t === void 0 ? i = new p(e) : t === void 0 ? i = new p(e, r) : i = new p(e, r, t), Object.setPrototypeOf(i, o.prototype), i;
  }
  function lr(e) {
    if (o.isBuffer(e)) {
      const r = W(e.length) | 0, t = F(r);
      return t.length === 0 || e.copy(t, 0, 0, r), t;
    }
    if (e.length !== void 0) return typeof e.length != "number" || V(e.length) ? F(0) : G(e);
    if (e.type === "Buffer" && Array.isArray(e.data)) return G(e.data);
  }
  function W(e) {
    if (e >= y) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + y.toString(16) + " bytes");
    return e | 0;
  }
  function sr(e) {
    return +e != e && (e = 0), o.alloc(+e);
  }
  o.isBuffer = function(r) {
    return r != null && r._isBuffer === true && r !== o.prototype;
  }, o.compare = function(r, t) {
    if (C(r, p) && (r = o.from(r, r.offset, r.byteLength)), C(t, p) && (t = o.from(t, t.offset, t.byteLength)), !o.isBuffer(r) || !o.isBuffer(t)) throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
    if (r === t) return 0;
    let i = r.length, n = t.length;
    for (let u = 0, h = Math.min(i, n); u < h; ++u) if (r[u] !== t[u]) {
      i = r[u], n = t[u];
      break;
    }
    return i < n ? -1 : n < i ? 1 : 0;
  }, o.isEncoding = function(r) {
    switch (String(r).toLowerCase()) {
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
  }, o.concat = function(r, t) {
    if (!Array.isArray(r)) throw new TypeError('"list" argument must be an Array of Buffers');
    if (r.length === 0) return o.alloc(0);
    let i;
    if (t === void 0) for (t = 0, i = 0; i < r.length; ++i) t += r[i].length;
    const n = o.allocUnsafe(t);
    let u = 0;
    for (i = 0; i < r.length; ++i) {
      let h = r[i];
      if (C(h, p)) u + h.length > n.length ? (o.isBuffer(h) || (h = o.from(h)), h.copy(n, u)) : p.prototype.set.call(n, h, u);
      else if (o.isBuffer(h)) h.copy(n, u);
      else throw new TypeError('"list" argument must be an Array of Buffers');
      u += h.length;
    }
    return n;
  };
  function K(e, r) {
    if (o.isBuffer(e)) return e.length;
    if (l.isView(e) || C(e, l)) return e.byteLength;
    if (typeof e != "string") throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof e);
    const t = e.length, i = arguments.length > 2 && arguments[2] === true;
    if (!i && t === 0) return 0;
    let n = false;
    for (; ; ) switch (r) {
      case "ascii":
      case "latin1":
      case "binary":
        return t;
      case "utf8":
      case "utf-8":
        return H(e).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return t * 2;
      case "hex":
        return t >>> 1;
      case "base64":
        return fr(e).length;
      default:
        if (n) return i ? -1 : H(e).length;
        r = ("" + r).toLowerCase(), n = true;
    }
  }
  o.byteLength = K;
  function ar(e, r, t) {
    let i = false;
    if ((r === void 0 || r < 0) && (r = 0), r > this.length || ((t === void 0 || t > this.length) && (t = this.length), t <= 0) || (t >>>= 0, r >>>= 0, t <= r)) return "";
    for (e || (e = "utf8"); ; ) switch (e) {
      case "hex":
        return Fr(this, r, t);
      case "utf8":
      case "utf-8":
        return v(this, r, t);
      case "ascii":
        return mr(this, r, t);
      case "latin1":
      case "binary":
        return Ir(this, r, t);
      case "base64":
        return dr(this, r, t);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return Ar(this, r, t);
      default:
        if (i) throw new TypeError("Unknown encoding: " + e);
        e = (e + "").toLowerCase(), i = true;
    }
  }
  o.prototype._isBuffer = true;
  function M(e, r, t) {
    const i = e[r];
    e[r] = e[t], e[t] = i;
  }
  o.prototype.swap16 = function() {
    const r = this.length;
    if (r % 2 !== 0) throw new RangeError("Buffer size must be a multiple of 16-bits");
    for (let t = 0; t < r; t += 2) M(this, t, t + 1);
    return this;
  }, o.prototype.swap32 = function() {
    const r = this.length;
    if (r % 4 !== 0) throw new RangeError("Buffer size must be a multiple of 32-bits");
    for (let t = 0; t < r; t += 4) M(this, t, t + 3), M(this, t + 1, t + 2);
    return this;
  }, o.prototype.swap64 = function() {
    const r = this.length;
    if (r % 8 !== 0) throw new RangeError("Buffer size must be a multiple of 64-bits");
    for (let t = 0; t < r; t += 8) M(this, t, t + 7), M(this, t + 1, t + 6), M(this, t + 2, t + 5), M(this, t + 3, t + 4);
    return this;
  }, o.prototype.toString = function() {
    const r = this.length;
    return r === 0 ? "" : arguments.length === 0 ? v(this, 0, r) : ar.apply(this, arguments);
  }, o.prototype.toLocaleString = o.prototype.toString, o.prototype.equals = function(r) {
    if (!o.isBuffer(r)) throw new TypeError("Argument must be a Buffer");
    return this === r ? true : o.compare(this, r) === 0;
  }, o.prototype.inspect = function() {
    let r = "";
    const t = f.INSPECT_MAX_BYTES;
    return r = this.toString("hex", 0, t).replace(/(.{2})/g, "$1 ").trim(), this.length > t && (r += " ... "), "<Buffer " + r + ">";
  }, w && (o.prototype[w] = o.prototype.inspect), o.prototype.compare = function(r, t, i, n, u) {
    if (C(r, p) && (r = o.from(r, r.offset, r.byteLength)), !o.isBuffer(r)) throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof r);
    if (t === void 0 && (t = 0), i === void 0 && (i = r ? r.length : 0), n === void 0 && (n = 0), u === void 0 && (u = this.length), t < 0 || i > r.length || n < 0 || u > this.length) throw new RangeError("out of range index");
    if (n >= u && t >= i) return 0;
    if (n >= u) return -1;
    if (t >= i) return 1;
    if (t >>>= 0, i >>>= 0, n >>>= 0, u >>>= 0, this === r) return 0;
    let h = u - n, a = i - t;
    const d = Math.min(h, a), E = this.slice(n, u), g = r.slice(t, i);
    for (let x = 0; x < d; ++x) if (E[x] !== g[x]) {
      h = E[x], a = g[x];
      break;
    }
    return h < a ? -1 : a < h ? 1 : 0;
  };
  function Z(e, r, t, i, n) {
    if (e.length === 0) return -1;
    if (typeof t == "string" ? (i = t, t = 0) : t > 2147483647 ? t = 2147483647 : t < -2147483648 && (t = -2147483648), t = +t, V(t) && (t = n ? 0 : e.length - 1), t < 0 && (t = e.length + t), t >= e.length) {
      if (n) return -1;
      t = e.length - 1;
    } else if (t < 0) if (n) t = 0;
    else return -1;
    if (typeof r == "string" && (r = o.from(r, i)), o.isBuffer(r)) return r.length === 0 ? -1 : Q(e, r, t, i, n);
    if (typeof r == "number") return r = r & 255, typeof p.prototype.indexOf == "function" ? n ? p.prototype.indexOf.call(e, r, t) : p.prototype.lastIndexOf.call(e, r, t) : Q(e, [r], t, i, n);
    throw new TypeError("val must be string, number or Buffer");
  }
  function Q(e, r, t, i, n) {
    let u = 1, h = e.length, a = r.length;
    if (i !== void 0 && (i = String(i).toLowerCase(), i === "ucs2" || i === "ucs-2" || i === "utf16le" || i === "utf-16le")) {
      if (e.length < 2 || r.length < 2) return -1;
      u = 2, h /= 2, a /= 2, t /= 2;
    }
    function d(g, x) {
      return u === 1 ? g[x] : g.readUInt16BE(x * u);
    }
    let E;
    if (n) {
      let g = -1;
      for (E = t; E < h; E++) if (d(e, E) === d(r, g === -1 ? 0 : E - g)) {
        if (g === -1 && (g = E), E - g + 1 === a) return g * u;
      } else g !== -1 && (E -= E - g), g = -1;
    } else for (t + a > h && (t = h - a), E = t; E >= 0; E--) {
      let g = true;
      for (let x = 0; x < a; x++) if (d(e, E + x) !== d(r, x)) {
        g = false;
        break;
      }
      if (g) return E;
    }
    return -1;
  }
  o.prototype.includes = function(r, t, i) {
    return this.indexOf(r, t, i) !== -1;
  }, o.prototype.indexOf = function(r, t, i) {
    return Z(this, r, t, i, true);
  }, o.prototype.lastIndexOf = function(r, t, i) {
    return Z(this, r, t, i, false);
  };
  function yr(e, r, t, i) {
    t = Number(t) || 0;
    const n = e.length - t;
    i ? (i = Number(i), i > n && (i = n)) : i = n;
    const u = r.length;
    i > u / 2 && (i = u / 2);
    let h;
    for (h = 0; h < i; ++h) {
      const a = parseInt(r.substr(h * 2, 2), 16);
      if (V(a)) return h;
      e[t + h] = a;
    }
    return h;
  }
  function wr(e, r, t, i) {
    return O(H(r, e.length - t), e, t, i);
  }
  function xr(e, r, t, i) {
    return O(Cr(r), e, t, i);
  }
  function Br(e, r, t, i) {
    return O(fr(r), e, t, i);
  }
  function Er(e, r, t, i) {
    return O(_r(r, e.length - t), e, t, i);
  }
  o.prototype.write = function(r, t, i, n) {
    if (t === void 0) n = "utf8", i = this.length, t = 0;
    else if (i === void 0 && typeof t == "string") n = t, i = this.length, t = 0;
    else if (isFinite(t)) t = t >>> 0, isFinite(i) ? (i = i >>> 0, n === void 0 && (n = "utf8")) : (n = i, i = void 0);
    else throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
    const u = this.length - t;
    if ((i === void 0 || i > u) && (i = u), r.length > 0 && (i < 0 || t < 0) || t > this.length) throw new RangeError("Attempt to write outside buffer bounds");
    n || (n = "utf8");
    let h = false;
    for (; ; ) switch (n) {
      case "hex":
        return yr(this, r, t, i);
      case "utf8":
      case "utf-8":
        return wr(this, r, t, i);
      case "ascii":
      case "latin1":
      case "binary":
        return xr(this, r, t, i);
      case "base64":
        return Br(this, r, t, i);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return Er(this, r, t, i);
      default:
        if (h) throw new TypeError("Unknown encoding: " + n);
        n = ("" + n).toLowerCase(), h = true;
    }
  }, o.prototype.toJSON = function() {
    return { type: "Buffer", data: Array.prototype.slice.call(this._arr || this, 0) };
  };
  function dr(e, r, t) {
    return r === 0 && t === e.length ? c.fromByteArray(e) : c.fromByteArray(e.slice(r, t));
  }
  function v(e, r, t) {
    t = Math.min(e.length, t);
    const i = [];
    let n = r;
    for (; n < t; ) {
      const u = e[n];
      let h = null, a = u > 239 ? 4 : u > 223 ? 3 : u > 191 ? 2 : 1;
      if (n + a <= t) {
        let d, E, g, x;
        switch (a) {
          case 1:
            u < 128 && (h = u);
            break;
          case 2:
            d = e[n + 1], (d & 192) === 128 && (x = (u & 31) << 6 | d & 63, x > 127 && (h = x));
            break;
          case 3:
            d = e[n + 1], E = e[n + 2], (d & 192) === 128 && (E & 192) === 128 && (x = (u & 15) << 12 | (d & 63) << 6 | E & 63, x > 2047 && (x < 55296 || x > 57343) && (h = x));
            break;
          case 4:
            d = e[n + 1], E = e[n + 2], g = e[n + 3], (d & 192) === 128 && (E & 192) === 128 && (g & 192) === 128 && (x = (u & 15) << 18 | (d & 63) << 12 | (E & 63) << 6 | g & 63, x > 65535 && x < 1114112 && (h = x));
        }
      }
      h === null ? (h = 65533, a = 1) : h > 65535 && (h -= 65536, i.push(h >>> 10 & 1023 | 55296), h = 56320 | h & 1023), i.push(h), n += a;
    }
    return gr(i);
  }
  const rr = 4096;
  function gr(e) {
    const r = e.length;
    if (r <= rr) return String.fromCharCode.apply(String, e);
    let t = "", i = 0;
    for (; i < r; ) t += String.fromCharCode.apply(String, e.slice(i, i += rr));
    return t;
  }
  function mr(e, r, t) {
    let i = "";
    t = Math.min(e.length, t);
    for (let n = r; n < t; ++n) i += String.fromCharCode(e[n] & 127);
    return i;
  }
  function Ir(e, r, t) {
    let i = "";
    t = Math.min(e.length, t);
    for (let n = r; n < t; ++n) i += String.fromCharCode(e[n]);
    return i;
  }
  function Fr(e, r, t) {
    const i = e.length;
    (!r || r < 0) && (r = 0), (!t || t < 0 || t > i) && (t = i);
    let n = "";
    for (let u = r; u < t; ++u) n += br[e[u]];
    return n;
  }
  function Ar(e, r, t) {
    const i = e.slice(r, t);
    let n = "";
    for (let u = 0; u < i.length - 1; u += 2) n += String.fromCharCode(i[u] + i[u + 1] * 256);
    return n;
  }
  o.prototype.slice = function(r, t) {
    const i = this.length;
    r = ~~r, t = t === void 0 ? i : ~~t, r < 0 ? (r += i, r < 0 && (r = 0)) : r > i && (r = i), t < 0 ? (t += i, t < 0 && (t = 0)) : t > i && (t = i), t < r && (t = r);
    const n = this.subarray(r, t);
    return Object.setPrototypeOf(n, o.prototype), n;
  };
  function I(e, r, t) {
    if (e % 1 !== 0 || e < 0) throw new RangeError("offset is not uint");
    if (e + r > t) throw new RangeError("Trying to access beyond buffer length");
  }
  o.prototype.readUintLE = o.prototype.readUIntLE = function(r, t, i) {
    r = r >>> 0, t = t >>> 0, i || I(r, t, this.length);
    let n = this[r], u = 1, h = 0;
    for (; ++h < t && (u *= 256); ) n += this[r + h] * u;
    return n;
  }, o.prototype.readUintBE = o.prototype.readUIntBE = function(r, t, i) {
    r = r >>> 0, t = t >>> 0, i || I(r, t, this.length);
    let n = this[r + --t], u = 1;
    for (; t > 0 && (u *= 256); ) n += this[r + --t] * u;
    return n;
  }, o.prototype.readUint8 = o.prototype.readUInt8 = function(r, t) {
    return r = r >>> 0, t || I(r, 1, this.length), this[r];
  }, o.prototype.readUint16LE = o.prototype.readUInt16LE = function(r, t) {
    return r = r >>> 0, t || I(r, 2, this.length), this[r] | this[r + 1] << 8;
  }, o.prototype.readUint16BE = o.prototype.readUInt16BE = function(r, t) {
    return r = r >>> 0, t || I(r, 2, this.length), this[r] << 8 | this[r + 1];
  }, o.prototype.readUint32LE = o.prototype.readUInt32LE = function(r, t) {
    return r = r >>> 0, t || I(r, 4, this.length), (this[r] | this[r + 1] << 8 | this[r + 2] << 16) + this[r + 3] * 16777216;
  }, o.prototype.readUint32BE = o.prototype.readUInt32BE = function(r, t) {
    return r = r >>> 0, t || I(r, 4, this.length), this[r] * 16777216 + (this[r + 1] << 16 | this[r + 2] << 8 | this[r + 3]);
  }, o.prototype.readBigUInt64LE = S(function(r) {
    r = r >>> 0, D(r, "offset");
    const t = this[r], i = this[r + 7];
    (t === void 0 || i === void 0) && k(r, this.length - 8);
    const n = t + this[++r] * 2 ** 8 + this[++r] * 2 ** 16 + this[++r] * 2 ** 24, u = this[++r] + this[++r] * 2 ** 8 + this[++r] * 2 ** 16 + i * 2 ** 24;
    return BigInt(n) + (BigInt(u) << BigInt(32));
  }), o.prototype.readBigUInt64BE = S(function(r) {
    r = r >>> 0, D(r, "offset");
    const t = this[r], i = this[r + 7];
    (t === void 0 || i === void 0) && k(r, this.length - 8);
    const n = t * 2 ** 24 + this[++r] * 2 ** 16 + this[++r] * 2 ** 8 + this[++r], u = this[++r] * 2 ** 24 + this[++r] * 2 ** 16 + this[++r] * 2 ** 8 + i;
    return (BigInt(n) << BigInt(32)) + BigInt(u);
  }), o.prototype.readIntLE = function(r, t, i) {
    r = r >>> 0, t = t >>> 0, i || I(r, t, this.length);
    let n = this[r], u = 1, h = 0;
    for (; ++h < t && (u *= 256); ) n += this[r + h] * u;
    return u *= 128, n >= u && (n -= Math.pow(2, 8 * t)), n;
  }, o.prototype.readIntBE = function(r, t, i) {
    r = r >>> 0, t = t >>> 0, i || I(r, t, this.length);
    let n = t, u = 1, h = this[r + --n];
    for (; n > 0 && (u *= 256); ) h += this[r + --n] * u;
    return u *= 128, h >= u && (h -= Math.pow(2, 8 * t)), h;
  }, o.prototype.readInt8 = function(r, t) {
    return r = r >>> 0, t || I(r, 1, this.length), this[r] & 128 ? (255 - this[r] + 1) * -1 : this[r];
  }, o.prototype.readInt16LE = function(r, t) {
    r = r >>> 0, t || I(r, 2, this.length);
    const i = this[r] | this[r + 1] << 8;
    return i & 32768 ? i | 4294901760 : i;
  }, o.prototype.readInt16BE = function(r, t) {
    r = r >>> 0, t || I(r, 2, this.length);
    const i = this[r + 1] | this[r] << 8;
    return i & 32768 ? i | 4294901760 : i;
  }, o.prototype.readInt32LE = function(r, t) {
    return r = r >>> 0, t || I(r, 4, this.length), this[r] | this[r + 1] << 8 | this[r + 2] << 16 | this[r + 3] << 24;
  }, o.prototype.readInt32BE = function(r, t) {
    return r = r >>> 0, t || I(r, 4, this.length), this[r] << 24 | this[r + 1] << 16 | this[r + 2] << 8 | this[r + 3];
  }, o.prototype.readBigInt64LE = S(function(r) {
    r = r >>> 0, D(r, "offset");
    const t = this[r], i = this[r + 7];
    (t === void 0 || i === void 0) && k(r, this.length - 8);
    const n = this[r + 4] + this[r + 5] * 2 ** 8 + this[r + 6] * 2 ** 16 + (i << 24);
    return (BigInt(n) << BigInt(32)) + BigInt(t + this[++r] * 2 ** 8 + this[++r] * 2 ** 16 + this[++r] * 2 ** 24);
  }), o.prototype.readBigInt64BE = S(function(r) {
    r = r >>> 0, D(r, "offset");
    const t = this[r], i = this[r + 7];
    (t === void 0 || i === void 0) && k(r, this.length - 8);
    const n = (t << 24) + this[++r] * 2 ** 16 + this[++r] * 2 ** 8 + this[++r];
    return (BigInt(n) << BigInt(32)) + BigInt(this[++r] * 2 ** 24 + this[++r] * 2 ** 16 + this[++r] * 2 ** 8 + i);
  }), o.prototype.readFloatLE = function(r, t) {
    return r = r >>> 0, t || I(r, 4, this.length), s.read(this, r, true, 23, 4);
  }, o.prototype.readFloatBE = function(r, t) {
    return r = r >>> 0, t || I(r, 4, this.length), s.read(this, r, false, 23, 4);
  }, o.prototype.readDoubleLE = function(r, t) {
    return r = r >>> 0, t || I(r, 8, this.length), s.read(this, r, true, 52, 8);
  }, o.prototype.readDoubleBE = function(r, t) {
    return r = r >>> 0, t || I(r, 8, this.length), s.read(this, r, false, 52, 8);
  };
  function U(e, r, t, i, n, u) {
    if (!o.isBuffer(e)) throw new TypeError('"buffer" argument must be a Buffer instance');
    if (r > n || r < u) throw new RangeError('"value" argument is out of bounds');
    if (t + i > e.length) throw new RangeError("Index out of range");
  }
  o.prototype.writeUintLE = o.prototype.writeUIntLE = function(r, t, i, n) {
    if (r = +r, t = t >>> 0, i = i >>> 0, !n) {
      const a = Math.pow(2, 8 * i) - 1;
      U(this, r, t, i, a, 0);
    }
    let u = 1, h = 0;
    for (this[t] = r & 255; ++h < i && (u *= 256); ) this[t + h] = r / u & 255;
    return t + i;
  }, o.prototype.writeUintBE = o.prototype.writeUIntBE = function(r, t, i, n) {
    if (r = +r, t = t >>> 0, i = i >>> 0, !n) {
      const a = Math.pow(2, 8 * i) - 1;
      U(this, r, t, i, a, 0);
    }
    let u = i - 1, h = 1;
    for (this[t + u] = r & 255; --u >= 0 && (h *= 256); ) this[t + u] = r / h & 255;
    return t + i;
  }, o.prototype.writeUint8 = o.prototype.writeUInt8 = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 1, 255, 0), this[t] = r & 255, t + 1;
  }, o.prototype.writeUint16LE = o.prototype.writeUInt16LE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 2, 65535, 0), this[t] = r & 255, this[t + 1] = r >>> 8, t + 2;
  }, o.prototype.writeUint16BE = o.prototype.writeUInt16BE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 2, 65535, 0), this[t] = r >>> 8, this[t + 1] = r & 255, t + 2;
  }, o.prototype.writeUint32LE = o.prototype.writeUInt32LE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 4, 4294967295, 0), this[t + 3] = r >>> 24, this[t + 2] = r >>> 16, this[t + 1] = r >>> 8, this[t] = r & 255, t + 4;
  }, o.prototype.writeUint32BE = o.prototype.writeUInt32BE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 4, 4294967295, 0), this[t] = r >>> 24, this[t + 1] = r >>> 16, this[t + 2] = r >>> 8, this[t + 3] = r & 255, t + 4;
  };
  function tr(e, r, t, i, n) {
    hr(r, i, n, e, t, 7);
    let u = Number(r & BigInt(4294967295));
    e[t++] = u, u = u >> 8, e[t++] = u, u = u >> 8, e[t++] = u, u = u >> 8, e[t++] = u;
    let h = Number(r >> BigInt(32) & BigInt(4294967295));
    return e[t++] = h, h = h >> 8, e[t++] = h, h = h >> 8, e[t++] = h, h = h >> 8, e[t++] = h, t;
  }
  function er(e, r, t, i, n) {
    hr(r, i, n, e, t, 7);
    let u = Number(r & BigInt(4294967295));
    e[t + 7] = u, u = u >> 8, e[t + 6] = u, u = u >> 8, e[t + 5] = u, u = u >> 8, e[t + 4] = u;
    let h = Number(r >> BigInt(32) & BigInt(4294967295));
    return e[t + 3] = h, h = h >> 8, e[t + 2] = h, h = h >> 8, e[t + 1] = h, h = h >> 8, e[t] = h, t + 8;
  }
  o.prototype.writeBigUInt64LE = S(function(r, t = 0) {
    return tr(this, r, t, BigInt(0), BigInt("0xffffffffffffffff"));
  }), o.prototype.writeBigUInt64BE = S(function(r, t = 0) {
    return er(this, r, t, BigInt(0), BigInt("0xffffffffffffffff"));
  }), o.prototype.writeIntLE = function(r, t, i, n) {
    if (r = +r, t = t >>> 0, !n) {
      const d = Math.pow(2, 8 * i - 1);
      U(this, r, t, i, d - 1, -d);
    }
    let u = 0, h = 1, a = 0;
    for (this[t] = r & 255; ++u < i && (h *= 256); ) r < 0 && a === 0 && this[t + u - 1] !== 0 && (a = 1), this[t + u] = (r / h >> 0) - a & 255;
    return t + i;
  }, o.prototype.writeIntBE = function(r, t, i, n) {
    if (r = +r, t = t >>> 0, !n) {
      const d = Math.pow(2, 8 * i - 1);
      U(this, r, t, i, d - 1, -d);
    }
    let u = i - 1, h = 1, a = 0;
    for (this[t + u] = r & 255; --u >= 0 && (h *= 256); ) r < 0 && a === 0 && this[t + u + 1] !== 0 && (a = 1), this[t + u] = (r / h >> 0) - a & 255;
    return t + i;
  }, o.prototype.writeInt8 = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 1, 127, -128), r < 0 && (r = 255 + r + 1), this[t] = r & 255, t + 1;
  }, o.prototype.writeInt16LE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 2, 32767, -32768), this[t] = r & 255, this[t + 1] = r >>> 8, t + 2;
  }, o.prototype.writeInt16BE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 2, 32767, -32768), this[t] = r >>> 8, this[t + 1] = r & 255, t + 2;
  }, o.prototype.writeInt32LE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 4, 2147483647, -2147483648), this[t] = r & 255, this[t + 1] = r >>> 8, this[t + 2] = r >>> 16, this[t + 3] = r >>> 24, t + 4;
  }, o.prototype.writeInt32BE = function(r, t, i) {
    return r = +r, t = t >>> 0, i || U(this, r, t, 4, 2147483647, -2147483648), r < 0 && (r = 4294967295 + r + 1), this[t] = r >>> 24, this[t + 1] = r >>> 16, this[t + 2] = r >>> 8, this[t + 3] = r & 255, t + 4;
  }, o.prototype.writeBigInt64LE = S(function(r, t = 0) {
    return tr(this, r, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  }), o.prototype.writeBigInt64BE = S(function(r, t = 0) {
    return er(this, r, t, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  });
  function ir(e, r, t, i, n, u) {
    if (t + i > e.length) throw new RangeError("Index out of range");
    if (t < 0) throw new RangeError("Index out of range");
  }
  function nr(e, r, t, i, n) {
    return r = +r, t = t >>> 0, n || ir(e, r, t, 4), s.write(e, r, t, i, 23, 4), t + 4;
  }
  o.prototype.writeFloatLE = function(r, t, i) {
    return nr(this, r, t, true, i);
  }, o.prototype.writeFloatBE = function(r, t, i) {
    return nr(this, r, t, false, i);
  };
  function or(e, r, t, i, n) {
    return r = +r, t = t >>> 0, n || ir(e, r, t, 8), s.write(e, r, t, i, 52, 8), t + 8;
  }
  o.prototype.writeDoubleLE = function(r, t, i) {
    return or(this, r, t, true, i);
  }, o.prototype.writeDoubleBE = function(r, t, i) {
    return or(this, r, t, false, i);
  }, o.prototype.copy = function(r, t, i, n) {
    if (!o.isBuffer(r)) throw new TypeError("argument should be a Buffer");
    if (i || (i = 0), !n && n !== 0 && (n = this.length), t >= r.length && (t = r.length), t || (t = 0), n > 0 && n < i && (n = i), n === i || r.length === 0 || this.length === 0) return 0;
    if (t < 0) throw new RangeError("targetStart out of bounds");
    if (i < 0 || i >= this.length) throw new RangeError("Index out of range");
    if (n < 0) throw new RangeError("sourceEnd out of bounds");
    n > this.length && (n = this.length), r.length - t < n - i && (n = r.length - t + i);
    const u = n - i;
    return this === r && typeof p.prototype.copyWithin == "function" ? this.copyWithin(t, i, n) : p.prototype.set.call(r, this.subarray(i, n), t), u;
  }, o.prototype.fill = function(r, t, i, n) {
    if (typeof r == "string") {
      if (typeof t == "string" ? (n = t, t = 0, i = this.length) : typeof i == "string" && (n = i, i = this.length), n !== void 0 && typeof n != "string") throw new TypeError("encoding must be a string");
      if (typeof n == "string" && !o.isEncoding(n)) throw new TypeError("Unknown encoding: " + n);
      if (r.length === 1) {
        const h = r.charCodeAt(0);
        (n === "utf8" && h < 128 || n === "latin1") && (r = h);
      }
    } else typeof r == "number" ? r = r & 255 : typeof r == "boolean" && (r = Number(r));
    if (t < 0 || this.length < t || this.length < i) throw new RangeError("Out of range index");
    if (i <= t) return this;
    t = t >>> 0, i = i === void 0 ? this.length : i >>> 0, r || (r = 0);
    let u;
    if (typeof r == "number") for (u = t; u < i; ++u) this[u] = r;
    else {
      const h = o.isBuffer(r) ? r : o.from(r, n), a = h.length;
      if (a === 0) throw new TypeError('The value "' + r + '" is invalid for argument "value"');
      for (u = 0; u < i - t; ++u) this[u + t] = h[u % a];
    }
    return this;
  };
  const N = {};
  function q(e, r, t) {
    N[e] = class extends t {
      constructor() {
        super(), Object.defineProperty(this, "message", { value: r.apply(this, arguments), writable: true, configurable: true }), this.name = `${this.name} [${e}]`, this.stack, delete this.name;
      }
      get code() {
        return e;
      }
      set code(n) {
        Object.defineProperty(this, "code", { configurable: true, enumerable: true, value: n, writable: true });
      }
      toString() {
        return `${this.name} [${e}]: ${this.message}`;
      }
    };
  }
  q("ERR_BUFFER_OUT_OF_BOUNDS", function(e) {
    return e ? `${e} is outside of buffer bounds` : "Attempt to access memory outside buffer bounds";
  }, RangeError), q("ERR_INVALID_ARG_TYPE", function(e, r) {
    return `The "${e}" argument must be of type number. Received type ${typeof r}`;
  }, TypeError), q("ERR_OUT_OF_RANGE", function(e, r, t) {
    let i = `The value of "${e}" is out of range.`, n = t;
    return Number.isInteger(t) && Math.abs(t) > 2 ** 32 ? n = ur(String(t)) : typeof t == "bigint" && (n = String(t), (t > BigInt(2) ** BigInt(32) || t < -(BigInt(2) ** BigInt(32))) && (n = ur(n)), n += "n"), i += ` It must be ${r}. Received ${n}`, i;
  }, RangeError);
  function ur(e) {
    let r = "", t = e.length;
    const i = e[0] === "-" ? 1 : 0;
    for (; t >= i + 4; t -= 3) r = `_${e.slice(t - 3, t)}${r}`;
    return `${e.slice(0, t)}${r}`;
  }
  function Ur(e, r, t) {
    D(r, "offset"), (e[r] === void 0 || e[r + t] === void 0) && k(r, e.length - (t + 1));
  }
  function hr(e, r, t, i, n, u) {
    if (e > t || e < r) {
      const h = typeof r == "bigint" ? "n" : "";
      let a;
      throw r === 0 || r === BigInt(0) ? a = `>= 0${h} and < 2${h} ** ${(u + 1) * 8}${h}` : a = `>= -(2${h} ** ${(u + 1) * 8 - 1}${h}) and < 2 ** ${(u + 1) * 8 - 1}${h}`, new N.ERR_OUT_OF_RANGE("value", a, e);
    }
    Ur(i, n, u);
  }
  function D(e, r) {
    if (typeof e != "number") throw new N.ERR_INVALID_ARG_TYPE(r, "number", e);
  }
  function k(e, r, t) {
    throw Math.floor(e) !== e ? (D(e, t), new N.ERR_OUT_OF_RANGE("offset", "an integer", e)) : r < 0 ? new N.ERR_BUFFER_OUT_OF_BOUNDS() : new N.ERR_OUT_OF_RANGE("offset", `>= 0 and <= ${r}`, e);
  }
  const Tr = /[^+/0-9A-Za-z-_]/g;
  function Rr(e) {
    if (e = e.split("=")[0], e = e.trim().replace(Tr, ""), e.length < 2) return "";
    for (; e.length % 4 !== 0; ) e = e + "=";
    return e;
  }
  function H(e, r) {
    r = r || 1 / 0;
    let t;
    const i = e.length;
    let n = null;
    const u = [];
    for (let h = 0; h < i; ++h) {
      if (t = e.charCodeAt(h), t > 55295 && t < 57344) {
        if (!n) {
          if (t > 56319) {
            (r -= 3) > -1 && u.push(239, 191, 189);
            continue;
          } else if (h + 1 === i) {
            (r -= 3) > -1 && u.push(239, 191, 189);
            continue;
          }
          n = t;
          continue;
        }
        if (t < 56320) {
          (r -= 3) > -1 && u.push(239, 191, 189), n = t;
          continue;
        }
        t = (n - 55296 << 10 | t - 56320) + 65536;
      } else n && (r -= 3) > -1 && u.push(239, 191, 189);
      if (n = null, t < 128) {
        if ((r -= 1) < 0) break;
        u.push(t);
      } else if (t < 2048) {
        if ((r -= 2) < 0) break;
        u.push(t >> 6 | 192, t & 63 | 128);
      } else if (t < 65536) {
        if ((r -= 3) < 0) break;
        u.push(t >> 12 | 224, t >> 6 & 63 | 128, t & 63 | 128);
      } else if (t < 1114112) {
        if ((r -= 4) < 0) break;
        u.push(t >> 18 | 240, t >> 12 & 63 | 128, t >> 6 & 63 | 128, t & 63 | 128);
      } else throw new Error("Invalid code point");
    }
    return u;
  }
  function Cr(e) {
    const r = [];
    for (let t = 0; t < e.length; ++t) r.push(e.charCodeAt(t) & 255);
    return r;
  }
  function _r(e, r) {
    let t, i, n;
    const u = [];
    for (let h = 0; h < e.length && !((r -= 2) < 0); ++h) t = e.charCodeAt(h), i = t >> 8, n = t % 256, u.push(n), u.push(i);
    return u;
  }
  function fr(e) {
    return c.toByteArray(Rr(e));
  }
  function O(e, r, t, i) {
    let n;
    for (n = 0; n < i && !(n + t >= r.length || n >= e.length); ++n) r[n + t] = e[n];
    return n;
  }
  function C(e, r) {
    return e instanceof r || e != null && e.constructor != null && e.constructor.name != null && e.constructor.name === r.name;
  }
  function V(e) {
    return e !== e;
  }
  const br = (function() {
    const e = "0123456789abcdef", r = new Array(256);
    for (let t = 0; t < 16; ++t) {
      const i = t * 16;
      for (let n = 0; n < 16; ++n) r[i + n] = e[t] + e[n];
    }
    return r;
  })();
  function S(e) {
    return typeof BigInt > "u" ? Sr : e;
  }
  function Sr() {
    throw new Error("BigInt not supported");
  }
})(z);
const jr = z.Buffer, Gr = z.Buffer, Vr = Object.freeze(Object.defineProperty({ __proto__: null, Buffer: Gr, default: jr }, Symbol.toStringTag, { value: "Module" }));
export {
  jr as B,
  qr as a,
  Yr as c,
  Wr as g,
  Vr as i
};
