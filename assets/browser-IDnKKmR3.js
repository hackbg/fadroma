import { g as s } from "./index-CtQ99MjB.js";
function c(n, i) {
  for (var o = 0; o < i.length; o++) {
    const e = i[o];
    if (typeof e != "string" && !Array.isArray(e)) {
      for (const t in e) if (t !== "default" && !(t in n)) {
        const u = Object.getOwnPropertyDescriptor(e, t);
        u && Object.defineProperty(n, t, u.get ? u : { enumerable: true, get: () => e[t] });
      }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
var r = {}, f;
function p() {
  return f || (f = 1, r.endianness = function() {
    return "LE";
  }, r.hostname = function() {
    return typeof location < "u" ? location.hostname : "";
  }, r.loadavg = function() {
    return [];
  }, r.uptime = function() {
    return 0;
  }, r.freemem = function() {
    return Number.MAX_VALUE;
  }, r.totalmem = function() {
    return Number.MAX_VALUE;
  }, r.cpus = function() {
    return [];
  }, r.type = function() {
    return "Browser";
  }, r.release = function() {
    return typeof navigator < "u" ? navigator.appVersion : "";
  }, r.networkInterfaces = r.getNetworkInterfaces = function() {
    return {};
  }, r.arch = function() {
    return "javascript";
  }, r.platform = function() {
    return "browser";
  }, r.tmpdir = r.tmpDir = function() {
    return "/tmp";
  }, r.EOL = `
`, r.homedir = function() {
    return "/";
  }), r;
}
var a = p();
const m = s(a), d = c({ __proto__: null, default: m }, [a]);
export {
  d as b,
  m as o
};
