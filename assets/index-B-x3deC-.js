var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u2, _v, _w, _x, _y, _z, _A, _B, _C, _D, _i2, _D2, _u3, _t2, _n2, _e2, _F, _Pu_instances, r_fn, o_fn;
import f from "./index-DsRfobeB.js";
import "./index-CtQ99MjB.js";
import { o as du } from "./browser-IDnKKmR3.js";
const S = ((_a = globalThis.window) == null ? void 0 : _a.document) !== void 0;
(_c = (_b = globalThis.process) == null ? void 0 : _b.versions) == null ? void 0 : _c.node;
(_e = (_d = globalThis.process) == null ? void 0 : _d.versions) == null ? void 0 : _e.bun;
(_g = (_f = globalThis.Deno) == null ? void 0 : _f.version) == null ? void 0 : _g.deno;
(_i = (_h = globalThis.process) == null ? void 0 : _h.versions) == null ? void 0 : _i.electron;
(_k = (_j = globalThis.navigator) == null ? void 0 : _j.userAgent) == null ? void 0 : _k.includes("jsdom");
typeof WorkerGlobalScope < "u" && globalThis instanceof WorkerGlobalScope;
typeof DedicatedWorkerGlobalScope < "u" && globalThis instanceof DedicatedWorkerGlobalScope;
typeof SharedWorkerGlobalScope < "u" && globalThis instanceof SharedWorkerGlobalScope;
typeof ServiceWorkerGlobalScope < "u" && globalThis instanceof ServiceWorkerGlobalScope;
const P = (_m = (_l = globalThis.navigator) == null ? void 0 : _l.userAgentData) == null ? void 0 : _m.platform;
P === "macOS" || ((_n = globalThis.navigator) == null ? void 0 : _n.platform) === "MacIntel" || ((_p = (_o = globalThis.navigator) == null ? void 0 : _o.userAgent) == null ? void 0 : _p.includes(" Mac ")) === true || ((_q = globalThis.process) == null ? void 0 : _q.platform);
P === "Windows" || ((_r = globalThis.navigator) == null ? void 0 : _r.platform) === "Win32" || ((_s = globalThis.process) == null ? void 0 : _s.platform);
P === "Linux" || ((_u2 = (_t = globalThis.navigator) == null ? void 0 : _t.platform) == null ? void 0 : _u2.startsWith("Linux")) === true || ((_w = (_v = globalThis.navigator) == null ? void 0 : _v.userAgent) == null ? void 0 : _w.includes(" Linux ")) === true || ((_x = globalThis.process) == null ? void 0 : _x.platform);
P === "Android" || ((_y = globalThis.navigator) == null ? void 0 : _y.platform) === "Android" || ((_A = (_z = globalThis.navigator) == null ? void 0 : _z.userAgent) == null ? void 0 : _A.includes(" Android ")) === true || ((_B = globalThis.process) == null ? void 0 : _B.platform);
const g = "\x1B[";
!S && f.env.TERM_PROGRAM;
const hu = !S && f.platform === "win32";
!S && (((_C = f.env.TERM) == null ? void 0 : _C.startsWith("screen")) || ((_D = f.env.TERM) == null ? void 0 : _D.startsWith("tmux")) || f.env.TMUX);
S || f.cwd;
const M = (u = 1) => g + u + "A", q = (u = 1) => g + u + "B", L = g + "G", T = (u) => {
  let D = "";
  for (let F = 0; F < u; F++) D += iu + (F < u - 1 ? M() : "");
  return u && (D += L), D;
}, gu = g + "K", iu = g + "2K", J = g + "2J", Au = () => {
  if (S || !hu) return false;
  const u = du.release().split("."), D = Number(u[0]), F = Number(u[2] ?? 0);
  return D < 10 || D === 10 && F < 10586;
};
Au() ? `${J}${g}` : `${J}${g}${g}`;
const pu = (u, D, F, e) => {
  if (F === "length" || F === "prototype" || F === "arguments" || F === "caller") return;
  const t = Object.getOwnPropertyDescriptor(u, F), i = Object.getOwnPropertyDescriptor(D, F);
  !mu(t, i) && e || Object.defineProperty(u, F, i);
}, mu = function(u, D) {
  return u === void 0 || u.configurable || u.writable === D.writable && u.enumerable === D.enumerable && u.configurable === D.configurable && (u.writable || u.value === D.value);
}, bu = (u, D) => {
  const F = Object.getPrototypeOf(D);
  F !== Object.getPrototypeOf(u) && Object.setPrototypeOf(u, F);
}, xu = (u, D) => `/* Wrapped ${u}*/
${D}`, wu = Object.getOwnPropertyDescriptor(Function.prototype, "toString"), Su = Object.getOwnPropertyDescriptor(Function.prototype.toString, "name"), Tu = (u, D, F) => {
  const e = F === "" ? "" : `with ${F.trim()}() `, t = xu.bind(null, e, D.toString());
  Object.defineProperty(t, "name", Su);
  const { writable: i, enumerable: r, configurable: n } = wu;
  Object.defineProperty(u, "toString", { value: t, writable: i, enumerable: r, configurable: n });
};
function yu(u, D, { ignoreNonConfigurable: F = false } = {}) {
  const { name: e } = u;
  for (const t of Reflect.ownKeys(D)) pu(u, D, t, F);
  return bu(u, D), Tu(u, D, e), u;
}
const _ = /* @__PURE__ */ new WeakMap(), ru = (u, D = {}) => {
  if (typeof u != "function") throw new TypeError("Expected a function");
  let F, e = 0;
  const t = u.displayName || u.name || "<anonymous>", i = function(...r) {
    if (_.set(i, ++e), e === 1) F = u.apply(this, r), u = void 0;
    else if (D.throw === true) throw new Error(`Function \`${t}\` can only be called once`);
    return F;
  };
  return yu(i, u), _.set(i, e), i;
};
ru.callCount = (u) => {
  if (!_.has(u)) throw new Error(`The given function \`${u.name}\` is not wrapped by the \`onetime\` package`);
  return _.get(u);
};
const m = [];
m.push("SIGHUP", "SIGINT", "SIGTERM");
f.platform !== "win32" && m.push("SIGALRM", "SIGABRT", "SIGVTALRM", "SIGXCPU", "SIGXFSZ", "SIGUSR2", "SIGTRAP", "SIGSYS", "SIGQUIT", "SIGIOT");
f.platform === "linux" && m.push("SIGIO", "SIGPOLL", "SIGPWR", "SIGSTKFLT");
const I = (u) => !!u && typeof u == "object" && typeof u.removeListener == "function" && typeof u.emit == "function" && typeof u.reallyExit == "function" && typeof u.listeners == "function" && typeof u.kill == "function" && typeof u.pid == "number" && typeof u.on == "function", $ = /* @__PURE__ */ Symbol.for("signal-exit emitter"), j = globalThis, Iu = Object.defineProperty.bind(Object);
class _u {
  constructor() {
    __publicField(this, "emitted", { afterExit: false, exit: false });
    __publicField(this, "listeners", { afterExit: [], exit: [] });
    __publicField(this, "count", 0);
    __publicField(this, "id", Math.random());
    if (j[$]) return j[$];
    Iu(j, $, { value: this, writable: false, enumerable: false, configurable: false });
  }
  on(D, F) {
    this.listeners[D].push(F);
  }
  removeListener(D, F) {
    const e = this.listeners[D], t = e.indexOf(F);
    t !== -1 && (t === 0 && e.length === 1 ? e.length = 0 : e.splice(t, 1));
  }
  emit(D, F, e) {
    if (this.emitted[D]) return false;
    this.emitted[D] = true;
    let t = false;
    for (const i of this.listeners[D]) t = i(F, e) === true || t;
    return D === "exit" && (t = this.emit("afterExit", F, e) || t), t;
  }
}
class ou {
}
const vu = (u) => ({ onExit(D, F) {
  return u.onExit(D, F);
}, load() {
  return u.load();
}, unload() {
  return u.unload();
} });
class Ou extends ou {
  onExit() {
    return () => {
    };
  }
  load() {
  }
  unload() {
  }
}
class Pu extends ou {
  constructor(D) {
    super();
    __privateAdd(this, _Pu_instances);
    __privateAdd(this, _i2, U.platform === "win32" ? "SIGINT" : "SIGHUP");
    __privateAdd(this, _D2, new _u());
    __privateAdd(this, _u3);
    __privateAdd(this, _t2);
    __privateAdd(this, _n2);
    __privateAdd(this, _e2, {});
    __privateAdd(this, _F, false);
    __privateSet(this, _u3, D), __privateSet(this, _e2, {});
    for (const F of m) __privateGet(this, _e2)[F] = () => {
      const e = __privateGet(this, _u3).listeners(F);
      let { count: t } = __privateGet(this, _D2);
      const i = D;
      if (typeof i.__signal_exit_emitter__ == "object" && typeof i.__signal_exit_emitter__.count == "number" && (t += i.__signal_exit_emitter__.count), e.length === t) {
        this.unload();
        const r = __privateGet(this, _D2).emit("exit", null, F), n = F === "SIGHUP" ? __privateGet(this, _i2) : F;
        r || D.kill(D.pid, n);
      }
    };
    __privateSet(this, _n2, D.reallyExit), __privateSet(this, _t2, D.emit);
  }
  onExit(D, F) {
    if (!I(__privateGet(this, _u3))) return () => {
    };
    __privateGet(this, _F) === false && this.load();
    const e = (F == null ? void 0 : F.alwaysLast) ? "afterExit" : "exit";
    return __privateGet(this, _D2).on(e, D), () => {
      __privateGet(this, _D2).removeListener(e, D), __privateGet(this, _D2).listeners.exit.length === 0 && __privateGet(this, _D2).listeners.afterExit.length === 0 && this.unload();
    };
  }
  load() {
    if (!__privateGet(this, _F)) {
      __privateSet(this, _F, true), __privateGet(this, _D2).count += 1;
      for (const D of m) try {
        const F = __privateGet(this, _e2)[D];
        F && __privateGet(this, _u3).on(D, F);
      } catch {
      }
      __privateGet(this, _u3).emit = (D, ...F) => __privateMethod(this, _Pu_instances, o_fn).call(this, D, ...F), __privateGet(this, _u3).reallyExit = (D) => __privateMethod(this, _Pu_instances, r_fn).call(this, D);
    }
  }
  unload() {
    __privateGet(this, _F) && (__privateSet(this, _F, false), m.forEach((D) => {
      const F = __privateGet(this, _e2)[D];
      if (!F) throw new Error("Listener not defined for signal: " + D);
      try {
        __privateGet(this, _u3).removeListener(D, F);
      } catch {
      }
    }), __privateGet(this, _u3).emit = __privateGet(this, _t2), __privateGet(this, _u3).reallyExit = __privateGet(this, _n2), __privateGet(this, _D2).count -= 1);
  }
}
_i2 = new WeakMap();
_D2 = new WeakMap();
_u3 = new WeakMap();
_t2 = new WeakMap();
_n2 = new WeakMap();
_e2 = new WeakMap();
_F = new WeakMap();
_Pu_instances = new WeakSet();
r_fn = function(D) {
  return I(__privateGet(this, _u3)) ? (__privateGet(this, _u3).exitCode = D || 0, __privateGet(this, _D2).emit("exit", __privateGet(this, _u3).exitCode, null), __privateGet(this, _n2).call(__privateGet(this, _u3), __privateGet(this, _u3).exitCode)) : 0;
};
o_fn = function(D, ...F) {
  const e = __privateGet(this, _t2);
  if (D === "exit" && I(__privateGet(this, _u3))) {
    typeof F[0] == "number" && (__privateGet(this, _u3).exitCode = F[0]);
    const t = e.call(__privateGet(this, _u3), D, ...F);
    return __privateGet(this, _D2).emit("exit", __privateGet(this, _u3).exitCode, null), t;
  } else return e.call(__privateGet(this, _u3), D, ...F);
};
const U = globalThis.process, { onExit: Nu } = vu(I(U) ? new Pu(U) : new Ou()), Q = f.stderr.isTTY ? f.stderr : f.stdout.isTTY ? f.stdout : void 0, Wu = Q ? ru(() => {
  Nu(() => {
    Q.write("\x1B[?25h");
  }, { alwaysLast: true });
}) : () => {
};
let v = false;
const A = {};
A.show = (u = f.stderr) => {
  u.isTTY && (v = false, u.write("\x1B[?25h"));
};
A.hide = (u = f.stderr) => {
  u.isTTY && (Wu(), v = true, u.write("\x1B[?25l"));
};
A.toggle = (u, D) => {
  u !== void 0 && (v = u), v ? A.show(D) : A.hide(D);
};
function ku({ onlyFirst: u = false } = {}) {
  const t = "(?:\\u001B\\][\\s\\S]*?(?:\\u0007|\\u001B\\u005C|\\u009C))|[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]";
  return new RegExp(t, u ? void 0 : "g");
}
const $u = ku();
function Y(u) {
  if (typeof u != "string") throw new TypeError(`Expected a \`string\`, got \`${typeof u}\``);
  return u.replace($u, "");
}
const V = [161, 161, 164, 164, 167, 168, 170, 170, 173, 174, 176, 180, 182, 186, 188, 191, 198, 198, 208, 208, 215, 216, 222, 225, 230, 230, 232, 234, 236, 237, 240, 240, 242, 243, 247, 250, 252, 252, 254, 254, 257, 257, 273, 273, 275, 275, 283, 283, 294, 295, 299, 299, 305, 307, 312, 312, 319, 322, 324, 324, 328, 331, 333, 333, 338, 339, 358, 359, 363, 363, 462, 462, 464, 464, 466, 466, 468, 468, 470, 470, 472, 472, 474, 474, 476, 476, 593, 593, 609, 609, 708, 708, 711, 711, 713, 715, 717, 717, 720, 720, 728, 731, 733, 733, 735, 735, 768, 879, 913, 929, 931, 937, 945, 961, 963, 969, 1025, 1025, 1040, 1103, 1105, 1105, 8208, 8208, 8211, 8214, 8216, 8217, 8220, 8221, 8224, 8226, 8228, 8231, 8240, 8240, 8242, 8243, 8245, 8245, 8251, 8251, 8254, 8254, 8308, 8308, 8319, 8319, 8321, 8324, 8364, 8364, 8451, 8451, 8453, 8453, 8457, 8457, 8467, 8467, 8470, 8470, 8481, 8482, 8486, 8486, 8491, 8491, 8531, 8532, 8539, 8542, 8544, 8555, 8560, 8569, 8585, 8585, 8592, 8601, 8632, 8633, 8658, 8658, 8660, 8660, 8679, 8679, 8704, 8704, 8706, 8707, 8711, 8712, 8715, 8715, 8719, 8719, 8721, 8721, 8725, 8725, 8730, 8730, 8733, 8736, 8739, 8739, 8741, 8741, 8743, 8748, 8750, 8750, 8756, 8759, 8764, 8765, 8776, 8776, 8780, 8780, 8786, 8786, 8800, 8801, 8804, 8807, 8810, 8811, 8814, 8815, 8834, 8835, 8838, 8839, 8853, 8853, 8857, 8857, 8869, 8869, 8895, 8895, 8978, 8978, 9312, 9449, 9451, 9547, 9552, 9587, 9600, 9615, 9618, 9621, 9632, 9633, 9635, 9641, 9650, 9651, 9654, 9655, 9660, 9661, 9664, 9665, 9670, 9672, 9675, 9675, 9678, 9681, 9698, 9701, 9711, 9711, 9733, 9734, 9737, 9737, 9742, 9743, 9756, 9756, 9758, 9758, 9792, 9792, 9794, 9794, 9824, 9825, 9827, 9829, 9831, 9834, 9836, 9837, 9839, 9839, 9886, 9887, 9919, 9919, 9926, 9933, 9935, 9939, 9941, 9953, 9955, 9955, 9960, 9961, 9963, 9969, 9972, 9972, 9974, 9977, 9979, 9980, 9982, 9983, 10045, 10045, 10102, 10111, 11094, 11097, 12872, 12879, 57344, 63743, 65024, 65039, 65533, 65533, 127232, 127242, 127248, 127277, 127280, 127337, 127344, 127373, 127375, 127376, 127387, 127404, 917760, 917999, 983040, 1048573, 1048576, 1114109], K = [12288, 12288, 65281, 65376, 65504, 65510], N = [4352, 4447, 8986, 8987, 9001, 9002, 9193, 9196, 9200, 9200, 9203, 9203, 9725, 9726, 9748, 9749, 9776, 9783, 9800, 9811, 9855, 9855, 9866, 9871, 9875, 9875, 9889, 9889, 9898, 9899, 9917, 9918, 9924, 9925, 9934, 9934, 9940, 9940, 9962, 9962, 9970, 9971, 9973, 9973, 9978, 9978, 9981, 9981, 9989, 9989, 9994, 9995, 10024, 10024, 10060, 10060, 10062, 10062, 10067, 10069, 10071, 10071, 10133, 10135, 10160, 10160, 10175, 10175, 11035, 11036, 11088, 11088, 11093, 11093, 11904, 11929, 11931, 12019, 12032, 12245, 12272, 12287, 12289, 12350, 12353, 12438, 12441, 12543, 12549, 12591, 12593, 12686, 12688, 12773, 12783, 12830, 12832, 12871, 12880, 42124, 42128, 42182, 43360, 43388, 44032, 55203, 63744, 64255, 65040, 65049, 65072, 65106, 65108, 65126, 65128, 65131, 94176, 94180, 94192, 94198, 94208, 101589, 101631, 101662, 101760, 101874, 110576, 110579, 110581, 110587, 110589, 110590, 110592, 110882, 110898, 110898, 110928, 110930, 110933, 110933, 110948, 110951, 110960, 111355, 119552, 119638, 119648, 119670, 126980, 126980, 127183, 127183, 127374, 127374, 127377, 127386, 127488, 127490, 127504, 127547, 127552, 127560, 127568, 127569, 127584, 127589, 127744, 127776, 127789, 127797, 127799, 127868, 127870, 127891, 127904, 127946, 127951, 127955, 127968, 127984, 127988, 127988, 127992, 128062, 128064, 128064, 128066, 128252, 128255, 128317, 128331, 128334, 128336, 128359, 128378, 128378, 128405, 128406, 128420, 128420, 128507, 128591, 128640, 128709, 128716, 128716, 128720, 128722, 128725, 128728, 128732, 128735, 128747, 128748, 128756, 128764, 128992, 129003, 129008, 129008, 129292, 129338, 129340, 129349, 129351, 129535, 129648, 129660, 129664, 129674, 129678, 129734, 129736, 129736, 129741, 129756, 129759, 129770, 129775, 129784, 131072, 196605, 196608, 262141], X = (u, D) => {
  let F = 0, e = Math.floor(u.length / 2) - 1;
  for (; F <= e; ) {
    const t = Math.floor((F + e) / 2), i = t * 2;
    if (D < u[i]) e = t - 1;
    else if (D > u[i + 1]) F = t + 1;
    else return true;
  }
  return false;
}, ju = V[0], Ru = V.at(-1), Gu = K[0], Mu = K.at(-1), Lu = N[0], Uu = N.at(-1), uu = 19968, [Hu, Yu] = Vu(N);
function Vu(u) {
  let D = u[0], F = u[1];
  for (let e = 0; e < u.length; e += 2) {
    const t = u[e], i = u[e + 1];
    if (uu >= t && uu <= i) return [t, i];
    i - t > F - D && (D = t, F = i);
  }
  return [D, F];
}
const Ku = (u) => u < ju || u > Ru ? false : X(V, u), su = (u) => u < Gu || u > Mu ? false : X(K, u), Cu = (u) => u >= Hu && u <= Yu ? true : u < Lu || u > Uu ? false : X(N, u);
function Xu(u) {
  if (!Number.isSafeInteger(u)) throw new TypeError(`Expected a code point, got \`${typeof u}\`.`);
}
function Zu(u, { ambiguousAsWide: D = false } = {}) {
  return Xu(u), su(u) || Cu(u) || D && Ku(u) ? 2 : 1;
}
const zu = () => /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E-\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED8\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])|\uD83E(?:[\uDD1D\uDEEF]\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF]|[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83E(?:[\uDD1D\uDEEF]\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF]|[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83E(?:[\uDD1D\uDEEF]\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83E(?:[\uDD1D\uDEEF]\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF]|[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])|\uD83E(?:[\uDD1D\uDEEF]\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE]|[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC69\uD83C[\uDFFC-\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF]|\uDEEF\u200D\uD83D\uDC69\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC69\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF]|\uDEEF\u200D\uD83D\uDC69\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC69\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uDEEF\u200D\uD83D\uDC69\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC69\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF]|\uDEEF\u200D\uD83D\uDC69\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83D\uDC69\uD83C[\uDFFB-\uDFFE])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE]|\uDEEF\u200D\uD83D\uDC69\uD83C[\uDFFB-\uDFFE])))?))?|\uDD75(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3C-\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE8A\uDE8E-\uDEC2\uDEC6\uDEC8\uDECD-\uDEDC\uDEDF-\uDEEA\uDEEF]|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3\uDE70]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3\uDE70]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF]|\uDEEF\u200D\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3\uDE70]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF]|\uDEEF\u200D\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3\uDE70]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF]|\uDEEF\u200D\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3\uDE70]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF]|\uDEEF\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC30\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE])|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3\uDE70]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF]|\uDEEF\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g, qu = new Intl.Segmenter(), Ju = new RegExp("^\\p{Default_Ignorable_Code_Point}$", "u");
function w(u, D = {}) {
  if (typeof u != "string" || u.length === 0) return 0;
  const { ambiguousIsNarrow: F = true, countAnsiEscapeCodes: e = false } = D;
  if (e || (u = Y(u)), u.length === 0) return 0;
  let t = 0;
  const i = { ambiguousAsWide: !F };
  for (const { segment: r } of qu.segment(u)) {
    const n = r.codePointAt(0);
    if (!(n <= 31 || n >= 127 && n <= 159) && !(n >= 8203 && n <= 8207 || n === 65279) && !(n >= 768 && n <= 879 || n >= 6832 && n <= 6911 || n >= 7616 && n <= 7679 || n >= 8400 && n <= 8447 || n >= 65056 && n <= 65071) && !(n >= 55296 && n <= 57343) && !(n >= 65024 && n <= 65039) && !Ju.test(r)) {
      if (zu().test(r)) {
        t += 2;
        continue;
      }
      t += Zu(n, i);
    }
  }
  return t;
}
const R = 10, Du = (u = 0) => (D) => `\x1B[${D + u}m`, Fu = (u = 0) => (D) => `\x1B[${38 + u};5;${D}m`, eu = (u = 0) => (D, F, e) => `\x1B[${38 + u};2;${D};${F};${e}m`, E = { modifier: { reset: [0, 0], bold: [1, 22], dim: [2, 22], italic: [3, 23], underline: [4, 24], overline: [53, 55], inverse: [7, 27], hidden: [8, 28], strikethrough: [9, 29] }, color: { black: [30, 39], red: [31, 39], green: [32, 39], yellow: [33, 39], blue: [34, 39], magenta: [35, 39], cyan: [36, 39], white: [37, 39], blackBright: [90, 39], gray: [90, 39], grey: [90, 39], redBright: [91, 39], greenBright: [92, 39], yellowBright: [93, 39], blueBright: [94, 39], magentaBright: [95, 39], cyanBright: [96, 39], whiteBright: [97, 39] }, bgColor: { bgBlack: [40, 49], bgRed: [41, 49], bgGreen: [42, 49], bgYellow: [43, 49], bgBlue: [44, 49], bgMagenta: [45, 49], bgCyan: [46, 49], bgWhite: [47, 49], bgBlackBright: [100, 49], bgGray: [100, 49], bgGrey: [100, 49], bgRedBright: [101, 49], bgGreenBright: [102, 49], bgYellowBright: [103, 49], bgBlueBright: [104, 49], bgMagentaBright: [105, 49], bgCyanBright: [106, 49], bgWhiteBright: [107, 49] } };
Object.keys(E.modifier);
const Qu = Object.keys(E.color), uD = Object.keys(E.bgColor);
[...Qu, ...uD];
function DD() {
  const u = /* @__PURE__ */ new Map();
  for (const [D, F] of Object.entries(E)) {
    for (const [e, t] of Object.entries(F)) E[e] = { open: `\x1B[${t[0]}m`, close: `\x1B[${t[1]}m` }, F[e] = E[e], u.set(t[0], t[1]);
    Object.defineProperty(E, D, { value: F, enumerable: false });
  }
  return Object.defineProperty(E, "codes", { value: u, enumerable: false }), E.color.close = "\x1B[39m", E.bgColor.close = "\x1B[49m", E.color.ansi = Du(), E.color.ansi256 = Fu(), E.color.ansi16m = eu(), E.bgColor.ansi = Du(R), E.bgColor.ansi256 = Fu(R), E.bgColor.ansi16m = eu(R), Object.defineProperties(E, { rgbToAnsi256: { value(D, F, e) {
    return D === F && F === e ? D < 8 ? 16 : D > 248 ? 231 : Math.round((D - 8) / 247 * 24) + 232 : 16 + 36 * Math.round(D / 255 * 5) + 6 * Math.round(F / 255 * 5) + Math.round(e / 255 * 5);
  }, enumerable: false }, hexToRgb: { value(D) {
    const F = /[a-f\d]{6}|[a-f\d]{3}/i.exec(D.toString(16));
    if (!F) return [0, 0, 0];
    let [e] = F;
    e.length === 3 && (e = [...e].map((i) => i + i).join(""));
    const t = Number.parseInt(e, 16);
    return [t >> 16 & 255, t >> 8 & 255, t & 255];
  }, enumerable: false }, hexToAnsi256: { value: (D) => E.rgbToAnsi256(...E.hexToRgb(D)), enumerable: false }, ansi256ToAnsi: { value(D) {
    if (D < 8) return 30 + D;
    if (D < 16) return 90 + (D - 8);
    let F, e, t;
    if (D >= 232) F = ((D - 232) * 10 + 8) / 255, e = F, t = F;
    else {
      D -= 16;
      const n = D % 36;
      F = Math.floor(D / 36) / 5, e = Math.floor(n / 6) / 5, t = n % 6 / 5;
    }
    const i = Math.max(F, e, t) * 2;
    if (i === 0) return 30;
    let r = 30 + (Math.round(t) << 2 | Math.round(e) << 1 | Math.round(F));
    return i === 2 && (r += 60), r;
  }, enumerable: false }, rgbToAnsi: { value: (D, F, e) => E.ansi256ToAnsi(E.rgbToAnsi256(D, F, e)), enumerable: false }, hexToAnsi: { value: (D) => E.ansi256ToAnsi(E.hexToAnsi256(D)), enumerable: false } }), E;
}
const h = DD(), W = /* @__PURE__ */ new Set(["\x1B", "\x9B"]), FD = 39, Z = "\x07", Eu = "[", eD = "]", lu = "m", O = `${eD}8;;`, tu = (u) => `${W.values().next().value}${Eu}${u}${lu}`, nu = (u) => `${W.values().next().value}${O}${u}${Z}`, tD = (u) => u.split(" ").map((D) => w(D)), G = (u, D, F) => {
  const e = [...D];
  let t = false, i = false, r = w(Y(u.at(-1)));
  for (const [n, o] of e.entries()) {
    const B = w(o);
    if (r + B <= F ? u[u.length - 1] += o : (u.push(o), r = 0), W.has(o) && (t = true, i = e.slice(n + 1, n + 1 + O.length).join("") === O), t) {
      i ? o === Z && (t = false, i = false) : o === lu && (t = false);
      continue;
    }
    r += B, r === F && n < e.length - 1 && (u.push(""), r = 0);
  }
  !r && u.at(-1).length > 0 && u.length > 1 && (u[u.length - 2] += u.pop());
}, nD = (u) => {
  const D = u.split(" ");
  let F = D.length;
  for (; F > 0 && !(w(D[F - 1]) > 0); ) F--;
  return F === D.length ? u : D.slice(0, F).join(" ") + D.slice(F).join("");
}, iD = (u, D, F = {}) => {
  if (F.trim !== false && u.trim() === "") return "";
  let e = "", t, i;
  const r = tD(u);
  let n = [""];
  for (const [a, l] of u.split(" ").entries()) {
    F.trim !== false && (n[n.length - 1] = n.at(-1).trimStart());
    let s = w(n.at(-1));
    if (a !== 0 && (s >= D && (F.wordWrap === false || F.trim === false) && (n.push(""), s = 0), (s > 0 || F.trim === false) && (n[n.length - 1] += " ", s++)), F.hard && r[a] > D) {
      const C = D - s, c = 1 + Math.floor((r[a] - C - 1) / D);
      Math.floor((r[a] - 1) / D) < c && n.push(""), G(n, l, D);
      continue;
    }
    if (s + r[a] > D && s > 0 && r[a] > 0) {
      if (F.wordWrap === false && s < D) {
        G(n, l, D);
        continue;
      }
      n.push("");
    }
    if (s + r[a] > D && F.wordWrap === false) {
      G(n, l, D);
      continue;
    }
    n[n.length - 1] += l;
  }
  F.trim !== false && (n = n.map((a) => nD(a)));
  const o = n.join(`
`), B = [...o];
  let d = 0;
  for (const [a, l] of B.entries()) {
    if (e += l, W.has(l)) {
      const { groups: C } = new RegExp(`(?:\\${Eu}(?<code>\\d+)m|\\${O}(?<uri>.*)${Z})`).exec(o.slice(d)) || { groups: {} };
      if (C.code !== void 0) {
        const c = Number.parseFloat(C.code);
        t = c === FD ? void 0 : c;
      } else C.uri !== void 0 && (i = C.uri.length === 0 ? void 0 : C.uri);
    }
    const s = h.codes.get(Number(t));
    B[a + 1] === `
` ? (i && (e += nu("")), t && s && (e += tu(s))) : l === `
` && (t && s && (e += tu(t)), i && (e += nu(i))), d += l.length;
  }
  return e;
};
function rD(u, D, F) {
  return String(u).normalize().replaceAll(`\r
`, `
`).split(`
`).map((e) => iD(e, D, F)).join(`
`);
}
function oD(u) {
  return Number.isInteger(u) ? su(u) || Cu(u) : false;
}
const sD = /* @__PURE__ */ new Set([27, 155]), CD = "0".codePointAt(0), ED = "9".codePointAt(0), lD = 19, z = /* @__PURE__ */ new Set(), H = /* @__PURE__ */ new Map();
for (const [u, D] of h.codes) z.add(h.color.ansi(D)), H.set(h.color.ansi(u), h.color.ansi(D));
function aD(u) {
  if (z.has(u)) return u;
  if (H.has(u)) return H.get(u);
  u = u.slice(2), u.includes(";") && (u = u[0] + "0");
  const D = h.codes.get(Number.parseInt(u, 10));
  return D ? h.color.ansi(D) : h.reset.open;
}
function cD(u) {
  for (let D = 0; D < u.length; D++) {
    const F = u.codePointAt(D);
    if (F >= CD && F <= ED) return D;
  }
  return -1;
}
function BD(u, D) {
  u = u.slice(D, D + lD);
  const F = cD(u);
  if (F !== -1) {
    let e = u.indexOf("m", F);
    return e === -1 && (e = u.length), u.slice(0, e + 1);
  }
}
function fD(u, D = Number.POSITIVE_INFINITY) {
  const F = [];
  let e = 0, t = 0;
  for (; e < u.length; ) {
    const i = u.codePointAt(e);
    if (sD.has(i)) {
      const o = BD(u, e);
      if (o) {
        F.push({ type: "ansi", code: o, endCode: aD(o) }), e += o.length;
        continue;
      }
    }
    const r = oD(i), n = String.fromCodePoint(i);
    if (F.push({ type: "character", value: n, isFullWidth: r }), e += n.length, t += r ? 2 : n.length, t >= D) break;
  }
  return F;
}
function au(u) {
  let D = [];
  for (const F of u) F.code === h.reset.open ? D = [] : z.has(F.code) ? D = D.filter((e) => e.endCode !== F.code) : (D = D.filter((e) => e.endCode !== F.endCode), D.push(F));
  return D;
}
function dD(u) {
  return au(u).map(({ endCode: e }) => e).reverse().join("");
}
function hD(u, D, F) {
  const e = fD(u, F);
  let t = [], i = 0, r = "", n = false;
  for (const o of e) o.type === "ansi" ? (t.push(o), n && (r += o.code)) : (!n && i >= D && (n = true, t = au(t), r = t.map(({ code: B }) => B).join("")), n && (r += o.value), i += o.isFullWidth ? 2 : o.value.length);
  return r += dD(t), r;
}
const y = (u, D) => u.columns ?? D ?? 80, gD = "\x1B[?2026h", AD = "\x1B[?2026l", pD = (u, D, F) => {
  const e = u.rows ?? F ?? 24;
  if (e === void 0) return { text: D, wasClipped: false };
  if (e === 0) return { text: "", wasClipped: D !== "" };
  const t = Y(D), r = [...t].filter((d) => d === `
`).length + 1, n = Math.max(0, r - e);
  if (n === 0) return { text: D, wasClipped: false };
  let o = 0, B = 0;
  for (const [d, a] of [...t].entries()) if (a === `
` && (o++, o === n)) {
    B = d + 1;
    break;
  }
  return { text: hD(D, B), wasClipped: true };
}, mD = (u, D) => {
  let F = 0;
  for (; F < u.length && F < D.length && u[F] === D[F]; F++) ;
  let e = u.length - 1, t = D.length - 1;
  for (; e >= F && t >= F && u[e] === D[t]; ) e--, t--;
  return { start: F, endPrevious: e, endNext: t };
}, bD = ({ prevCount: u, start: D, endPrevious: F, endNext: e, nextLines: t, nextWrappedEndsWithNewline: i }) => {
  let r = "";
  const n = Math.max(0, u - 1 - D);
  n > 0 && (r += M(n)), r += L;
  const o = Math.max(0, F - D + 1);
  for (let s = 0; s < o; s++) r += iu, s < o - 1 && (r += q());
  o > 1 && (r += M(o - 1)), r += L;
  const B = t.slice(D, e + 1);
  if (B.length > 0) {
    const s = B.join(`
`);
    r += s, r += gu, i && !s.endsWith(`
`) && (r += `
`);
  }
  const d = D + B.length, l = t.length - 1 - d;
  return l > 0 && (r += q(l)), r;
};
function cu(u, { showCursor: D = false, defaultWidth: F, defaultHeight: e } = {}) {
  let t = 0, i = y(u, F), r = "";
  const n = u.isTTY === true, o = (l) => {
    if (l !== "") {
      if (n) {
        u.write(gD + l + AD);
        return;
      }
      u.write(l);
    }
  }, B = (l, s) => {
    const C = String(l), c = C.endsWith(`
`) ? C : `${C}
`, p = rD(c, s, { trim: false, hard: true, wordWrap: false }), { text: b, wasClipped: x } = pD(u, p, e), k = b === "" ? [] : b.split(`
`);
    return { wrapped: b, lines: k, wasClipped: x };
  }, d = () => {
    r = "", i = y(u, F), t = 0;
  }, a = (...l) => {
    D || A.hide();
    const s = y(u, F), { wrapped: C, lines: c, wasClipped: p } = B(l.join(" "), s);
    if (c.length === 0) {
      r = C, i = s, t = 0;
      return;
    }
    if (C === r && i === s) return;
    if (t === 0) {
      o(C), r = C, i = s, t = c.length;
      return;
    }
    if (i !== s || p) {
      o(T(t) + C), r = C, i = s, t = c.length;
      return;
    }
    const b = r === "" ? [] : r.split(`
`), { start: x, endPrevious: k, endNext: Bu } = mD(b, c);
    if (x === c.length && t === c.length) return;
    if (x === 0) {
      o(T(t) + C), r = C, i = s, t = c.length;
      return;
    }
    const fu = bD({ prevCount: t, start: x, endPrevious: k, endNext: Bu, nextLines: c, nextWrappedEndsWithNewline: C.endsWith(`
`) });
    o(fu), r = C, i = s, t = c.length;
  };
  return a.clear = () => {
    o(T(t)), d();
  }, a.done = () => {
    d(), D || A.show();
  }, a.persist = (...l) => {
    const s = t > 0 ? T(t) : "";
    t > 0 && (t = 0);
    const C = `${l.join(" ")}`, c = y(u, F), { wrapped: p } = B(C, c);
    o(s + p), d();
  }, a;
}
const TD = cu(f.stdout), yD = cu(f.stderr);
export {
  cu as createLogUpdate,
  TD as default,
  yD as logUpdateStderr
};
