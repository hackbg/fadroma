function v(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var m = { exports: {} }, t = m.exports = {}, n, o;
function f() {
  throw new Error("setTimeout has not been defined");
}
function h() {
  throw new Error("clearTimeout has not been defined");
}
(function() {
  try {
    typeof setTimeout == "function" ? n = setTimeout : n = f;
  } catch {
    n = f;
  }
  try {
    typeof clearTimeout == "function" ? o = clearTimeout : o = h;
  } catch {
    o = h;
  }
})();
function p(e) {
  if (n === setTimeout) return setTimeout(e, 0);
  if ((n === f || !n) && setTimeout) return n = setTimeout, setTimeout(e, 0);
  try {
    return n(e, 0);
  } catch {
    try {
      return n.call(null, e, 0);
    } catch {
      return n.call(this, e, 0);
    }
  }
}
function g(e) {
  if (o === clearTimeout) return clearTimeout(e);
  if ((o === h || !o) && clearTimeout) return o = clearTimeout, clearTimeout(e);
  try {
    return o(e);
  } catch {
    try {
      return o.call(null, e);
    } catch {
      return o.call(this, e);
    }
  }
}
var u = [], c = false, s, l = -1;
function w() {
  !c || !s || (c = false, s.length ? u = s.concat(u) : l = -1, u.length && d());
}
function d() {
  if (!c) {
    var e = p(w);
    c = true;
    for (var r = u.length; r; ) {
      for (s = u, u = []; ++l < r; ) s && s[l].run();
      l = -1, r = u.length;
    }
    s = null, c = false, g(e);
  }
}
t.nextTick = function(e) {
  var r = new Array(arguments.length - 1);
  if (arguments.length > 1) for (var a = 1; a < arguments.length; a++) r[a - 1] = arguments[a];
  u.push(new T(e, r)), u.length === 1 && !c && p(d);
};
function T(e, r) {
  this.fun = e, this.array = r;
}
T.prototype.run = function() {
  this.fun.apply(null, this.array);
};
t.title = "browser";
t.browser = true;
t.env = {};
t.argv = [];
t.version = "";
t.versions = {};
function i() {
}
t.on = i;
t.addListener = i;
t.once = i;
t.off = i;
t.removeListener = i;
t.removeAllListeners = i;
t.emit = i;
t.prependListener = i;
t.prependOnceListener = i;
t.listeners = function(e) {
  return [];
};
t.binding = function(e) {
  throw new Error("process.binding is not supported");
};
t.cwd = function() {
  return "/";
};
t.chdir = function(e) {
  throw new Error("process.chdir is not supported");
};
t.umask = function() {
  return 0;
};
var y = m.exports;
const b = v(y);
export {
  b as default,
  b as process
};
