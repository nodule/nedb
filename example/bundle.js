require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("z02cDi"))
},{"z02cDi":4}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],5:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],6:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("z02cDi"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":5,"inherits":2,"z02cDi":4}],7:[function(require,module,exports){
module.exports.BinarySearchTree = require('./lib/bst');
module.exports.AVLTree = require('./lib/avltree');

},{"./lib/avltree":8,"./lib/bst":9}],8:[function(require,module,exports){
/**
 * Self-balancing binary search tree using the AVL implementation
 */
var BinarySearchTree = require('./bst')
  , customUtils = require('./customUtils')
  , util = require('util')
  , _ = require('underscore')
  ;


/**
 * Constructor
 * We can't use a direct pointer to the root node (as in the simple binary search tree)
 * as the root will change during tree rotations
 * @param {Boolean}  options.unique Whether to enforce a 'unique' constraint on the key or not
 * @param {Function} options.compareKeys Initialize this BST's compareKeys
 */
function AVLTree (options) {
  this.tree = new _AVLTree(options);
}


/**
 * Constructor of the internal AVLTree
 * @param {Object} options Optional
 * @param {Boolean}  options.unique Whether to enforce a 'unique' constraint on the key or not
 * @param {Key}      options.key Initialize this BST's key with key
 * @param {Value}    options.value Initialize this BST's data with [value]
 * @param {Function} options.compareKeys Initialize this BST's compareKeys
 */
function _AVLTree (options) {
  options = options || {};

  this.left = null;
  this.right = null;
  this.parent = options.parent !== undefined ? options.parent : null;
  if (options.hasOwnProperty('key')) { this.key = options.key; }
  this.data = options.hasOwnProperty('value') ? [options.value] : [];
  this.unique = options.unique || false;

  this.compareKeys = options.compareKeys || customUtils.defaultCompareKeysFunction;
  this.checkValueEquality = options.checkValueEquality || customUtils.defaultCheckValueEquality;
}


/**
 * Inherit basic functions from the basic binary search tree
 */
util.inherits(_AVLTree, BinarySearchTree);

/**
 * Keep a pointer to the internal tree constructor for testing purposes
 */
AVLTree._AVLTree = _AVLTree;


/**
 * Check the recorded height is correct for every node
 * Throws if one height doesn't match
 */
_AVLTree.prototype.checkHeightCorrect = function () {
  var leftH, rightH;

  if (!this.hasOwnProperty('key')) { return; }   // Empty tree

  if (this.left && this.left.height === undefined) { throw "Undefined height for node " + this.left.key; }
  if (this.right && this.right.height === undefined) { throw "Undefined height for node " + this.right.key; }
  if (this.height === undefined) { throw "Undefined height for node " + this.key; }

  leftH = this.left ? this.left.height : 0;
  rightH = this.right ? this.right.height : 0;

  if (this.height !== 1 + Math.max(leftH, rightH)) { throw "Height constraint failed for node " + this.key; }
  if (this.left) { this.left.checkHeightCorrect(); }
  if (this.right) { this.right.checkHeightCorrect(); }
};


/**
 * Return the balance factor
 */
_AVLTree.prototype.balanceFactor = function () {
  var leftH = this.left ? this.left.height : 0
    , rightH = this.right ? this.right.height : 0
    ;
  return leftH - rightH;
};


/**
 * Check that the balance factors are all between -1 and 1
 */
_AVLTree.prototype.checkBalanceFactors = function () {
  if (Math.abs(this.balanceFactor()) > 1) { throw 'Tree is unbalanced at node ' + this.key; }

  if (this.left) { this.left.checkBalanceFactors(); }
  if (this.right) { this.right.checkBalanceFactors(); }
};


/**
 * When checking if the BST conditions are met, also check that the heights are correct
 * and the tree is balanced
 */
_AVLTree.prototype.checkIsAVLT = function () {
  _AVLTree.super_.prototype.checkIsBST.call(this);
  this.checkHeightCorrect();
  this.checkBalanceFactors();
};
AVLTree.prototype.checkIsAVLT = function () { this.tree.checkIsAVLT(); };


/**
 * Perform a right rotation of the tree if possible
 * and return the root of the resulting tree
 * The resulting tree's nodes' heights are also updated
 */
_AVLTree.prototype.rightRotation = function () {
  var q = this
    , p = this.left
    , b
    , ah, bh, ch;

  if (!p) { return this; }   // No change

  b = p.right;

  // Alter tree structure
  if (q.parent) {
    p.parent = q.parent;
    if (q.parent.left === q) { q.parent.left = p; } else { q.parent.right = p; }
  } else {
    p.parent = null;
  }
  p.right = q;
  q.parent = p;
  q.left = b;
  if (b) { b.parent = q; }

  // Update heights
  ah = p.left ? p.left.height : 0;
  bh = b ? b.height : 0;
  ch = q.right ? q.right.height : 0;
  q.height = Math.max(bh, ch) + 1;
  p.height = Math.max(ah, q.height) + 1;

  return p;
};


/**
 * Perform a left rotation of the tree if possible
 * and return the root of the resulting tree
 * The resulting tree's nodes' heights are also updated
 */
_AVLTree.prototype.leftRotation = function () {
  var p = this
    , q = this.right
    , b
    , ah, bh, ch;

  if (!q) { return this; }   // No change

  b = q.left;

  // Alter tree structure
  if (p.parent) {
    q.parent = p.parent;
    if (p.parent.left === p) { p.parent.left = q; } else { p.parent.right = q; }
  } else {
    q.parent = null;
  }
  q.left = p;
  p.parent = q;
  p.right = b;
  if (b) { b.parent = p; }

  // Update heights
  ah = p.left ? p.left.height : 0;
  bh = b ? b.height : 0;
  ch = q.right ? q.right.height : 0;
  p.height = Math.max(ah, bh) + 1;
  q.height = Math.max(ch, p.height) + 1;

  return q;
};


/**
 * Modify the tree if its right subtree is too small compared to the left
 * Return the new root if any
 */
_AVLTree.prototype.rightTooSmall = function () {
  if (this.balanceFactor() <= 1) { return this; }   // Right is not too small, don't change

  if (this.left.balanceFactor() < 0) {
    this.left.leftRotation();
  }

  return this.rightRotation();
};


/**
 * Modify the tree if its left subtree is too small compared to the right
 * Return the new root if any
 */
_AVLTree.prototype.leftTooSmall = function () {
  if (this.balanceFactor() >= -1) { return this; }   // Left is not too small, don't change

  if (this.right.balanceFactor() > 0) {
    this.right.rightRotation();
  }

  return this.leftRotation();
};


/**
 * Rebalance the tree along the given path. The path is given reversed (as he was calculated
 * in the insert and delete functions).
 * Returns the new root of the tree
 * Of course, the first element of the path must be the root of the tree
 */
_AVLTree.prototype.rebalanceAlongPath = function (path) {
  var newRoot = this
    , rotated
    , i;

  if (!this.hasOwnProperty('key')) { delete this.height; return this; }   // Empty tree

  // Rebalance the tree and update all heights
  for (i = path.length - 1; i >= 0; i -= 1) {
    path[i].height = 1 + Math.max(path[i].left ? path[i].left.height : 0, path[i].right ? path[i].right.height : 0);

    if (path[i].balanceFactor() > 1) {
      rotated = path[i].rightTooSmall();
      if (i === 0) { newRoot = rotated; }
    }

    if (path[i].balanceFactor() < -1) {
      rotated = path[i].leftTooSmall();
      if (i === 0) { newRoot = rotated; }
    }
  }

  return newRoot;
};


/**
 * Insert a key, value pair in the tree while maintaining the AVL tree height constraint
 * Return a pointer to the root node, which may have changed
 */
_AVLTree.prototype.insert = function (key, value) {
  var insertPath = []
    , currentNode = this
    ;

  // Empty tree, insert as root
  if (!this.hasOwnProperty('key')) {
    this.key = key;
    this.data.push(value);
    this.height = 1;
    return this;
  }

  // Insert new leaf at the right place
  while (true) {
    // Same key: no change in the tree structure
    if (currentNode.compareKeys(currentNode.key, key) === 0) {
      if (currentNode.unique) {
        throw { message: "Can't insert key " + key + ", it violates the unique constraint"
              , key: key
              , errorType: 'uniqueViolated'
              };
      } else {
        currentNode.data.push(value);
      }
      return this;
    }

    insertPath.push(currentNode);

    if (currentNode.compareKeys(key, currentNode.key) < 0) {
      if (!currentNode.left) {
        insertPath.push(currentNode.createLeftChild({ key: key, value: value }));
        break;
      } else {
        currentNode = currentNode.left;
      }
    } else {
      if (!currentNode.right) {
        insertPath.push(currentNode.createRightChild({ key: key, value: value }));
        break;
      } else {
        currentNode = currentNode.right;
      }
    }
  }

  return this.rebalanceAlongPath(insertPath);
};

// Insert in the internal tree, update the pointer to the root if needed
AVLTree.prototype.insert = function (key, value) {
  var newTree = this.tree.insert(key, value);

  // If newTree is undefined, that means its structure was not modified
  if (newTree) { this.tree = newTree; }
};


/**
 * Delete a key or just a value and return the new root of the tree
 * @param {Key} key
 * @param {Value} value Optional. If not set, the whole key is deleted. If set, only this value is deleted
 */
_AVLTree.prototype.delete = function (key, value) {
  var newData = [], replaceWith
    , self = this
    , currentNode = this
    , deletePath = []
    ;

  if (!this.hasOwnProperty('key')) { return this; }   // Empty tree

  // Either no match is found and the function will return from within the loop
  // Or a match is found and deletePath will contain the path from the root to the node to delete after the loop
  while (true) {
    if (currentNode.compareKeys(key, currentNode.key) === 0) { break; }

    deletePath.push(currentNode);

    if (currentNode.compareKeys(key, currentNode.key) < 0) {
      if (currentNode.left) {
        currentNode = currentNode.left;
      } else {
        return this;   // Key not found, no modification
      }
    } else {
      // currentNode.compareKeys(key, currentNode.key) is > 0
      if (currentNode.right) {
        currentNode = currentNode.right;
      } else {
        return this;   // Key not found, no modification
      }
    }
  }

  // Delete only a value (no tree modification)
  if (currentNode.data.length > 1 && value) {
    currentNode.data.forEach(function (d) {
      if (!currentNode.checkValueEquality(d, value)) { newData.push(d); }
    });
    currentNode.data = newData;
    return this;
  }

  // Delete a whole node

  // Leaf
  if (!currentNode.left && !currentNode.right) {
    if (currentNode === this) {   // This leaf is also the root
      delete currentNode.key;
      currentNode.data = [];
      delete currentNode.height;
      return this;
    } else {
      if (currentNode.parent.left === currentNode) {
        currentNode.parent.left = null;
      } else {
        currentNode.parent.right = null;
      }
      return this.rebalanceAlongPath(deletePath);
    }
  }


  // Node with only one child
  if (!currentNode.left || !currentNode.right) {
    replaceWith = currentNode.left ? currentNode.left : currentNode.right;

    if (currentNode === this) {   // This node is also the root
      replaceWith.parent = null;
      return replaceWith;   // height of replaceWith is necessarily 1 because the tree was balanced before deletion
    } else {
      if (currentNode.parent.left === currentNode) {
        currentNode.parent.left = replaceWith;
        replaceWith.parent = currentNode.parent;
      } else {
        currentNode.parent.right = replaceWith;
        replaceWith.parent = currentNode.parent;
      }

      return this.rebalanceAlongPath(deletePath);
    }
  }


  // Node with two children
  // Use the in-order predecessor (no need to randomize since we actively rebalance)
  deletePath.push(currentNode);
  replaceWith = currentNode.left;

  // Special case: the in-order predecessor is right below the node to delete
  if (!replaceWith.right) {
    currentNode.key = replaceWith.key;
    currentNode.data = replaceWith.data;
    currentNode.left = replaceWith.left;
    if (replaceWith.left) { replaceWith.left.parent = currentNode; }
    return this.rebalanceAlongPath(deletePath);
  }

  // After this loop, replaceWith is the right-most leaf in the left subtree
  // and deletePath the path from the root (inclusive) to replaceWith (exclusive)
  while (true) {
    if (replaceWith.right) {
      deletePath.push(replaceWith);
      replaceWith = replaceWith.right;
    } else {
      break;
    }
  }

  currentNode.key = replaceWith.key;
  currentNode.data = replaceWith.data;

  replaceWith.parent.right = replaceWith.left;
  if (replaceWith.left) { replaceWith.left.parent = replaceWith.parent; }

  return this.rebalanceAlongPath(deletePath);
};

// Delete a value
AVLTree.prototype.delete = function (key, value) {
  var newTree = this.tree.delete(key, value);

  // If newTree is undefined, that means its structure was not modified
  if (newTree) { this.tree = newTree; }
};


/**
 * Other functions we want to use on an AVLTree as if it were the internal _AVLTree
 */
['getNumberOfKeys', 'search', 'betweenBounds', 'prettyPrint', 'executeOnEveryNode'].forEach(function (fn) {
  AVLTree.prototype[fn] = function () {
    return this.tree[fn].apply(this.tree, arguments);
  };
});


// Interface
module.exports = AVLTree;

},{"./bst":9,"./customUtils":10,"underscore":85,"util":6}],9:[function(require,module,exports){
/**
 * Simple binary search tree
 */
var customUtils = require('./customUtils');


/**
 * Constructor
 * @param {Object} options Optional
 * @param {Boolean}  options.unique Whether to enforce a 'unique' constraint on the key or not
 * @param {Key}      options.key Initialize this BST's key with key
 * @param {Value}    options.value Initialize this BST's data with [value]
 * @param {Function} options.compareKeys Initialize this BST's compareKeys
 */
function BinarySearchTree (options) {
  options = options || {};

  this.left = null;
  this.right = null;
  this.parent = options.parent !== undefined ? options.parent : null;
  if (options.hasOwnProperty('key')) { this.key = options.key; }
  this.data = options.hasOwnProperty('value') ? [options.value] : [];
  this.unique = options.unique || false;

  this.compareKeys = options.compareKeys || customUtils.defaultCompareKeysFunction;
  this.checkValueEquality = options.checkValueEquality || customUtils.defaultCheckValueEquality;
}


// ================================
// Methods used to test the tree
// ================================


/**
 * Get the descendant with max key
 */
BinarySearchTree.prototype.getMaxKeyDescendant = function () {
  if (this.right) {
    return this.right.getMaxKeyDescendant();
  } else {
    return this;
  }
};


/**
 * Get the maximum key
 */
BinarySearchTree.prototype.getMaxKey = function () {
  return this.getMaxKeyDescendant().key;
};


/**
 * Get the descendant with min key
 */
BinarySearchTree.prototype.getMinKeyDescendant = function () {
  if (this.left) {
    return this.left.getMinKeyDescendant()
  } else {
    return this;
  }
};


/**
 * Get the minimum key
 */
BinarySearchTree.prototype.getMinKey = function () {
  return this.getMinKeyDescendant().key;
};


/**
 * Check that all nodes (incl. leaves) fullfil condition given by fn
 * test is a function passed every (key, data) and which throws if the condition is not met
 */
BinarySearchTree.prototype.checkAllNodesFullfillCondition = function (test) {
  if (!this.hasOwnProperty('key')) { return; }

  test(this.key, this.data);
  if (this.left) { this.left.checkAllNodesFullfillCondition(test); }
  if (this.right) { this.right.checkAllNodesFullfillCondition(test); }
};


/**
 * Check that the core BST properties on node ordering are verified
 * Throw if they aren't
 */
BinarySearchTree.prototype.checkNodeOrdering = function () {
  var self = this;

  if (!this.hasOwnProperty('key')) { return; }

  if (this.left) {
    this.left.checkAllNodesFullfillCondition(function (k) {
      if (self.compareKeys(k, self.key) >= 0) {
        throw 'Tree with root ' + self.key + ' is not a binary search tree';
      }
    });
    this.left.checkNodeOrdering();
  }

  if (this.right) {
    this.right.checkAllNodesFullfillCondition(function (k) {
      if (self.compareKeys(k, self.key) <= 0) {
        throw 'Tree with root ' + self.key + ' is not a binary search tree';
      }
    });
    this.right.checkNodeOrdering();
  }
};


/**
 * Check that all pointers are coherent in this tree
 */
BinarySearchTree.prototype.checkInternalPointers = function () {
  if (this.left) {
    if (this.left.parent !== this) { throw 'Parent pointer broken for key ' + this.key; }
    this.left.checkInternalPointers();
  }

  if (this.right) {
    if (this.right.parent !== this) { throw 'Parent pointer broken for key ' + this.key; }
    this.right.checkInternalPointers();
  }
};


/**
 * Check that a tree is a BST as defined here (node ordering and pointer references)
 */
BinarySearchTree.prototype.checkIsBST = function () {
  this.checkNodeOrdering();
  this.checkInternalPointers();
  if (this.parent) { throw "The root shouldn't have a parent"; }
};


/**
 * Get number of keys inserted
 */
BinarySearchTree.prototype.getNumberOfKeys = function () {
  var res;

  if (!this.hasOwnProperty('key')) { return 0; }

  res = 1;
  if (this.left) { res += this.left.getNumberOfKeys(); }
  if (this.right) { res += this.right.getNumberOfKeys(); }

  return res;
};



// ============================================
// Methods used to actually work on the tree
// ============================================

/**
 * Create a BST similar (i.e. same options except for key and value) to the current one
 * Use the same constructor (i.e. BinarySearchTree, AVLTree etc)
 * @param {Object} options see constructor
 */
BinarySearchTree.prototype.createSimilar = function (options) {
  options = options || {};
  options.unique = this.unique;
  options.compareKeys = this.compareKeys;
  options.checkValueEquality = this.checkValueEquality;

  return new this.constructor(options);
};


/**
 * Create the left child of this BST and return it
 */
BinarySearchTree.prototype.createLeftChild = function (options) {
  var leftChild = this.createSimilar(options);
  leftChild.parent = this;
  this.left = leftChild;

  return leftChild;
};


/**
 * Create the right child of this BST and return it
 */
BinarySearchTree.prototype.createRightChild = function (options) {
  var rightChild = this.createSimilar(options);
  rightChild.parent = this;
  this.right = rightChild;

  return rightChild;
};


/**
 * Insert a new element
 */
BinarySearchTree.prototype.insert = function (key, value) {
  // Empty tree, insert as root
  if (!this.hasOwnProperty('key')) {
    this.key = key;
    this.data.push(value);
    return;
  }

  // Same key as root
  if (this.compareKeys(this.key, key) === 0) {
    if (this.unique) {
      throw { message: "Can't insert key " + key + ", it violates the unique constraint"
            , key: key
            , errorType: 'uniqueViolated'
            };
    } else {
      this.data.push(value);
    }
    return;
  }

  if (this.compareKeys(key, this.key) < 0) {
    // Insert in left subtree
    if (this.left) {
      this.left.insert(key, value);
    } else {
      this.createLeftChild({ key: key, value: value });
    }
  } else {
    // Insert in right subtree
    if (this.right) {
      this.right.insert(key, value);
    } else {
      this.createRightChild({ key: key, value: value });
    }
  }
};


/**
 * Search for all data corresponding to a key
 */
BinarySearchTree.prototype.search = function (key) {
  if (!this.hasOwnProperty('key')) { return []; }

  if (this.compareKeys(this.key, key) === 0) { return this.data; }

  if (this.compareKeys(key, this.key) < 0) {
    if (this.left) {
      return this.left.search(key);
    } else {
      return [];
    }
  } else {
    if (this.right) {
      return this.right.search(key);
    } else {
      return [];
    }
  }
};


/**
 * Return a function that tells whether a given key matches a lower bound
 */
BinarySearchTree.prototype.getLowerBoundMatcher = function (query) {
  var self = this;

  // No lower bound
  if (!query.hasOwnProperty('$gt') && !query.hasOwnProperty('$gte')) {
    return function () { return true; };
  }

  if (query.hasOwnProperty('$gt') && query.hasOwnProperty('$gte')) {
    if (self.compareKeys(query.$gte, query.$gt) === 0) {
      return function (key) { return self.compareKeys(key, query.$gt) > 0; };
    }

    if (self.compareKeys(query.$gte, query.$gt) > 0) {
      return function (key) { return self.compareKeys(key, query.$gte) >= 0; };
    } else {
      return function (key) { return self.compareKeys(key, query.$gt) > 0; };
    }
  }

  if (query.hasOwnProperty('$gt')) {
    return function (key) { return self.compareKeys(key, query.$gt) > 0; };
  } else {
    return function (key) { return self.compareKeys(key, query.$gte) >= 0; };
  }
};


/**
 * Return a function that tells whether a given key matches an upper bound
 */
BinarySearchTree.prototype.getUpperBoundMatcher = function (query) {
  var self = this;

  // No lower bound
  if (!query.hasOwnProperty('$lt') && !query.hasOwnProperty('$lte')) {
    return function () { return true; };
  }

  if (query.hasOwnProperty('$lt') && query.hasOwnProperty('$lte')) {
    if (self.compareKeys(query.$lte, query.$lt) === 0) {
      return function (key) { return self.compareKeys(key, query.$lt) < 0; };
    }

    if (self.compareKeys(query.$lte, query.$lt) < 0) {
      return function (key) { return self.compareKeys(key, query.$lte) <= 0; };
    } else {
      return function (key) { return self.compareKeys(key, query.$lt) < 0; };
    }
  }

  if (query.hasOwnProperty('$lt')) {
    return function (key) { return self.compareKeys(key, query.$lt) < 0; };
  } else {
    return function (key) { return self.compareKeys(key, query.$lte) <= 0; };
  }
};


// Append all elements in toAppend to array
function append (array, toAppend) {
  var i;

  for (i = 0; i < toAppend.length; i += 1) {
    array.push(toAppend[i]);
  }
}


/**
 * Get all data for a key between bounds
 * Return it in key order
 * @param {Object} query Mongo-style query where keys are $lt, $lte, $gt or $gte (other keys are not considered)
 * @param {Functions} lbm/ubm matching functions calculated at the first recursive step
 */
BinarySearchTree.prototype.betweenBounds = function (query, lbm, ubm) {
  var res = [];

  if (!this.hasOwnProperty('key')) { return []; }   // Empty tree

  lbm = lbm || this.getLowerBoundMatcher(query);
  ubm = ubm || this.getUpperBoundMatcher(query);

  if (lbm(this.key) && this.left) { append(res, this.left.betweenBounds(query, lbm, ubm)); }
  if (lbm(this.key) && ubm(this.key)) { append(res, this.data); }
  if (ubm(this.key) && this.right) { append(res, this.right.betweenBounds(query, lbm, ubm)); }

  return res;
};


/**
 * Delete the current node if it is a leaf
 * Return true if it was deleted
 */
BinarySearchTree.prototype.deleteIfLeaf = function () {
  if (this.left || this.right) { return false; }

  // The leaf is itself a root
  if (!this.parent) {
    delete this.key;
    this.data = [];
    return true;
  }

  if (this.parent.left === this) {
    this.parent.left = null;
  } else {
    this.parent.right = null;
  }

  return true;
};


/**
 * Delete the current node if it has only one child
 * Return true if it was deleted
 */
BinarySearchTree.prototype.deleteIfOnlyOneChild = function () {
  var child;

  if (this.left && !this.right) { child = this.left; }
  if (!this.left && this.right) { child = this.right; }
  if (!child) { return false; }

  // Root
  if (!this.parent) {
    this.key = child.key;
    this.data = child.data;

    this.left = null;
    if (child.left) {
      this.left = child.left;
      child.left.parent = this;
    }

    this.right = null;
    if (child.right) {
      this.right = child.right;
      child.right.parent = this;
    }

    return true;
  }

  if (this.parent.left === this) {
    this.parent.left = child;
    child.parent = this.parent;
  } else {
    this.parent.right = child;
    child.parent = this.parent;
  }

  return true;
};


/**
 * Delete a key or just a value
 * @param {Key} key
 * @param {Value} value Optional. If not set, the whole key is deleted. If set, only this value is deleted
 */
BinarySearchTree.prototype.delete = function (key, value) {
  var newData = [], replaceWith
    , self = this
    ;

  if (!this.hasOwnProperty('key')) { return; }

  if (this.compareKeys(key, this.key) < 0) {
    if (this.left) { this.left.delete(key, value); }
    return;
  }

  if (this.compareKeys(key, this.key) > 0) {
    if (this.right) { this.right.delete(key, value); }
    return;
  }

  if (!this.compareKeys(key, this.key) === 0) { return; }

  // Delete only a value
  if (this.data.length > 1 && value !== undefined) {
    this.data.forEach(function (d) {
      if (!self.checkValueEquality(d, value)) { newData.push(d); }
    });
    self.data = newData;
    return;
  }

  // Delete the whole node
  if (this.deleteIfLeaf()) {
    return;
  }
  if (this.deleteIfOnlyOneChild()) {
    return;
  }

  // We are in the case where the node to delete has two children
  if (Math.random() >= 0.5) {   // Randomize replacement to avoid unbalancing the tree too much
    // Use the in-order predecessor
    replaceWith = this.left.getMaxKeyDescendant();

    this.key = replaceWith.key;
    this.data = replaceWith.data;

    if (this === replaceWith.parent) {   // Special case
      this.left = replaceWith.left;
      if (replaceWith.left) { replaceWith.left.parent = replaceWith.parent; }
    } else {
      replaceWith.parent.right = replaceWith.left;
      if (replaceWith.left) { replaceWith.left.parent = replaceWith.parent; }
    }
  } else {
    // Use the in-order successor
    replaceWith = this.right.getMinKeyDescendant();

    this.key = replaceWith.key;
    this.data = replaceWith.data;

    if (this === replaceWith.parent) {   // Special case
      this.right = replaceWith.right;
      if (replaceWith.right) { replaceWith.right.parent = replaceWith.parent; }
    } else {
      replaceWith.parent.left = replaceWith.right;
      if (replaceWith.right) { replaceWith.right.parent = replaceWith.parent; }
    }
  }
};


/**
 * Execute a function on every node of the tree, in key order
 * @param {Function} fn Signature: node. Most useful will probably be node.key and node.data
 */
BinarySearchTree.prototype.executeOnEveryNode = function (fn) {
  if (this.left) { this.left.executeOnEveryNode(fn); }
  fn(this);
  if (this.right) { this.right.executeOnEveryNode(fn); }
};


/**
 * Pretty print a tree
 * @param {Boolean} printData To print the nodes' data along with the key
 */
BinarySearchTree.prototype.prettyPrint = function (printData, spacing) {
  spacing = spacing || "";

  console.log(spacing + "* " + this.key);
  if (printData) { console.log(spacing + "* " + this.data); }

  if (!this.left && !this.right) { return; }

  if (this.left) {
    this.left.prettyPrint(printData, spacing + "  ");
  } else {
    console.log(spacing + "  *");
  }
  if (this.right) {
    this.right.prettyPrint(printData, spacing + "  ");
  } else {
    console.log(spacing + "  *");
  }
};




// Interface
module.exports = BinarySearchTree;

},{"./customUtils":10}],10:[function(require,module,exports){
/**
 * Return an array with the numbers from 0 to n-1, in a random order
 */
function getRandomArray (n) {
  var res, next;

  if (n === 0) { return []; }
  if (n === 1) { return [0]; }

  res = getRandomArray(n - 1);
  next = Math.floor(Math.random() * n);
  res.splice(next, 0, n - 1);   // Add n-1 at a random position in the array

  return res;
};
module.exports.getRandomArray = getRandomArray;


/*
 * Default compareKeys function will work for numbers, strings and dates
 */
function defaultCompareKeysFunction (a, b) {
  if (a < b) { return -1; }
  if (a > b) { return 1; }
  if (a === b) { return 0; }

  throw { message: "Couldn't compare elements", a: a, b: b };
}
module.exports.defaultCompareKeysFunction = defaultCompareKeysFunction;


/**
 * Check whether two values are equal (used in non-unique deletion)
 */
function defaultCheckValueEquality (a, b) {
  return a === b;
}
module.exports.defaultCheckValueEquality = defaultCheckValueEquality;

},{}],11:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ConnectionMap = (function () {
  function ConnectionMap() {
    _classCallCheck(this, ConnectionMap);
  }

  _createClass(ConnectionMap, [{
    key: 'toJSON',
    value: function toJSON() {
      var json = {};
      for (var key in this) {
        if (this.hasOwnProperty(key)) {
          for (var i = 0; i < this[key].length; i++) {
            if (!json[key]) {
              json[key] = [];
            }
            json[key][i] = this[key][i].toJSON();
          }
        }
      }
      return json;
    }
  }]);

  return ConnectionMap;
})();

module.exports = ConnectionMap;
//# sourceMappingURL=ConnectionMap.js.map

},{}],12:[function(require,module,exports){
'use strict'

// TODO: created something more flexible to load this on demand
;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var util = require('util');
var uuid = require('uuid').v4;
var Run = require('./run');
var validate = require('./validate');
var IoMapHandler = require('./io/mapHandler');
var DefaultProcessManager = require('./process/defaultManager');
var Loader = require('chix-loader');
var multiSort = require('./multisort');
var EventEmitter = require('./events/after');
var debug = require('debug')('chix:actor');

var mixin = require('./mixin');
var $Control = require('./actor/control');
var $IIP = require('./actor/iip');
var $Link = require('./actor/link');
var $Node = require('./actor/node');
var $Port = require('./actor/port');
var $Report = require('./actor/report');

/**
 *
 * Actor
 *
 * The Actor is responsible of managing a flow
 * it links and it's nodes.
 *
 * A node contains the actual programming logic.
 *
 * @public
 * @author Rob Halff <rob.halff@gmail.com>
 * @constructor
 */

var Actor = (function (_EventEmitter) {
  _inherits(Actor, _EventEmitter);

  function Actor() {
    _classCallCheck(this, Actor);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Actor).call(this));

    _this.ioHandler = undefined;
    _this.processManager = undefined;
    _this.view = [];
    _this.identifier = 'actor:main';

    // default to own id, map can overwrite
    _this.id = uuid();

    _this.type = 'flow';

    _this.links = new Map();
    _this.iips = new Map();
    _this.status = undefined;
    _this.nodes = new Map();

    /**
     *
     * Added by default.
     *
     * If others need to be used they should be set before addMap();
     *
     */
    _this.setIoHandler(new IoMapHandler());
    _this.setProcessManager(new DefaultProcessManager());
    _this.setLoader(new Loader());
    return _this;
  }

  /**
   *
   * Create an actor
   *
   * @public
   */

  _createClass(Actor, [{
    key: 'addLoader',

    /**
     *
     * Adds the definition Loader
     *
     * This provides an api to get the required node definitions.
     *
     * The loader should already be init'ed
     *
     * e.g. the remote loader will already have loaded the definitions.
     * and is ready to respond to getNodeDefinition(ns, name, type, provider)
     *
     * e.g. An async loader could do something like this:
     *
     *   loader(flow, function() { actor.addLoader(loader); }
     *
     * With a sync loader it will just look like:
     *
     * actor.addLoader(loader);
     *
     * @public
     */
    value: function addLoader(loader) {
      this.loader = loader;
      return this;
    }

    /**
     *
     * Validate and read map
     *
     * @param {Object} map
     * @public
     *
     */

  }, {
    key: 'addMap',
    value: function addMap(map) {
      debug('%s: addMap()', this.identifier);

      var self = this;

      if (typeof map === 'undefined') {
        throw new Error('map is not defined');
      }

      if (map !== Object(map)) {
        throw new Error('addMap expects an object');
      }

      try {
        validate.flow(map);
      } catch (e) {
        if (map.title) {
          throw Error(util.format('Flow `%s`: %s', map.title, e.message));
        } else {
          throw Error(util.format('Flow %s:%s: %s', map.ns, map.name, e.message));
        }
      }

      if (map.id) {
        // xFlow contains it, direct actors don't perse
        this.id = map.id;
      }

      // add ourselves (actor/xFlow) to the processmanager
      // this way links can store our id and pid
      // must be done *before* adding our nodes.
      // otherwise our nodes will be registered before ourselves.
      if (!this.pid) {
        // re-run
        this.processManager.register(this);
      }

      // allow a map to carry it's own definitions
      if (map.nodeDefinitions) {
        this.loader.addNodeDefinitions('@', map.nodeDefinitions);
      }

      // add nodes and links one by one so there is more control
      map.nodes.forEach(function (node) {
        if (!node.id) {
          throw new Error(util.format('Node lacks an id: %s:%s', node.ns, node.name));
        }

        // give the node a default provider.
        if (!node.provider) {
          if (map.providers && map.providers.hasOwnProperty('@')) {
            node.provider = map.providers['@'].url;
          }
        }

        var def = self.loader.getNodeDefinition(node, map);
        if (!def) {

          throw new Error(util.format('Failed to get node definition for %s:%s', node.ns, node.name));
        }

        self.createNode(node, def);
      });

      // this.ensureConnectionNumbering(map);

      if (map.hasOwnProperty('links')) {
        map.links.forEach(function (link) {
          self.addLink(self.createLink(link));
        });
      }

      for (var i = 0; i < map.nodes.length; i++) {
        this.view.push(map.nodes[i].id);
      }

      /*
       Disabled. Actor.start() does this and xFlow.start()
       will start all their nodes, and then goes recursive.
        // all nodes & links setup, run start method on node
       for (const node of this.nodes.values()) {
         node.start();
       }
       */

      return this;
    }

    /**
     *
     * Used by the process manager to set our id
     *
     */

  }, {
    key: 'setPid',
    value: function setPid(pid) {
      this.pid = pid;
    }
  }, {
    key: 'unlockConnections',
    value: function unlockConnections(node) {
      // fix this, flow connections setup is different
      var conns = node.getConnections();
      for (var port in conns) {
        if (conns.hasOwnProperty(port)) {
          for (var i = 0; i < conns[port].length; i++) {
            this.ioHandler.unlock(conns[port][i]);
          }
        }
      }
    }
  }, {
    key: '__input',
    value: function __input(link, p) {
      var self = this;

      this.ioHandler.lock(link);

      var targetNode = this.getNode(link.target.id);

      // give owner ship to targetNode
      p.setOwner(targetNode);

      var ret = targetNode.fill(link.target, p);

      // breakpoint
      if (util.isError(ret)) {
        // `hard reject`
        // set node in error state and output error to ioHandler
        targetNode.error(ret);

        p.release(targetNode);
        p.setOwner(link);

        debug('%s: reject %s', this.identifier, ret);
        self.ioHandler.reject(ret, link, p);
      } else if (ret === false) {
        p.release(targetNode);
        p.setOwner(link);

        // something should unlock.
        // having this reject unlock it is too much free form.
        debug('%s: `%s` soft reject re-queue', this.identifier, targetNode.identifier);
        // `soft reject`
        self.ioHandler.reject(ret, link, p);
      } else {
        // unlock *all* queues targeting this node.
        // the IOHandler can do this.
        debug('%s: unlock all queues for `%s`', this.identifier, targetNode.identifier);

        self.unlockConnections(targetNode);

        self.ioHandler.accept(link, p);
      }
    }
  }, {
    key: 'setMeta',
    value: function setMeta(nodeId, key, value) {
      var node = this.getNode(nodeId);

      node.setMeta(key, value);

      this.emit('metadata', {
        id: this.id,
        node: node.export()
      });
    }

    /**
     *
     * Add IO Handler.
     *
     * The IO Handler handles all the input and output.
     *
     * @param {IOHandler} handler
     * @public
     *
     */

  }, {
    key: 'addIoHandler',
    value: function addIoHandler(handler) {
      this.ioHandler = handler;

      return this;
    }

    /**
     *
     * Add Process Manager.
     *
     * The Process Manager holds all processes.
     *
     * @param {Object} manager
     * @public
     *
     */

  }, {
    key: 'addProcessManager',
    value: function addProcessManager(manager) {
      this.processManager = manager;

      return this;
    }

    /**
     *
     * Add a new context provider.
     *
     * A context provider pre-processes the raw context
     *
     * This is useful for example when using the command line.
     * All nodes which do not have context set can be asked for context.
     *
     * E.g. database credentials could be prompted for after which all
     *      input is fullfilled and the flow will start to run.
     *
     * @param {ContextProvider} provider
     * @private
     *
     */

  }, {
    key: 'addContextProvider',
    value: function addContextProvider(provider) {
      this.contextProvider = provider;

      return this;
    }

    /**
     *
     * Explains what input and output ports are
     * available for interaction.
     *
     */

  }, {
    key: 'help',
    value: function help() {}

    /**
     *
     * Retrieve a node by it's process id
     *
     * @param {String} pid - Process ID
     * @return {Object} node
     * @public
     */

  }, {
    key: 'getNodeByPid',
    value: function getNodeByPid(pid) {
      return Array.from(this.nodes.values()).find(function (node) {
        return node.pid === pid;
      });
    }

    /**
     *
     * Get all node ids this node depends on.
     *
     * @param {String} nodeId
     * @return {Array} nodes
     * @public
     */

  }, {
    key: 'getAncestorIds',
    value: function getAncestorIds(nodeId) {
      var self = this;

      var pids = this.ioHandler.getAncestorPids(this.getNode(nodeId).pid);

      var ids = [];
      pids.forEach(function (pid) {
        ids.push(self.getNodeByPid(pid).id);
      });
      return ids;
    }

    /**
     *
     * Get the entire node branch this node depends on
     *
     * @param {String} nodeId
     * @return {Array} nodes
     * @public
     */

  }, {
    key: 'getAncestorNodes',
    value: function getAncestorNodes(nodeId) {
      var nodes = [];
      var ids = this.getAncestorIds(nodeId);

      for (var i = 0; i < ids.length; i++) {
        nodes.push(this.getNode(ids[i]));
      }

      return nodes;
    }

    /**
     *
     * Get all node ids that target this node.
     *
     * @param {String} nodeId
     * @return {Array} ids
     * @public
     */

  }, {
    key: 'getSourceIds',
    value: function getSourceIds(nodeId) {
      var self = this;
      var ids = [];

      var pids = this.ioHandler.getSourcePids(this.getNode(nodeId).pid);

      pids.forEach(function (pid) {
        var node = self.getNodeByPid(pid);
        if (node) {
          // iips will not be found
          ids.push(node.id);
        }
      });
      return ids;
    }

    /**
     *
     * Get all nodes that target this node.
     *
     * @param {String} nodeId
     * @return {Array} nodes
     * @public
     */

  }, {
    key: 'getSourceNodes',
    value: function getSourceNodes(nodeId) {
      var nodes = [];
      var ids = this.getSourceIds(nodeId);

      for (var i = 0; i < ids.length; i++) {
        nodes.push(this.getNode(ids[i]));
      }

      return nodes;
    }

    /**
     *
     * Get all nodes that use this node as a source .
     *
     * @param {String} nodeId
     * @return {Array} ids
     * @public
     */

  }, {
    key: 'getTargetIds',
    value: function getTargetIds(nodeId) {
      var self = this;

      var pids = this.ioHandler.getTargetPids(this.getNode(nodeId).pid);

      var ids = [];
      pids.forEach(function (pid) {
        ids.push(self.getNodeByPid(pid).id);
      });
      return ids;
    }

    /**
     *
     * Use is a generic way of creating a new instance of self
     * And only act upon a subset of our map.
     */

  }, {
    key: 'use',
    value: function use() /*name, context*/{
      throw Error('TODO: reimplement actions');
      /*
       const i;
       const action;
       const map = {};
       const sub = new this.constructor();
        // Use this handlers events also on the action.
       sub._events = this._events;
        // Find our action
       if (!this.map.actions) {
       throw new Error('This flow has no actions');
       }
        if (!this.map.actions.hasOwnProperty(name)) {
       throw new Error('Action not found');
       }
        action = this.map.actions[name];
        // Create a reduced map
       map.env = this.map.env;
       map.title =  action.title;
       map.description = action.description;
       map.ports = this.map.ports;
       map.nodes = [];
       map.links = [];
        for (i = 0; i < this.map.nodes.length; i++) {
       if (action.nodes.indexOf(this.map.nodes[i].id) >= 0) {
       map.nodes.push(this.map.nodes[i]);
       }
       }
        for (i = 0; i < this.map.links.length; i++) {
       if (
       action.nodes.indexOf(this.map.links[i].source.id) >= 0 &&
       action.nodes.indexOf(this.map.links[i].target.id) >= 0) {
       map.links.push(this.map.links[i]);
       }
       }
        // re-use the loader
       sub.addLoader(this.loader);
        // add the nodes to our newly instantiated Actor
       sub.addMap(map);
        // hack to autostart it during run()
       // this only makes sense with actions.
       // TODO: doesn work anymore
       // sub.trigger = action.nodes[0];
        return sub;
       */
    }

    /**
     *
     * Run the current flow
     *
     * The flow starts by providing the ports with their context.
     *
     * Nodes which have all their ports filled by context will run immediatly.
     *
     * Others will wait until their unfilled ports are filled by connections.
     *
     * Internally the node will be set to a `contextGiven` state.
     * It's a method to tell the node we expect it to have enough
     * information to start running.
     *
     * If a port is not required and context was given and there are
     * no connections on it, it will not block the node from running.
     *
     * If a map has actions defined, run expects an action name to run.
     *
     * Combinations:
     *
     *   - run()
     *     run flow without callback
     *
     *   - run(callback)
     *     run with callback
     *
     *   - action('actionName').run()
     *     run action without callback
     *
     *   - action('actionName').run(callback)
     *     run action with callback
     *
     * The callback will receive the output of the (last) node(s)
     * Determined by which output ports are exposed.
     *
     * If we pass the exposed output, it can contain output from anywhere.
     *
     * If a callback is defined but there are no exposed output ports.
     * The callback will never fire.
     *
     * @public
     */

  }, {
    key: 'run',
    value: function run(callback) {
      return new Run(this, callback);
    }
    /**
     *
     * Need to do it like this, we want the new sub actor
     * to be returned to place events on etc.
     *
     * Otherwise it's hidden within the actor itself
     *
     * Usage: Actor.action('action').run(callback);
     *
     */

  }, {
    key: 'action',
    value: function action(_action, context) {
      var sub = this.use(_action, context);
      return sub;
    }

    /**
     *
     * If there are multiple connections to one port
     * the connections are numbered.
     *
     * If there is a index specified by using the
     * [] property, it will be considered.
     *
     * If it's not specified although there are
     * multiple connections to one port, it will be added.
     *
     * The sort takes care of adding connections where
     * [] is undefined to be placed last.
     *
     * The second loop makes sure they are correctly numbered.
     *
     * If connections are defined like:
     *
     *   undefined, [4],undefined, [3],[2]
     *
     * The corrected result will be:
     *
     * [2]        -> [0]
     * [3]        -> [1]
     * [4]        -> [2]
     * undefined  -> [3]
     * undefined  -> [4]
     *
     * Ports which only have one connection will be left unmodified.
     *
     */

  }, {
    key: 'ensureConnectionNumbering',
    value: function ensureConnectionNumbering(map) {
      var c = 0;
      var i = undefined;
      var link = undefined;
      var last = {};
      var node = undefined;

      // first sort so order of appearance of
      // target.in is correct
      //
      // FIX: seems like multisort is messing up the array.
      // target suddenly has unknown input ports...
      if (map.links.length) {
        multiSort(map.links, ['target', 'in', 'index']);
      }

      for (i = 0; i < map.links.length; i++) {
        link = map.links[i];

        // Weird, the full node is not build yet here?
        // so have to look at the nodeDefinitions ns and name _is_
        // known at this point.
        node = this.nodes.get(link.target.id);

        if (this.nodeDefinitions[node.ns][node.name].ports.input[link.target.port].type === 'array') {

          if (last.target.id === link.target.id && last.target.port === link.target.port) {
            last.index = c++;
            link.index = c;
          } else {
            c = 0; // reset
          }
          last = link;
        }
      }
    }
  }, {
    key: 'hasParent',
    value: function hasParent() {
      return false;
    }

    /**
     *
     * Register extra node types:
     *
     * Current types available are:
     *
     *  - ReactNode
     *  - PolymerNode
     *
     */

  }, {
    key: 'registerNodeType',
    value: function registerNodeType(Type) {
      Actor.nodeTypes[Type.name] = Type;
    }
  }], [{
    key: 'create',
    value: function create(map, loader, ioHandler, processManager) {
      var actor = new Actor();
      loader = loader || new Loader();
      processManager = processManager || new DefaultProcessManager();
      ioHandler = ioHandler || new IoMapHandler();
      actor.addLoader(loader);
      actor.addIoHandler(ioHandler);
      actor.addProcessManager(processManager);
      actor.addMap(map);

      return actor;
    }
  }]);

  return Actor;
})(EventEmitter);

Actor.prototype.setLoader = Actor.prototype.addLoader;
Actor.prototype.setContextProvider = Actor.prototype.addContextProvider;
Actor.prototype.setIoHandler = Actor.prototype.addIoHandler;
Actor.prototype.setProcessManager = Actor.prototype.addProcessManager;

mixin(Actor, $Control, $IIP, $Link, $Node, $Port, $Report);
module.exports = Actor;
//# sourceMappingURL=actor.js.map

},{"./actor/control":13,"./actor/iip":14,"./actor/link":15,"./actor/node":16,"./actor/port":17,"./actor/report":18,"./events/after":22,"./io/mapHandler":25,"./mixin":27,"./multisort":28,"./process/defaultManager":34,"./run":37,"./validate":41,"chix-loader":49,"debug":"V4HZ/5","util":6,"uuid":61}],13:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Status = require('./status');
var debug = require('debug')('chix:actor');
var Connector = require('../connector');

var Control = (function () {
  function Control() {
    _classCallCheck(this, Control);
  }

  _createClass(Control, [{
    key: 'hold',

    /**
     *
     * Holds a Node
     *
     * @param {String} id
     * @public
     */
    value: function hold(id) {
      this.getNode(id).hold();

      return this;
    }

    /**
     *
     * Pushes the Actor
     *
     * Will send :start to all nodes without input
     * and all nodes which have all their input ports
     * filled by context already.
     *
     * @public
     */

  }, {
    key: 'push',
    value: function push() {
      this.status = Status.RUNNING;
      debug('%s: push()', this.identifier);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.nodes.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var node = _step.value;

          if (node.isStartable()) {
            var iip = new Connector();
            iip.plug(node.id, ':start');
            this.sendIIP(iip, '');
          } else {
            debug('%s: `%s` not startable', this.identifier, node.identifier);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return this;
    }

    /**
     *
     * Starts the actor
     *
     * @param {Boolean} push
     * @public
     */

  }, {
    key: 'start',
    value: function start(push) {
      this.status = Status.RUNNING;

      debug('%s: start', this.identifier);

      // TODO: this means IIPs should be send after start.
      //       enforce this..
      this.clearIIPs();

      // start all nodes
      // (could also be started during addMap
      // runtime is skipping addMap.
      // so make sure start() is restartable.
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.nodes.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var node = _step2.value;

          node.start();
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      if (push !== false) {
        this.push();
      }

      // there are many other ways to start
      // so this does not ensure much.
      // however the process manager listens to this.
      // Real determination if something is started or stopped
      // includes the ioHandler.
      // So let's just inform the io handler we are started.

      this.emit('start', {
        node: this
      });

      return this;
    }

    /**
     *
     * Stops the actor
     *
     * Use a callback to make sure it is stopped.
     *
     * @public
     */

  }, {
    key: 'stop',
    value: function stop(cb) {
      var self = this;

      this.status = Status.STOPPED;

      if (this.ioHandler) {
        this.ioHandler.reset(function resetCallbackIoHandler() {
          // close ports opened by iips
          self.clearIIPs();

          self.emit('stop', {
            node: self
          });

          if (cb) {
            cb();
          }
        });
      }
    }
  }, {
    key: 'pause',
    value: function pause() {
      this.status = Status.STOPPED;

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = this.nodes.values()[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var node = _step3.value;

          node.hold();
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return this;
    }

    /**
     *
     * Resumes the actor
     *
     * All nodes which are on hold will resume again.
     *
     * @public
     */

  }, {
    key: 'resume',
    value: function resume() {
      this.status = Status.RUNNING;

      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = this.nodes.values()[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var node = _step4.value;

          node.release();
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      return this;
    }

    /**
     *
     * Get the current status
     *
     * @public
     */

  }, {
    key: 'getStatus',
    value: function getStatus() {
      return this.status;
    }

    /**
     *
     * Releases a node if it was on hold
     *
     * @param {String} id
     * @public
     */

  }, {
    key: 'release',
    value: function release(id) {
      return this.getNode(id).release();
    }

    /**
     *
     * Resets this instance so it can be re-used
     *
     * Note: The registered loader is left untouched.
     *
     * @public
     *
     */

  }, {
    key: 'reset',
    value: function reset() {
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = this.nodes.values()[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var node = _step5.value;

          node.reset();
        }

        // if nothing has started yet
        // there is no ioHandler
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5.return) {
            _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }

      if (this.ioHandler) {
        this.ioHandler.reset();
      }

      return this;
    }
  }, {
    key: 'clear',
    value: function clear(cb) {
      if (!cb) {
        throw Error('clear expects a callback');
      }

      var self = this;
      var cnt = 0;
      var total = this.nodes.size;

      function removeNodeHandler() {
        cnt++;
        if (cnt === total) {
          self.nodes = {};
          cb();
        }
      }

      if (total === 0) {
        cb();
      } else {
        // remove node will automatically remove all links
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = this.nodes.values()[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var node = _step6.value;

            // will remove links also.
            this.removeNode(node.id, removeNodeHandler);
          }
        } catch (err) {
          _didIteratorError6 = true;
          _iteratorError6 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }
          } finally {
            if (_didIteratorError6) {
              throw _iteratorError6;
            }
          }
        }
      }
    }
  }]);

  return Control;
})();

module.exports = Control;
//# sourceMappingURL=control.js.map

},{"../connector":20,"./status":19,"debug":"V4HZ/5"}],14:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Packet = require('../packet');
var Connector = require('../connector');

var IIP = (function () {
  function IIP() {
    _classCallCheck(this, IIP);
  }

  _createClass(IIP, [{
    key: 'sendIIPs',

    /**
     *
     * Send IIPs
     *
     * Optionally with `options` for the port:
     *
     * e.g. { persist: true }
     *
     * Optionally with `source` information
     *
     * e.g. { index: 1 } // index for array port
     *
     * @param {Object} iips
     * @public
     */
    value: function sendIIPs(iips) {
      var self = this;

      var links = [];

      iips.forEach(function (iip) {
        var xLink = self.createLink({
          source: {
            id: self.id, // we are the sender
            port: ':iip'
          },
          target: iip.target
        });

        // dispose after fill
        xLink.set('dispose', true);

        if (iip.data === undefined) {
          throw Error('IIP data is `undefined`');
        }

        xLink.data = iip.data;

        links.push(xLink);
      });

      links.forEach(function (iip) {
        // TODO: this doesn't happen anymore it's always a link.
        // make sure settings are always set also.
        if (iip.target.constructor.name !== 'Connector') {
          var target = new Connector();
          target.plug(iip.target.id, iip.target.port);
          for (var key in iip.target.setting) {
            if (iip.target.setting.hasOwnProperty(key)) {
              target.set(key, iip.target.setting[key]);
            }
          }
          iip.target = target;
        }

        if (!self.id) {
          throw Error('Actor must contain an id');
        }

        self.addLink(iip);
      });

      links.forEach(function (link) {
        self.ioHandler.emit('send', link);

        // Packet owned by the link
        var p = new Packet(link,
        //JSON.parse(JSON.stringify(link.data)),
        link.data, self.getNode(link.target.id).getPortType('input', link.target.port));

        // a bit too direct, ioHandler should do this..
        self.ioHandler.queueManager.queue(link.ioid, p);

        // remove data bit.
        delete link.data;
      });

      return links;
    }

    /*
     * Send a single IIP to a port.
     *
     * Note: If multiple IIPs have to be send use sendIIPs instead.
     *
     * Source is mainly for testing, but essentially it allows you
     * to imposter a sender as long as you send along the right
     * id and source port name.
     *
     * Source is also used to set an index[] for array ports.
     * However, if you send multiple iips for an array port
     * they should be send as a group using sendIIPs
     *
     * This is because they should be added in reverse order.
     * Otherwise the process will start too early.
     *
     * @param {Connector} target
     * @param {Object} data
     * @public
     */

  }, {
    key: 'sendIIP',
    value: function sendIIP(target, data) {

      if (!this.id) {
        throw Error('Actor must contain an id');
      }

      if (undefined === data) {
        throw Error('Refused to send IIP without data');
      }

      var ln = {
        source: {
          id: this.id, // we are the sender
          pid: this.pid,
          port: ':iip'
        },
        target: target
      };

      var xLink = this.createLink(ln);
      xLink.data = data;

      // dispose after fill
      xLink.set('dispose', true);

      // makes use of xLink.data
      this.addLink(xLink);

      this.ioHandler.emit('send', xLink);

      var p = new Packet(xLink,
      //JSON.parse(JSON.stringify(xLink.data)),
      xLink.data,
      // target port type
      this.getNode(xLink.target.id).getPortType('input', xLink.target.port));

      this.ioHandler.queueManager.queue(xLink.ioid, p);

      // remove data bit.
      delete xLink.data;

      return xLink;
    }
  }, {
    key: 'clearIIP',
    value: function clearIIP(link) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.iips.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var oldLink = _step.value;

          // source is always us so do not have to check it.
          if ((oldLink.source.port === ':iip' || oldLink.target.port === link.target.port || oldLink.target.port === ':start' // huge uglyness
          ) && oldLink.target.id === link.target.id) {

            this.unplugNode(oldLink.target);

            this.ioHandler.disconnect(oldLink);

            this.iips.delete(oldLink.id);

            // TODO: just rename this to clearIIP
            this.emit('removeIIP', oldLink);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }

    /**
     *
     * Clear IIPs
     *
     * If target is specified, only those iips will be cleared.
     *
     */

  }, {
    key: 'clearIIPs',
    value: function clearIIPs(target) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.iips.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var iip = _step2.value;

          if (!target || target.id === iip.target.id && target.port === iip.target.port) {
            this.clearIIP(iip);
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  }]);

  return IIP;
})();

module.exports = IIP;
//# sourceMappingURL=iip.js.map

},{"../connector":20,"../packet":31}],15:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var xLink = require('../link');
var debug = require('debug')('chix:actor');
var util = require('util');

var Link = (function () {
  function Link() {
    _classCallCheck(this, Link);
  }

  _createClass(Link, [{
    key: 'createLink',

    /**
     *
     * Creates a new connection/link
     *
     * Basically takes a plain link object
     * and creates a proper xLink from it.
     *
     * The internal map holds xLinks, whereas
     * the source map is just plain JSON.
     *
     * Structurewise they are almost the same.
     *
     * @param {Object} ln
     * @return {xLink} link
     * @public
     *
     */
    value: function createLink(ln) {
      return xLink.create(ln);
    }

    /**
     *
     * Adds a link
     *
     * @param {xLink} link
     */

  }, {
    key: 'addLink',
    value: function addLink(link) {
      debug('%s: addLink()', this.identifier);

      if (link.constructor.name !== 'Link') {
        throw Error('Link must be of type Link');
      }

      if (link.source.id !== this.id) {
        // Warn: IIP has our own id
        var sourceNode = this.getNode(link.source.id);
        if (!sourceNode.portExists('output', link.source.port)) {
          throw Error(util.format('Source node (%s:%s) does not have an output port named `%s`\n\n' + '\tOutput ports available:\t%s\n', sourceNode.ns, sourceNode.name, link.source.port, Object.keys(sourceNode.ports.output).join(', ')));
        }
      }

      var targetNode = this.getNode(link.target.id);
      if (link.target.port !== ':start' && !targetNode.portExists('input', link.target.port)) {
        throw Error(util.format('Target node (%s:%s) does not have an input port named `%s`\n\n' + '\tInput ports available:\t%s\n', targetNode.ns, targetNode.name, link.target.port, Object.keys(targetNode.ports.input).join(', ')));
      }

      // const targetNode = this.getNode(link.target.id);

      // FIXME: rewriting sync property
      // to contain the process id of the node it's pointing
      // to not just the nodeId defined within the graph
      if (link.target.has('sync')) {
        link.target.set('sync', this.getNode(link.target.get('sync')).pid);
      }

      link.graphId = this.id;
      link.graphPid = this.pid;

      var self = this;

      var dataHandler = function dataHandler(p) {
        if (!this.ioid) {
          throw Error('LINK MISSING IOID');
        }

        self.__input(this, p);
      };

      link.on('data', dataHandler);

      if (link.source.id) {
        if (link.source.id === this.id) {
          link.setSourcePid(this.pid || this.id);
        } else {
          link.setSourcePid(this.getNode(link.source.id).pid);
        }
      }

      link.setTargetPid(this.getNode(link.target.id).pid);

      // remember our own links, so we can remove them
      // if it has data it's an iip
      if (undefined !== link.data) {
        this.iips.set(link.id, link);
      } else {
        this.links.set(link.id, link);
      }

      this.ioHandler.connect(link);

      this.plugNode(link.target);

      link.on('change', function changeLink(link) {
        self.emit('changeLink', link);
      });

      // bit inconsistent with event.node
      // should be event.link
      this.emit('addLink', link);

      // this.ensureConnectionNumbering();
      return link;
    }
  }, {
    key: 'getLink',
    value: function getLink(id) {
      return this.links.get(id);
    }

    /**
     *
     * @param ln
     * @returns {*}
     */

  }, {
    key: 'findLink',
    value: function findLink(ln) {
      return Array.from(this.links).find(function (link) {
        if (ln.source.id === link.source.id && ln.target.id === link.target.id && ln.source.port === link.source.port && ln.target.port === link.target.port) {
          return (!ln.source.setting.index || ln.source.setting.index === link.source.setting.index) && (!ln.target.setting.index || ln.target.setting.index === link.target.setting.index);
        }
      });
    }

    /**
     *
     * Removes link
     *
     * @param {Link} ln
     * @public
     *
     */

  }, {
    key: 'removeLink',
    value: function removeLink(ln) {
      // we should be able to find a link without id.
      var what = 'links';

      var link = this.links.get(ln.id);
      if (!link) {
        link = this.iips.get(ln.id);
        if (!link) {
          //throw Error('Cannot find link');
          // TODO: Seems to happen with ip directly to subgraph (non-fatal)
          console.warn('FIXME: cannot find link');
          return this;
        }
        what = 'iips';
      }

      this.unplugNode(link.target);

      this.ioHandler.disconnect(link);

      // io handler could do this.
      // removelink on the top-level actor/graph
      // is not very useful

      if (this[what].has(link.id)) {
        var oldLink = this[what].get(link.id);

        this[what].delete(link.id);

        this.emit('removeLink', oldLink);

        return this;
      }
      throw Error('Unable to remove link with id: ' + link.id);
    }
  }]);

  return Link;
})();

module.exports = Link;
//# sourceMappingURL=link.js.map

},{"../link":26,"debug":"V4HZ/5","util":6}],16:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var xNode = require('../node');
var DefaultContextProvider = require('../context/defaultProvider');
var validate = require('../validate');
var debug = require('debug')('chix:actor');
var util = require('util');

var Node = (function () {
  function Node() {
    _classCallCheck(this, Node);
  }

  _createClass(Node, [{
    key: 'createNode',

    /**
     *
     * Create/instantiate  a node
     *
     * Node at this stage is nothing more then:
     *
     *  { ns: "fs", name: "readFile" }
     *
     * @param {Object} node - Node as defined within a map
     * @param {Object} def  - Node Definition
     *
     * @public
     */
    value: function createNode(node, def) {
      var self = this;

      if (!def) {
        throw new Error(util.format('Failed to get node definition for %s:%s', node.ns, node.name));
      }

      if (!node.id) {
        throw Error('Node should have an id');
      }

      if (!def.ports) {
        def.ports = {};
      }
      // merges expose, persist etc, with port definitions.
      // This is not needed with proper inheritance
      for (var type in node.ports) {
        if (node.ports.hasOwnProperty(type) && def.ports.hasOwnProperty(type)) {
          for (var name in node.ports[type]) {
            if (node.ports[type].hasOwnProperty(name) && def.ports[type].hasOwnProperty(name)) {

              for (var property in node.ports[type][name]) {
                if (node.ports[type][name].hasOwnProperty(property)) {
                  // add or overwrite it.
                  def.ports[type][name][property] = node.ports[type][name][property];
                }
              }
            }
          }
        }
      }

      // allow instance to overwrite other node definition data also.
      // probably make much more overwritable, although many
      // should not be overwritten, so maybe just keep it this way.
      if (node.title) {
        def.title = node.title;
      }

      if (node.description) {
        def.description = node.description;
      }

      var identifier = node.title || [node.ns, '::', node.name, '-', this.nodes.size].join('');

      var _node = undefined;

      if (def.type === 'flow') {
        var xFlow = require('../flow'); // solve circular reference.

        validate.flow(def);

        _node = new xFlow(node.id, def, identifier, this.loader, // single(ton) instance (TODO: di)
        this.ioHandler, // single(ton) instance
        this.processManager // single(ton) instance
        );

        this.nodes.set(node.id, _node);

        debug('%s: created %s', this.identifier, _node.identifier);
      } else {
        var cls = def.type || 'xNode';

        if (Node.nodeTypes.hasOwnProperty(cls)) {
          validate.nodeDefinition(def);

          _node = new Node.nodeTypes[cls](node.id, def, identifier, this.ioHandler.CHI);

          this.nodes.set(node.id, _node);

          debug('%s: created %s', this.identifier, _node.identifier);

          // register and set pid, xFlow/actor adds itself to it (hack)
          this.processManager.register(this.nodes.get(node.id));
        } else {
          throw Error(util.format('Unknown node type: `%s`', cls));
        }
      }

      // add parent to both xflow's and node's
      // not very pure seperation, but it's just very convenient
      _node.setParent(this);

      if (node.provider) {
        _node.provider = node.provider;
      }

      // TODO: move this to something more general.
      // not on every node creation.
      if (!this.contextProvider) {
        this.addContextProvider(new DefaultContextProvider());
      }

      this.contextProvider.addContext(_node, node.context);

      function nodeOutputHandlerActor(event) {
        self.ioHandler.output(event);
      }

      _node.after('output', nodeOutputHandlerActor);

      _node.on('freePort', function freePortHandlerActor(event) {
        var links = undefined;
        var i = undefined;

        debug('%s:%s freePortHandler', self.identifier, event.port);

        // get all current port connections
        links = this.portGetConnections(event.port);

        if (links.length) {
          for (i = 0; i < links.length; i++) {
            var link = links[i];

            // unlock if it was locked
            if (self.ioHandler.queueManager.isLocked(link.ioid)) {
              self.ioHandler.queueManager.unlock(link.ioid);
            }
          }

          if (event.link) {
            // remove the link belonging to this event
            if (event.link.has('dispose')) {

              // TODO: remove cyclic all together, just use core/forEach
              //  this will cause bugs if you send multiple cyclics because
              //  the port is never unplugged..
              if (!event.link.target.has('cyclic')) {
                self.removeLink(event.link);
              }
            }
          }
        }
      });

      this.emit('addNode', { node: _node });

      return _node;
    }

    /**
     *
     * Plugs a source into a target node
     *
     *
     * @param {Connector} target
     */

  }, {
    key: 'plugNode',
    value: function plugNode(target) {
      return this.getNode(target.id).plug(target);
    }

    /**
     *
     * Unplugs a port for the node specified.
     *
     * @param {Connector} target
     */

  }, {
    key: 'unplugNode',
    value: function unplugNode(target) {
      // could be gone, if called from freePort
      // when nodes are being removed.
      if (this.hasNode(target.id)) {
        return this.getNode(target.id).unplug(target);
      }

      return false;
    }

    /**
     *
     * Adds a node to the map.
     *
     * The object format is like it's defined within a map.
     *
     * Right now this is only used during map loading.
     *
     * For dynamic loading care should be taken to make
     * this node resolvable by the loader.
     *
     * Which means the definition should either be found
     * at the default location defined within the map.
     * Or the node itself should carry provider information.
     *
     * A provider can be defined as:
     *
     *  - url:        https://serve.rhcloud.com/flows/{ns}/{name}
     *  - file:       ./{ns}/{name}
     *  - namespace:  MyNs
     *
     * Namespaces are defined within the map, so MyNs will point to
     * either the full url or filesystem location.
     *
     * Once a map is loaded _all_ nodes will carry the full url individually.
     * The namespace is just their to simplify the json format and for ease
     * of maintainance.
     *
     *
     * @param {Object} node
     * @public
     *
     */

  }, {
    key: 'addNode',
    value: function addNode(node) {
      this.createNode(node);

      return this;
    }

    /**
     *
     * Renames a node
     *
     * Renames the id of a node.
     * This should not rename the real id.
     *
     * @param {string} nodeId
     * @param {function} cb
     * @public
     */

  }, {
    key: 'renameNode',
    value: function renameNode(nodeId, cb) {
      console.log(nodeId, cb);
    }

    /**
     *
     * Removes a node
     *
     * @param {string} nodeId
     * @param {function} cb
     * @public
     */

  }, {
    key: 'removeNode',
    value: function removeNode(nodeId, cb) {
      var self = this;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.links.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var link = _step.value;

          if (link.source.id === nodeId || link.target.id === nodeId) {
            this.removeLink(link);
          }
        }

        // should wait for IO, especially there is a chance
        // system events are still spitting.

        // register and set pid
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      this.processManager.unregister(this.getNode(nodeId), function unregisterHandlerActor() {
        var oldNode = self.getNode(nodeId).export();

        self.nodes.delete(nodeId);

        self.emit('removeNode', {
          node: oldNode
        });

        if (cb) {
          cb();
        }
      });
    }
  }, {
    key: 'removeNodes',
    value: function removeNodes() {
      this.clear();
    }

    /**
     *
     * Get all nodes.
     *
     * TODO: unnecessary method
     *
     * @return {Object} nodes
     * @public
     *
     */

  }, {
    key: 'getNodes',
    value: function getNodes() {
      return this.nodes;
    }

    /**
     *
     * Check if this node exists
     *
     * @param {String} id
     * @return {Object} node
     * @public
     */

  }, {
    key: 'hasNode',
    value: function hasNode(id) {
      return this.nodes.has(id);
    }

    /**
     *
     * Get a node by it's id.
     *
     * @param {String} id
     * @return {Object} node
     * @public
     */

  }, {
    key: 'getNode',
    value: function getNode(id) {
      if (this.nodes.has(id)) {
        return this.nodes.get(id);
      } else {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = this.nodes.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var node = _step2.value;

            if (node.id === id || node.identifier === id) {
              return node;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }

      throw new Error(util.format('Node %s does not exist', id));
    }
  }]);

  return Node;
})();

Node.nodeTypes = {
  xNode: xNode
};

module.exports = Node;
//# sourceMappingURL=node.js.map

},{"../context/defaultProvider":21,"../flow":23,"../node":29,"../validate":41,"debug":"V4HZ/5","util":6}],17:[function(require,module,exports){
"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Port = (function () {
  function Port() {
    _classCallCheck(this, Port);
  }

  _createClass(Port, [{
    key: "addPort",

    /**
     *
     * Adds a port
     *
     * NOT IMPLEMENTED
     *
     * @public
     */
    value: function addPort() {
      return this;
    }

    /**
     *
     * Removes a port
     *
     * NOT IMPLEMENTED
     *
     * @public
     */

  }, {
    key: "removePort",
    value: function removePort() {
      return this;
    }
  }]);

  return Port;
})();

module.exports = Port;
//# sourceMappingURL=port.js.map

},{}],18:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Report = (function () {
  function Report() {
    _classCallCheck(this, Report);
  }

  _createClass(Report, [{
    key: 'report',

    /**
     *
     * JSON Status report about the nodes.
     *
     * Mainly meant to debug after shutdown.
     *
     * Should handle all stuff one can think of
     * why `it` doesn't work.
     *
     */
    value: function report() {
      var size = undefined;
      var qm = this.ioHandler.queueManager;

      var _report = {
        ok: true,
        flow: this.id,
        nodes: [],
        queues: []
      };

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.nodes.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var node = _step.value;

          if (node.status !== 'complete') {
            _report.ok = false;
            _report.nodes.push({
              node: node.report()
            });
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.links.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var link = _step2.value;

          if (qm.hasQueue(link.ioid)) {
            size = qm.size(link.ioid);
            _report.ok = false;
            _report.queues.push({
              link: link.toJSON(),
              port: link.target.port,
              // super weird, will be undefined if called here.
              // size: qm.size(link.ioid),
              size: size,
              node: this.getNode(link.target.id).report()
            });
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return _report;
    }
  }]);

  return Report;
})();

module.exports = Report;
//# sourceMappingURL=report.js.map

},{}],19:[function(require,module,exports){
'use strict';

var Status = {};
Status.STOPPED = 'stopped';
Status.RUNNING = 'running';

module.exports = Status;
//# sourceMappingURL=status.js.map

},{}],20:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Setting = require('./setting');

/**
 *
 * Connector
 *
 * The thing you plug into a port.
 *
 * Contains information about port and an optional
 * action to perform within the node (subgraph)
 *
 * Can also contains port specific settings.
 *
 * An xLink has a source and a target connector.
 *
 * ................... xLink ....................
 *
 *  -------------------.    .------------------
 * | Source Connector -------  Target Connector |
 *  ------------------'     `------------------
 *
 * When a link is plugged into a node, we do so
 * by plugging the target connector.
 *
 * @constructor
 * @public
 *
 */

var Connector = (function (_Setting) {
  _inherits(Connector, _Setting);

  function Connector(settings) {
    _classCallCheck(this, Connector);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Connector).call(this, settings));

    _this.wire = undefined;
    return _this;
  }

  /**
   *
   * Plug
   *
   * TODO: plug is not the correct name
   *
   * @param {String} id - TODO: not sure which id, from the node I pressume..
   * @param {String} port
   * @param {String} action
   */

  _createClass(Connector, [{
    key: 'plug',
    value: function plug(id, port, action) {
      this.id = id;
      this.port = port;
      if (action) {
        this.action = action;
      }
    }

    /**
     *
     * Create
     *
     * Creates a connector
     *
     * @param {String} id - TODO: not sure which id, from the node I pressume..
     * @param {String} port
     * @param {Object} settings
     * @param {String} action
     */

  }, {
    key: 'setPid',

    /**
     *
     * Register process id this connector handles.
     *
     */
    value: function setPid(pid) {
      this.pid = pid;
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      var ret = {
        id: this.id,
        port: this.port
      };

      if (this.setting) {
        ret.setting = JSON.parse(JSON.stringify(this.setting));
      }

      if (this.action) {
        ret.action = this.action;
      }

      return ret;
    }
  }], [{
    key: 'create',
    value: function create(id, port, settings, action) {
      var c = new Connector(settings);
      c.plug(id, port, action);
      return c;
    }
  }]);

  return Connector;
})(Setting);

module.exports = Connector;
//# sourceMappingURL=connector.js.map

},{"./setting":40}],21:[function(require,module,exports){
'use strict'

/**
 *
 * Default Context Provider
 *
 * @constructor
 * @public
 */
;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DefaultProvider = (function () {
  function DefaultProvider() {
    _classCallCheck(this, DefaultProvider);
  }

  _createClass(DefaultProvider, [{
    key: 'addContext',
    value: function addContext(node, defaultContext) {
      if (typeof defaultContext !== 'undefined') {
        node.addContext(defaultContext);
      }
    }
  }]);

  return DefaultProvider;
})();

module.exports = DefaultProvider;
//# sourceMappingURL=defaultProvider.js.map

},{}],22:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

/**
 *
 * Used to add an event handler after all events are emitted
 *
 * e.g. actor listens to output of the nodes, but it must
 * act after all other event listeners have run.
 *
 */

var AfterEmitter = (function (_EventEmitter) {
  _inherits(AfterEmitter, _EventEmitter);

  function AfterEmitter() {
    _classCallCheck(this, AfterEmitter);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AfterEmitter).call(this));

    _this._after = {};
    return _this;
  }

  _createClass(AfterEmitter, [{
    key: 'emit',
    value: function emit(type) {
      var len = arguments.length;
      var args = new Array(len - 1);
      for (var i = 1; i < len; i++) {
        args[i - 1] = arguments[i];
      }

      var ret = _get(Object.getPrototypeOf(AfterEmitter.prototype), 'emit', this).apply(this, arguments);

      if (this._after[type]) {
        this._after[type].apply(this, args);
      }

      return ret;
    }
  }, {
    key: 'setAfterListener',
    value: function setAfterListener(type, listener) {
      if (this._after[type]) {
        throw Error('after callback already registered');
      } else {
        this._after[type] = listener;
      }
    }
  }, {
    key: 'hasAfterListener',
    value: function hasAfterListener(type) {
      return Boolean(this._after[type]);
    }
  }, {
    key: 'afterListener',
    value: function afterListener(type) {
      return this._after[type];
    }
  }]);

  return AfterEmitter;
})(EventEmitter);

AfterEmitter.prototype.after = AfterEmitter.prototype.setAfterListener;

module.exports = AfterEmitter;
//# sourceMappingURL=after.js.map

},{"events":1}],23:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Packet = require('./packet');
var util = require('util');
var xLink = require('./link');
var validate = require('./validate');
var Actor = require('./actor');
var Connections = require('./ConnectionMap');
var debug = require('debug')('chix:flow');

/**
 *
 * This FlowNode extends the Actor.
 *
 * What it mainly does is delegate what it it asked to do
 * To the nodes from the actor.
 *
 * External Interface is not really needed anymore.
 *
 * Because the flow has ports just like a normal node
 *
 * @constructor
 * @public
 *
 */

var Flow = (function (_Actor) {
  _inherits(Flow, _Actor);

  function Flow(id, map, identifier, loader, ioHandler, processManager) {
    _classCallCheck(this, Flow);

    if (!id) {
      throw Error('xFlow requires an id');
    }

    if (!map) {
      throw Error('xFlow requires a map');
    }

    // Call the super's constructor

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Flow).apply(this, arguments));

    var self = _this;

    _this._delay = 0;

    if (loader) {
      _this.loader = loader;
    }

    if (ioHandler) {
      _this.ioHandler = ioHandler;
    }

    if (processManager) {
      _this.processManager = processManager;
    }

    // External vs Internal links
    _this.linkMap = new Map();

    // indicates whether this is an action instance.
    _this.actionName = undefined;

    // TODO: trying to solve provider issue
    _this.provider = map.provider;

    _this.providers = map.providers;

    _this.actions = {};

    // initialize both input and output ports might
    // one of them be empty.
    if (!map.ports) {
      map.ports = {};
    }
    if (!map.ports.output) {
      map.ports.output = {};
    }
    if (!map.ports.input) {
      map.ports.input = {};
    }

    /*
     // make available always.
     node.ports.output['error'] = {
     title: 'Error',
     type: 'object'
     };
     */

    _this.id = id;

    _this.name = map.name;

    _this.type = 'flow';

    _this.title = map.title;

    _this.description = map.description;

    _this.ns = map.ns;

    _this.active = false;

    _this.metadata = map.metadata || {};

    _this.identifier = identifier || [map.ns, ':', map.name].join('');

    _this.ports = JSON.parse(JSON.stringify(map.ports));

    // Need to think about how to implement this for flows
    // this.ports.output[':complete'] = { type: 'any' };

    _this.runCount = 0;

    _this.inPorts = Object.keys(_this.ports.input);

    _this.outPorts = Object.keys(_this.ports.output);

    //this.filled = 0;

    _this.chi = undefined;

    _this._interval = 100;

    // this.context = {};

    _this.nodeTimeout = map.nodeTimeout || 3000;

    _this.inputTimeout = typeof map.inputTimeout === 'undefined' ? 3000 : map.inputTimeout;

    _this._hold = false; // whether this node is on hold.

    _this._inputTimeout = null;

    _this._openPorts = [];

    _this._connections = new Connections();

    _this._forks = [];

    debug('%s: addMap', _this.identifier);
    _this.addMap(map);

    _this.fork = function () {

      var Fork = function Fork() {
        this.nodes = new Map();
        //this.context = {};

        // same ioHandler, tricky..
        // this.ioHandler = undefined;
      };

      // Pre-filled baseActor is our prototype
      Fork.prototype = this.baseActor;

      var FActor = new Fork();

      // Remember all forks for maintainance
      self._forks.push(FActor);

      // Each fork should have their own event handlers.
      self.listenForOutput(FActor);

      return FActor;
    };

    _this.listenForOutput();

    _this.initPortOptions = function () {

      // Init port options.
      for (var port in self.ports.input) {
        if (self.ports.input.hasOwnProperty(port)) {

          // This flow's port
          var thisPort = self.ports.input[port];

          // set port option
          if (thisPort.options) {
            for (var opt in thisPort.options) {
              if (thisPort.options.hasOwnProperty(opt)) {
                self.setPortOption('input', port, opt, thisPort.options[opt]);
              }
            }
          }
        }
      }
    };

    // Too late?
    _this.setup();

    _this.setStatus('created');
    return _this;
  }

  _createClass(Flow, [{
    key: 'action',
    value: function action(_action) {
      if (!this.actions.hasOwnProperty(_action)) {
        throw Error('this.action should return something with the action map');
        /*
         var ActionActor = this.action(action);
          // ActionActor.map.ports = this.ports;
          // not sure what to do with the id and identifier.
         // I think they should stay the same, for now.
         //
         this.actions[action] = new Flow(
         this.id,
         // ActionActor, // BROKEN
         map, // action definition should be here
         this.identifier + '::' + action
         );
          // a bit loose this.
         this.actions[action].actionName = action;
          //this.actions[action].ports = this.ports;
         */
      }

      return this.actions[_action];
    }
  }, {
    key: 'setup',
    value: function setup() {
      this.initPortOptions();
    }

    /**
     *
     * For forking it is relevant when this addContext is done.
     * Probably this addContext should be done on baseActor.
     * So subsequent forks will have the updated context.
     * Yeah, baseActor is the fingerprint, currentActor is the
     * current one, this._actors is the array of instantiated forks.
     *
     */

  }, {
    key: 'addContext',
    value: function addContext(context) {
      debug('%s: addContext', this.identifier);
      for (var port in context) {
        if (context.hasOwnProperty(port)) {
          var portDef = this.getPortDefinition(port, 'input');
          this.getNode(portDef.nodeId).setContextProperty(portDef.name, context[port]);
          // Maybe too easy, but see if it works.
          // Reset when all are filled, then fork.
          //this.filled++;
        }
      }
    }
  }, {
    key: 'setContextProperty',
    value: function setContextProperty(port, data) {
      var portDef = this.getPortDefinition(port, 'input');
      this.getNode(portDef.nodeId).setContextProperty(portDef.name, data);
    }
  }, {
    key: 'getPortType',
    value: function getPortType(kind, port) {
      if (port === ':start') {
        return 'any';
      }
      var portDef = this.getPortDefinition(port, 'input');
      var type = this.getNode(portDef.nodeId).getPortType(kind, portDef.name);
      if (type) {
        return type;
      } else {
        throw Error('Unable to determine port type');
      }
    }
  }, {
    key: 'clearContextProperty',
    value: function clearContextProperty(port) {
      var portDef = this.getPortDefinition(port, 'input');
      this.getNode(portDef.nodeId).clearContextProperty(portDef.name);
    }
  }, {
    key: 'inputPortAvailable',
    value: function inputPortAvailable(target) {
      if (target.action && !this.isAction()) {
        return this.action(target.action).inputPortAvailable(target);
      } else {
        // little bit too much :start hacking..
        // probably causes the :start problem with clock
        if (target.port === ':start') {
          return true;
        } else {
          var portDef = this.getPortDefinition(target.port, 'input');

          if (!this.linkMap.has(target.wire.id)) {
            throw Error('Cannot find internal link within linkMap');
          }

          return this.getNode(portDef.nodeId).inputPortAvailable(this.linkMap.get(target.wire.id).target);
        }
      }
    }

    // TODO: both flow & node can inherit this stuff

  }, {
    key: 'getStatus',
    value: function getStatus() {
      return this.status;
    }
  }, {
    key: 'setStatus',
    value: function setStatus(status) {
      this.status = status;
      this.event(':statusUpdate', {
        node: this.export(),
        status: this.status
      });
    }
  }, {
    key: 'error',
    value: function error(node, err) {
      var _error = util.isError(err) ? err : Error(err);

      // TODO: better to have full (custom) error objects
      var eobj = {
        node: node.export(),
        msg: err
      };

      // Update our own status, this should status be resolved
      // Create a shell? yep..
      node.setStatus('error');

      // Used for in graph sending
      node.event(':error', eobj);

      // Used by Process Manager or whoever handles the node
      node.emit('error', eobj);

      return _error;
    }
  }, {
    key: 'fill',
    value: function fill(target, p) {
      var node = undefined;

      debug('%s:%s fill', this.identifier, target.port);

      if (target.action && !this.isAction()) {
        // NOTE: action does not take fork into account?
        // test this later. it should be in the context of the currentActor.

        node = this.action(target.action);
        p.release(this);
        p.setOwner(node);
        node.fill(target, p);
      } else {
        if (target.port === ':start') {
          // :start is pushing the actor, so exposing a :start
          // port does not make much sense.
          this.event(':start', {
            node: this.export()
          });

          this.setStatus('started');
          debug('%s::start this.push()', this.identifier);
          this.push();
          return true;
        } else {
          // delegate this to the node this port belongs to.
          var portDef = this.getPortDefinition(target.port, 'input');

          node = this.getNode(portDef.nodeId);

          if (!this.linkMap.has(target.wire.id)) {
            throw Error('link not found within linkMap');
          }
          p.release(this);
          p.setOwner(node);
          var err = node.fill(this.linkMap.get(target.wire.id).target, p);

          if (util.isError(err)) {
            Flow.error(this, err);

            return err;
          } else {
            this.event(':start', {
              node: this.export()
            });

            //this.filled++;
            /*
             // fishy, also, is filled used at all for flow?
             // filled is irrelevant for flow.
             if (this.filled === this._connections.size) {
              // do not fork for now
             // this.currentActor = this.fork();
             // this.currentActor.run();
              this.filled = 0;
              }
             */

            return true;
          }
        }
      }
    }
  }, {
    key: 'setMetadata',
    value: function setMetadata(metadata) {
      this.metadata = metadata;
    }
  }, {
    key: 'setMeta',
    value: function setMeta(key, value) {
      this.metadata[key] = value;
    }

    /**
     *
     * Checks whether the port exists at the node
     * this Flow is relaying for.
     *
     * @param {String} type
     * @param {String} port
     */

  }, {
    key: 'portExists',
    value: function portExists(type, port) {
      // this returns whether this port exists for _us_
      // it only considers the exposed ports.
      var portDef = this.getPortDefinition(port, type);
      return this.getNode(portDef.nodeId).portExists(type, portDef.name);
    }

    /**
     *
     * Checks whether the port is open at the node
     * this Flow is relaying for.
     *
     * @param {String} port
     */

  }, {
    key: 'portIsOpen',
    value: function portIsOpen(port) {
      // the port open logic is about _our_ open and exposed ports.
      // yet ofcourse it should check the real node.
      // so also delegate.
      var portDef = this.getPortDefinition(port, 'input');
      // Todo there is no real true false in portIsOpen?
      // it will fail hard.
      return this.getNode(portDef.nodeId).portIsOpen(portDef.name);
    }

    /**
     *
     * Get _this_ Flow's port definition.
     *
     * The definition contains the _real_ portname
     * of the node _this_ port is relaying for.
     *
     * @param {String} port
     */

  }, {
    key: 'getPortDefinition',
    value: function getPortDefinition(port, type) {
      // uhm ok, we also need to add the start port
      if (this.ports[type].hasOwnProperty(port)) {
        return this.ports[type][port];
      } else {
        throw new Error(util.format('Unable to find exported port definition for %s port `%s` (%s:%s)\n' + '\tAvailable ports: %s', type, port, this.ns, this.name, Object.keys(this.ports[type]).toString()));
      }
    }
  }, {
    key: 'getPort',
    value: function getPort(type, name) {
      return this.getPortDefinition(name, type);
    }

    /**
     *
     * Get the port option at the node
     * this flow is relaying for.
     *
     * @param {String} type
     * @param {String} port
     * @param {String} option
     */

  }, {
    key: 'getPortOption',
    value: function getPortOption(type, port, option) {
      // Exposed ports can also have options set.
      // if this is _our_ port (it is exposed)
      // just delegate this to the real node.
      var portDef = this.getPortDefinition(port, type);
      // Todo there is no real true false in portIsOpen?
      // it will fail hard.
      return this.getNode(portDef.nodeId).getPortOption(type, portDef.name, option);
    }

    /**
     *
     * Sets an input port option.
     *
     * The node schema for instance can specifiy whether a port is persistent.
     *
     * At the moment a connection can override these values.
     * It's a way of saying I give you this once so take care of it.
     *
     * Ok, with forks running this should eventually be much smarter.
     * If there are long running flows, all instances should have their
     * ports updated.
     *
     * Not sure when setPortOption is called, if it is called during 'runtime'
     * there is no problem and we could just set it on the current Actor.
     * I could also just already fix it and update baseActor and all _actors.
     * which would be sufficient.
     */

  }, {
    key: 'setPortOption',
    value: function setPortOption(type, port, opt, value) {
      var portDef = this.getPortDefinition(port, type);
      this.getNode(portDef.nodeId).setPortOption(type, portDef.name, opt, value);
    }
  }, {
    key: 'openPort',
    value: function openPort(port) {
      if (this._openPorts.indexOf(port) === -1) {
        this._openPorts.push(port);
      }
    }
  }, {
    key: 'isAction',
    value: function isAction() {
      return Boolean(this.actionName);
    }

    // TODO: implement

  }, {
    key: 'unplug',
    value: function unplug(target) {
      if (target.action && !this.isAction()) {
        this.action(target.action).unplug(target);
      } else {
        // unplug logic
      }
    }

    /**
     *
     * Set port to open state
     *
     * This is a problem, xFlow has it's ports opened.
     * However this also means baseActor and all the forks
     * Should have their ports opened.
     *
     * Ok, not a problem, only that addition of the :start port
     * is a problem. Again not sure at what point plug()
     * is called. I think during setup, but later on also
     * in realtime. anyway for now I do not care so much about
     * realtime. Doesn't make sense most of the time.
     *
     * @param {Connector} target
     * @public
     */

  }, {
    key: 'plug',
    value: function plug(target) {
      if (target.action && !this.isAction()) {
        this.action(target.action).plug(target);
      } else {
        if (target.port === ':start') {
          this.addPort('input', ':start', {
            name: ':start',
            type: 'any'
          });
        }

        // delegate this to the real node
        // only if this is one of _our_ exposed nodes.
        //var portDef = this.getPortDefinition(target.port, 'input');
        var portDef = this.getPortDefinition(target.port, 'input');

        // start is not an internal port, we will do a push on the internal
        // actor and he may figure it out..
        //if (target.port !== ':start') {
        if (target.port !== ':start') {
          // The Node we are gating for
          var internalNode = this.getNode(portDef.nodeId);

          var xlink = new xLink();
          // just define our node as the source, and the external port
          xlink.setSource(this.id, target.port, {}, target.action);
          xlink.setTarget(target.id, portDef.name, {}, target.action);

          for (var k in target.setting) {
            if (target.setting.hasOwnProperty(k)) {
              xlink.target.set(k, target.setting[k]);
            }
          }

          // fixed settings
          if (portDef.hasOwnProperty('setting')) {
            for (var k in portDef.setting) {
              if (portDef.setting.hasOwnProperty(k)) {
                xlink.target.set(k, portDef.setting[k]);
              }
            }
          }

          internalNode.plug(xlink.target);

          // Copy the port type, delayed type setting, :start is only known after
          // the port is opened...
          this.ports.input[target.port].type = internalNode.ports.input[xlink.target.port].type;

          // we add our internalLink as reference to our link.
          // a bit of a hack, it's not known by the definition of
          // Link itself
          target.wire.internalLink = xlink;

          // outer/inner mapping
          this.linkMap.set(target.wire.id, xlink);
        } else {}
        // what to do with start port?

        // use same logic for our own ports
        if (!this._connections.hasOwnProperty(target.port)) {
          this._connections[target.port] = [];
        }

        this._connections[target.port].push(target.wire);

        this.openPort(target.port);
      }
    }
  }, {
    key: 'exposePort',
    value: function exposePort(type, nodeId, port, name) {
      var node = this.getNode(nodeId);

      if (node.ports[type]) {
        for (var p in node.ports[type]) {
          if (node.ports[type].hasOwnProperty(p)) {
            if (p === port) {
              // not sure, is this all info?
              this.addPort(type, name, {
                nodeId: nodeId,
                name: port
              });

              continue;
            }
          }
        }
      }

      this.emit('addPort', {
        node: this.export(),
        port: name
      });
    }
  }, {
    key: 'removePort',
    value: function removePort(type, name) {
      if (this.ports[type][name]) {
        delete this.ports[type][name];

        this.emit('removePort', {
          node: this.export(),
          port: name
        });
      }
    }
  }, {
    key: 'renamePort',
    value: function renamePort(type, from, to) {
      if (this.ports[type][from]) {
        this.ports[type][to] = JSON.parse(JSON.stringify(this.ports[type][from]));

        // update links pointing to us.
        // updates ioHandler also because it holds
        // references to these links
        // TODO: pid/id warning...
        // renaming will only update this instance.
        // accidently these links will make each instance
        // point to the new ports, however not each instance
        // has it's port renamed..
        // For rename it's better to stop the graph
        // update the definition itself then start it again
        // Because for instance the io handler will still send
        // to old ports.
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = this.links.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var link = _step.value;

            if (type === 'input' && link.target.id === this.id && link.target.port === from) {

              link.target.port = to;
            } else if (type === 'output' && link.source.id === this.id && link.source.port === from) {

              link.source.port = to;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        delete this.ports[type][from];

        this.emit('renamePort', {
          node: this.export(),
          from: from,
          to: to
        });
      }
    }
  }, {
    key: 'addPort',
    value: function addPort(type, name, def) {
      // add it to known ports
      if (!this.ports[type]) {
        this.ports[type] = {};
      }

      this.ports[type][name] = def;

      if (type === 'input') {
        this.inPorts = Object.keys(this.ports[type]);
      } else {
        this.outPorts = Object.keys(this.ports[type]);
      }
    }

    /**
     *
     * Close the port of the node we are relaying for
     * and also close our own port.
     *
     * @param {String} port
     */

  }, {
    key: 'closePort',
    value: function closePort(port) {
      // delegate this to the real node
      // only if this is one of _our_ exposed nodes.
      var portDef = this.getPortDefinition(port, 'input');

      if (port !== ':start') {
        this.getNode(portDef.nodeId).closePort(portDef.name);
        // this._forks.forEach(function(fork) {
        //  fork.getNode(portDef.nodeId).closePort(portDef.name);
        //});
      }

      if (this.ports.input[port]) {
        this._openPorts.splice(this._openPorts.indexOf(port), 1);
      }

      this._connections[port].pop();
    }
  }, {
    key: 'hasConnections',
    value: function hasConnections() {
      return this._openPorts.length;
    }

    /**
     *
     * Puts this flow on hold.
     *
     * NOT IMPLEMENTED YET
     *
     * This should stop each and every fork.
     *
     */

  }, {
    key: 'hold',
    value: function hold() {
      // implement later, holds input for _this_ flow
      this._hold = true;
      this.stop();
      /*
       this._forks.forEach(function(fork) {
       fork.stop();
       });
       */
    }

    /**
     *
     * Releases the node if it was on hold
     *
     * This should resume each and every fork.
     *
     * @public
     */

  }, {
    key: 'release',
    value: function release() {
      // TODO: these are all just on the actor, not sure Flow also needs it.

      this._hold = false;
      this.resume();
      /*
       this._forks.forEach(function(fork) {
       fork.resume();
       });
       */
    }

    /**
     *
     * Complete function
     *
     * @public
     */

  }, {
    key: 'complete',
    value: function complete() {
      // todo: check this.ready stuff logic.
      this.ready = false;
      this.active = false;
    }
  }, {
    key: 'portHasConnection',
    value: function portHasConnection(port, link) {
      if (this._connections.hasOwnProperty(port)) {
        return this._connections[port].indexOf(link) >= 0;
      } else {
        return false;
      }
    }
  }, {
    key: 'portHasConnections',
    value: function portHasConnections(port) {
      if (this._connections.hasOwnProperty(port)) {
        return this._connections[port].length >= 0;
      } else {
        return false;
      }
    }
  }, {
    key: 'portGetConnections',
    value: function portGetConnections(port) {
      return this._connections[port];
    }

    /**
     *
     * Listen for output on 'our' ports
     *
     * The internal Actor will actually listen just like the normal actor.
     *
     * @public
     */

  }, {
    key: 'listenForOutput',
    value: function listenForOutput() {
      var self = this;

      // not really used yet, but this would envolve just
      // commanding all nodes to shutdown,
      // which will be a simple loop.
      // baseActor loop doesn't make much sense but ah well.
      //
      function outputHandler(port, internalPort) {
        return function internalPortHandlerFlow(data) {
          if (internalPort === data.port) {
            var p = data.out;

            // take ownership
            p.setOwner(self);

            debug('%s:%s output', self.identifier, port);
            self.sendPortOutput(port, p);

            // there is no real way to say a graph has executed.
            // So just consider each output as an execution.
            // TODO: a bit expensive
            self.event(':executed', {
              node: self.export()
            });
          }
        };
      }

      function freePortHandler(externalPort, internalPort) {
        return function freePortHandlerFlow(event) {
          if (internalPort === event.port) {
            if (self._connections.hasOwnProperty(externalPort)) {
              var extLink;
              var conns = self._connections[externalPort];
              for (var i = 0; i < conns.length; i++) {
                if (conns[i].internalLink === event.link) {
                  extLink = conns[i];
                  break; // yeay..
                }
              }

              if (!extLink) {
                throw Error('Cannot determine outer link');
              } else {
                debug('%s:%s :freePort', self.identifier, externalPort);
                self.event(':freePort', {
                  node: self.export(),
                  link: extLink,
                  port: externalPort
                });

                self.emit('freePort', {
                  node: self.export(),
                  link: extLink,
                  port: externalPort
                });
              }
            } else {
              // no connections.
            }
          }
        };
      }

      var internalNode = undefined;
      var internalPort = undefined;
      if (this.ports.output) {
        for (var port in this.ports.output) {
          if (this.ports.output.hasOwnProperty(port)) {
            internalPort = this.ports.output[port];
            // These bypass the IOHandler, but that's ok, they
            // are just external internal port mappings.
            internalNode = this.getNode(internalPort.nodeId);
            internalNode.on('output', outputHandler(port, internalPort.name));
          }
        }
      }

      if (this.ports.input) {
        for (var port in this.ports.input) {
          if (this.ports.input.hasOwnProperty(port)) {
            internalPort = this.ports.input[port];
            // These bypass the IOHandler, but that's ok, they
            // are just external internal port mappings.
            internalNode = this.getNode(internalPort.nodeId);
            internalNode.on('freePort', freePortHandler(port, internalPort.name));
          }
        }
      }
    }

    /**
     *
     * Runs the shutdown method of the blackbox
     *
     * NOT IMPLEMENTED
     *
     * @public
     */

  }, {
    key: 'shutdown',
    value: function shutdown() {}
    // not really used yet, but this would envolve just
    // commanding all nodes to shutdown,
    // which will be a simple loop.

    /**
     *
     * Return a serializable export of this flow.
     *
     * @public
     */

  }, {
    key: 'export',
    value: function _export() {
      return {
        id: this.id,
        pid: this.pid,
        ns: this.ns,
        name: this.name,
        identifier: this.identifier,
        ports: this.ports,
        // cycles: this.cycles,
        inPorts: this.inPorts,
        outPorts: this.outPorts,
        //filled: this.filled,
        // context: this.context,
        active: this.active,
        provider: this.provider,
        // input: this._filteredInput(),
        openPorts: this._openPorts
        // nodeTimeout: this.nodeTimeout,
        // inputTimeout: this.inputTimeout
      };
    }

    /**
     *
     * Export this modified instance to a nodedefinition.
     *
     * @public
     */

  }, {
    key: 'toJSON',
    value: function toJSON() {
      var def = {
        id: this.id,
        ns: this.ns,
        name: this.name,
        title: this.title,
        type: this.type,
        description: this.description,
        // should not be the full nodes
        nodes: [],
        links: [],
        ports: this.ports,
        providers: this.providers
      };

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.nodes.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var node = _step2.value;

          def.nodes.push(node.toJSON());
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = this.links.values()[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var link = _step3.value;

          def.links.push(link.toJSON());
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      validate.flow(def);

      return def;
    }
  }, {
    key: 'isStartable',
    value: function isStartable() {
      // err ok, how to determine this.
      // a flow is always startable?
      // ok for now it is..
      // it should'nt though..
      return true;
    }
  }, {
    key: 'event',
    value: function event(port, output) {
      var p = new Packet(this, output, 'object' // always object
      );
      this.sendPortOutput(port, p);
    }
  }, {
    key: 'sendPortOutput',
    value: function sendPortOutput(port, p) {
      // important identifies from what action this output came.
      // used by connections to determine if it should consume
      // the output.

      var out = {
        node: this.export(),
        port: port,
        out: p
      };

      if (this.isAction()) {
        out.action = this.action;
      }

      // give up ownership
      p.release(this);

      this.emit('output', out);
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      // just ask all nodes to destroy themselves
      // and finally do the same with self
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = this.nodes.values()[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var node = _step4.value;

          node.destroy();
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }
  }, {
    key: 'setPid',
    value: function setPid(pid) {
      this.pid = pid;
    }

    /**
     *
     * Create an xFlow
     *
     * Some kind of logic as the actor
     *
     * @public
     */

  }, {
    key: 'reset',
    value: function reset() {
      this.runCount = 0;
      //this.filled = 0;

      // ask all our nodes to reset.
      // TODO: will be done double if the IO manager
      // also ask all nodes to reset itself.
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = this.nodes.values()[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var node = _step5.value;

          node.reset();
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5.return) {
            _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }
    }

    /**
     *
     * Helper function to make the flow an npm module itself.
     *
     * Usage:
     *
     *   Ok, here is the clash...
     *   xFlow needs way to much information to initialize.
     *   It should have the same interface as actor.
     *
     *   var xflow = new xFlow:create(map, loader);
     *   xflow.addMap(map);
     *
     *   module.exports = xflow.expose;
     *
     *   ---
     *
     *   var flow = require('my-flow');
     *
     *   flow({
    *     in: 'some_data',
    *     in2: 'other_data'
    *   }, {
    *     out: function(data) {
    *       // do something with data..
    *     }
    *   });
     *
     * Ok, then what about the actions.
     *
     */

  }, {
    key: 'expose',
    value: function expose(input, output) {
      var iips = [];
      var key;
      var self = this;
      if (this.hasOwnProperty('ports')) {
        if (this.ports.hasOwnProperty('input')) {
          for (key in input) {
            if (input.hasOwnProperty(key)) {
              var iip;
              var inputPorts = this.ports.input;

              if (inputPorts.hasOwnProperty(key)) {
                iip = {
                  target: {
                    id: inputPorts[key].nodeId,
                    port: inputPorts[key].name
                  },
                  data: input[key]
                };

                iips.push(iip);

                // Within the exposed ports these should
                // already be set if they must be used.
                // (implement that) they are not properties
                // a caller should set.
                //
                // target.settings,
                // target.action
              } else {
                  throw Error(util.format('No such input port %s', key));
                }
            }
          }
        } else {
          throw Error('The map provided does not have any input ports available');
        }

        if (output) {
          var cb = output;

          if (this.ports.hasOwnProperty('output')) {
            /////// setup callbacks
            this.on('output', function output(data) {
              if (data.node.id === self.id && cb.hasOwnProperty(data.port)) {
                // TODO: does not take ownership into account
                cb[data.port](data.out);
              }
            });
          } else {
            throw Error('The map provided does not have any output ports available');
          }
        }
      } else {
        throw Error('The map provided does not have any ports available');
      }

      // start it all
      if (iips.length) {
        this.sendIIPs(iips);
      }

      this.push();

      return this;
    }
  }, {
    key: 'getConnections',
    value: function getConnections() {
      return this._connections;
    }

    /**
     *
     * Adds the parent Actor.
     *
     * For now this is only used to copy the events.
     *
     * It causes all nested actors to report to the root
     * actor's listeners.
     *
     * Rather important, otherwise you would
     * only get the events from the first root Actor/Flow
     *
     * @param {Object} actor
     */

  }, {
    key: 'setParent',
    value: function setParent(actor) {
      this.parent = actor;
    }
  }, {
    key: 'getParent',
    value: function getParent() {
      return this.parent;
    }
  }, {
    key: 'hasParent',
    value: function hasParent() {
      return Boolean(this.parent);
    }
  }], [{
    key: 'create',
    value: function create(map, loader, ioHandler, processManager) {
      var actor = new Flow(map.id, map, map.ns + ':' + map.name, loader, ioHandler, processManager);

      return actor;
    }
  }]);

  return Flow;
})(Actor);

module.exports = Flow;
//# sourceMappingURL=flow.js.map

},{"./ConnectionMap":11,"./actor":12,"./link":26,"./packet":31,"./validate":41,"debug":"V4HZ/5","util":6}],24:[function(require,module,exports){
'use strict';

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

var util = require('util');

/**
 *
 * Handles the index
 *
 * TODO: packet is still needed, because index is set
 *
 * @param {Link} link
 * @param {Data} data
 * @param {Packet} p
 * @public
 */
function handleIndex(link, data, p) {
  // TODO: data should be better defined and a typed object
  var index = link.source.get('index');
  if (/^\d+/.test(index)) {
    // numeric
    if (Array.isArray(data)) {
      if (index < data.length) {
        // new remember index.
        p.point(link, index);
        //p.index = index;
        //return data[index];
      } else {
          throw new Error(util.format('index[] out-of-bounds on array output port `%s`', link.source.port));
        }
    } else {
      throw new Error(util.format('Got index[] on array output port `%s`, ' + 'but data is not of the array type', link.source.port));
    }
  } else {
    if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object') {
      if (data.hasOwnProperty(index)) {
        // TODO: test with dot-object
        // new remember index.
        p.point(link, index);
        //p.index = index;
        //return data[index];
      } else {
          // maybe do not fail hard and just send to the error port.
          console.log(p);
          throw new Error(util.format('Property `%s` not found on object output port `%s`', index, link.source.port));
        }
    } else {
      throw new Error(util.format('Got index[] on non-object output port %s', link.source.port));
    }
  }
}

module.exports = handleIndex;
//# sourceMappingURL=indexHandler.js.map

},{"util":6}],25:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Packet = require('../packet');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var CHI = require('chix-chi');
var uuid = require('uuid').v4;
var handleIndex = require('./indexHandler');
//const isPlainObject = require('is-plain-object');
var DefaultQueueManager = require('../queue/defaultManager');
var debug = require('debug')('chix:io');

/**
 *
 * This is the IoMap Handler
 *
 * It should know:
 *
 *  - the connections.
 *  - address of the source UUID + port name
 *  - address of the target UUID + port name
 *  - relevant source & target connection settings.
 *
 * Connection settings can overlap with port settings.
 * Connection settings take precedence over port settings,
 * althought this is not set in stone.
 *
 * @constructor
 * @public
 *
 **/

var IoMapHandler = (function (_EventEmitter) {
  _inherits(IoMapHandler, _EventEmitter);

  function IoMapHandler() {
    _classCallCheck(this, IoMapHandler);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(IoMapHandler).call(this));

    _this.CHI = new CHI();
    // todo: create maps from each of these and wrap them in a connections map
    // so all there wil be is this.connections.
    // connections.byTarget, connections.bySource etc.
    _this.targetMap = new Map();
    _this.sourceMap = new Map();
    _this.connections = new Map();
    _this.syncedTargetMap = new Map();
    _this.pointerPorts = new Map();
    _this._shutdown = false;
    _this.addQueueManager(new DefaultQueueManager(_this.receiveFromQueue.bind(_this)));
    _this.addCHI(_this.CHI);
    return _this;
  }

  _createClass(IoMapHandler, [{
    key: 'addCHI',
    value: function addCHI(CHI) {
      this.CHI = CHI;
      this.CHI.on('begingroup', this.beginGroup.bind(this));
      this.CHI.on('endgroup', this.sendGroup.bind(this));
      this.CHI.on('collected', this.collected.bind(this));
      this.CHI.on('synced', this.sendSynced.bind(this));
    }

    /**
     *
     * Connects ports together using the link information provided.
     *
     * @param {xLink} link
     * @public
     */

  }, {
    key: 'connect',
    value: function connect(link) {
      if (!link.source) {
        throw Error('Link requires a source');
      }
      if (!link.source.pid) {
        link.source.pid = link.source.id;
      }
      // TODO: quick fix, which never works..
      // ioHandler is the only one assigning these..
      // a link with ioid set should be rejected..
      if (!link.ioid) {
        link.ioid = uuid();
      }
      if (!link.target) {
        throw Error('Link requires a target');
      }
      if (!link.target.pid) {
        link.target.pid = link.target.id;
      }
      // register the connection
      this.connections.set(link.ioid, link);
      if (!this.targetMap.has(link.source.pid)) {
        this.targetMap.set(link.source.pid, []);
      }
      this.targetMap.get(link.source.pid).push(link);
      if (!this.sourceMap.has(link.target.pid)) {
        this.sourceMap.set(link.target.pid, []);
      }
      this.sourceMap.get(link.target.pid).push(link);
      // build the syncedTargetMap, it contains a port array
      // (the group that wants a sync with some originId
      if (link.target.has('sync')) {
        if (!this.syncedTargetMap.has(link.target.pid)) {
          this.syncedTargetMap.set(link.target.pid, {});
        }
        if (!this.syncedTargetMap.get(link.target.pid)[link.target.get('sync')]) {
          this.syncedTargetMap.get(link.target.pid)[link.target.get('sync')] = [];
        }
        this.syncedTargetMap.get(link.target.pid)[link.target.get('sync')].push(link.target.port);
        debug('%s: syncing source port `%s` with target port %s', link.ioid, link.target.get('sync'), link.target.port);
      }
      if (link.source.get('pointer')) {
        if (!this.pointerPorts.has(link.source.pid)) {
          this.pointerPorts.set(link.source.pid, []);
        }
        this.pointerPorts.get(link.source.pid).push(link.source.port);
        debug('%s: added pointer port `%s`', link.ioid, link.source.port);
      }

      debug('%s: link connected', link.ioid);

      this.emit('connect', link);
    }

    // TODO: ugly, source & target map
    // should be one central place of registration.
    // now a link is in two places.

  }, {
    key: 'get',
    value: function get(link) {
      if (this.sourceMap.has(link.target.pid)) {
        return this.sourceMap.get(link.target.pid);
      }
    }
  }, {
    key: 'lock',
    value: function lock(link) {
      debug('%s: lock', link.ioid);
      this.queueManager.lock(link.ioid);
    }
  }, {
    key: 'unlock',
    value: function unlock(link) {
      debug('%s: unlock', link.ioid);
      this.queueManager.unlock(link.ioid);
    }
  }, {
    key: 'accept',
    value: function accept(link /*, p*/) {
      debug('%s: accept', link.ioid);
      // update the fill count.
      // normally belongs to a Port Object.
      link.fills++;
      // re-open queue for this link.
      if (this.queueManager.isLocked(link.ioid)) {
        // freePort will do this now.
        this.queueManager.unlock(link.ioid);
      }
    }
  }, {
    key: 'reject',
    value: function reject(err, link, p) {
      // update the reject count.
      // normally belongs to a Port Object.
      link.rejects++;
      this.queueManager.lock(link.ioid);
      // Do not put it back in queue if there was a *real* error
      // Default error is `false`, which is just a normal reject.
      if (util.isError(err)) {
        debug('%s: reject (error)', link.ioid);
        // stays locked.
      } else {
          // put it back in queue.
          debug('%s: reject (requeue)', link.ioid);
          this.queueManager.unshift(link.ioid, p);
          // unlock again
          // stay locked, untill unlocked
          // IMPORTANT! unlock logic must just work
          // otherwise it goes beserk.
          // this.queueManager.unlock(link.ioid);
          // The process manager is listening for the node
          // which is already in error state
          // this.emit('error', err);
        }
    }

    /**
     *
     *  Disconnects a link
     *
     *  @param {xLink} link
     */

  }, {
    key: 'disconnect',
    value: function disconnect(link) {
      var src = undefined;
      var tgt = undefined;
      // unregister the connection
      if (this.connections.has(link.ioid)) {
        this.connections.delete(link.ioid);
      } else {
        throw Error('Cannot disconnect an unknown connection');
      }
      if (this.targetMap.has(link.source.pid)) {
        src = this.targetMap.get(link.source.pid);
        src.splice(src.indexOf(link), 1);
        if (src.length === 0) {
          this.targetMap.delete(link.source.pid);
        }
      }
      if (this.sourceMap.has(link.target.pid)) {
        tgt = this.sourceMap.get(link.target.pid);
        tgt.splice(tgt.indexOf(link), 1);
        if (tgt.length === 0) {
          this.sourceMap.delete(link.target.pid);
        }
      }
      if (this.syncedTargetMap.has(link.target.pid)) {
        tgt = this.syncedTargetMap.get(link.target.pid);
        tgt.splice(src.indexOf(link.target.port), 1);
        if (tgt.length === 0) {
          this.syncedTargetMap.delete(link.target.pid);
        }
      }
      if (this.pointerPorts.has(link.source.pid)) {
        src = this.pointerPorts.get(link.source.pid);
        src.splice(src.indexOf(link.source.port), 1);
        if (src.length === 0) {
          this.pointerPorts.delete(link.source.pid);
        }
      }
      debug('%s: disconnected', link.ioid);
      // prevents iip bug, where iip is still queued.
      // disconnect does not correctly take queueing into account.
      delete link.ioid;

      // used by actor to close ports
      this.emit('disconnect', link);
    }

    /**
     *
     * Get all node ids that target this node.
     *
     * TODO: return .id's not .pid ah well..
     *
     * @param {String} pid
     * @return {Array}
     * @public
     */

  }, {
    key: 'getSourcePids',
    value: function getSourcePids(pid) {
      var src = undefined;
      var ids = [];
      if (this.sourceMap.has(pid)) {
        for (var i = 0; i < this.sourceMap.get(pid).length; i++) {
          src = this.sourceMap.get(pid)[i].source;
          if (ids.indexOf(src.pid) === -1) {
            ids.push(src.pid);
          }
        }
      }
      return ids;
    }

    /**
     *
     * Get all nodes that use this node as a source .
     *
     * @param {String} pid
     * @return {Array}
     * @public
     */

  }, {
    key: 'getTargetPids',
    value: function getTargetPids(pid) {
      var ids = [];
      if (this.targetMap.has(pid)) {
        for (var i = 0; i < this.targetMap.get(pid).length; i++) {
          ids.push(this.targetMap.get(pid)[i].target.pid);
        }
      }
      return ids;
    }

    /**
     *
     * Get all node ids this node depends on.
     *
     * @param {String} pid
     * @return {Array}
     * @public
     */

  }, {
    key: 'getAncestorPids',
    value: function getAncestorPids(pid) {
      var ids = undefined;
      var aIds = undefined;
      var u = [];
      aIds = ids = this.getSourcePids(pid);
      for (var i = 0; i < ids.length; i++) {
        aIds = aIds.concat(this.getAncestorPids(ids[i]));
      }
      for (var i = 0; i < aIds.length; i++) {
        if (u.indexOf(aIds[i]) === -1) {
          u.push(aIds[i]);
        }
      }
      return u;
    }
  }, {
    key: 'reset',
    value: function reset(cb) {
      var _this2 = this;

      this._shutdown = true;
      this.queueManager.reset(function () {
        // All writes should stop, queuemanager resets.
        // or maybe should wait for queuemanager to be empty.
        if (cb) {
          cb();
        }
        _this2._shutdown = false;
      });
    }
  }, {
    key: 'receiveFromQueue',
    value: function receiveFromQueue(ioid, p) {
      debug('%s: receive from queue', ioid);
      if (this.connections.has(ioid)) {
        this.send(this.connections.get(ioid), p);
      }
    }

    /**
     *
     * The method to provide input to this io handler.
     *
     * @param {Link} link
     * @param {Packet} p
     *
     */

  }, {
    key: 'send',
    value: function send(link, p) {
      if (!(p instanceof Packet)) {
        throw Error('send expects a packet');
      }

      if (link.source.has('pointer')) {
        // is just a boolean
        debug('%s: handling pointer', link.ioid);
        // THIS IS NOT THE PLACE TO CLONE, but let's try it.
        // WILL BREAK ANYWAY WITH references.
        //
        // Ok, what is _the_ location to clone.
        //
        // A package going different routes must clone.
        //
        // p = p.clone();
        // Create an identifier
        var pp = this.getPointerPorts(link.source.pid);
        pp.unshift(link.source.pid);
        var identifier = pp.join('-');
        // The source node+port are pointed to.
        // The packet has it's chi updated with the
        // source.pid as key and an assigned item id as value
        //
        this.CHI.pointer(link.source.pid, link.source.port, p, identifier);
      }
      if (link.target.has('sync')) {
        debug('%s: handling sync port', link.ioid);
        var syncPorts = this.getSyncedTargetPorts(link.target);
        this.CHI.sync(
        //link.target,
        link, link.target.get('sync'), // originId
        // TODO: should just only accept the packet
        p, syncPorts);
        // always return, react on CHI.on('synced')
        return;
      }
      this.__sendData(link, p);
    }

    /**
     *
     * The method to provide input to this io handler.
     *
     * Ok, what misses here is info on how to find the actor
     * Who needs the information
     *
     *
     * Actor:
     *
     *  ioHandler.listenTo(Object.keys(this.nodes),
     *
     * @param {Connector} target
     * @param {object} input
     * @param {object} chi
     * @private
     */

    /*
     *
     * Send Data
     *
     * @param {xLink} link - Link to write to
     * @param {Any} data - The input data
     * @private
     */

  }, {
    key: '__sendData',
    value: function __sendData(link, p) {
      if (this._shutdown) {
        // TODO:: probably does not both have to be dropped
        // during __sendData *and* during output
        p.release(link);
        this.drop(p, link);
      } else {
        if (link.target.has('cyclic') && Array.isArray(p.read(link)) // second time it's not an array anymore
        ) {
            debug('%s: cycling', link.ioid);
            // grouping
            // The counter part will be 'collect'
            var g = this.CHI.group();
            if (p.read(link).length === 0) {
              return false;
            }
            var data = JSON.parse(JSON.stringify(p.read(link)));
            for (var i = 0; i < data.length; i++) {
              // create new packet
              var newp = new Packet(link, data[i], _typeof(data[i]) // not sure if this will always work.
              );
              // this is a copy taking place..
              newp.set('chi', p.chi ? JSON.parse(JSON.stringify(p.chi)) : {});
              g.item(newp.chi);
              this.queueManager.queue(link.ioid, newp);
            }
            // we are done grouping now.
            g.done();
            return null; // RETURN
          }
        var cp = undefined; // current packet

        // clone should not be needed, this is done elsewhere.
        // cp is also not needed
        // this.cloneData(link, cp, 'function');
        // TODO: not sure if index should stay within the packet.
        if (link.source.has('index') && !p.hasOwnProperty('index')) {
          // already done during clone
          //cp.chi = JSON.parse(JSON.stringify(cp.chi));
          //const cp = p.clone(link); // important!
          cp = p.clone(link); // important!
          if (undefined === cp.read(link)[link.source.get('index')]) {
            debug('%s: INDEX UNDEFINED %s', link.ioid, link.source, cp.read(link));
            return null; // nop
          } else {
              handleIndex(link, cp.read(link), cp);
              //cp.write(link, handleIndex(link, cp.read(link), cp));
            }
        } else {
            cp = p;
          }
        // TODO: probably just remove this emit. (chix-runtime is using it)
        this.emit('data', {
          link: link,
          data: cp.read(link) // only emit the data
        });

        debug('%s: writing packet', link.ioid);

        link.write(cp);
        this.emit('receive', link);
      }
    }

    /**
     *
     * Handles the output of every node.
     *
     * This comes directly from the Actor, whom got it from the node.
     *
     * The emit should maybe come from the link write.
     *
     * If there is chi it will be passed along.
     *
     * @param {NodeEvent} event
     * @public
     */

  }, {
    key: 'output',
    value: function output(event) {
      // used by monitors
      this.emit('output', event);
      this.receive(event.node, event.port, event.out, event.action);
    }

    /**
     *
     * Monitor event types
     *
     * Optionally provided with a pid.
     *
     */

  }, {
    key: 'monitor',
    value: function monitor(eventType, pid, cb) {
      this.__monitor(eventType, pid, cb, 'on');
    }
  }, {
    key: 'monitorOnce',
    value: function monitorOnce(eventType, pid, cb) {
      this.__monitor(eventType, pid, cb, 'once');
    }
  }, {
    key: '__monitor',
    value: function __monitor(eventType, pid, cb, how) {
      debug('start monitoring %s', eventType);
      if (!cb) {
        cb = pid;
        pid = undefined;
      }
      var monitor = (function (pid, eventType, cb) {
        return function monitorCallback(event) {
          if (event.port === eventType) {
            if (!pid || event.node.pid === pid) {
              cb(event.out);
            }
          }
        };
      })(pid, eventType, cb);
      this[how]('output', monitor);
    }

    /**
     *
     * Handles the output of every node.
     *
     * If there is chi it will be passed along.
     *
     * @param {Object} dat
     * @private
     */

    /*
     *  source.id
     *  source.port
     *  action should be in the source?
     *
     *  action is target information, but is the only setting used..
     *  so just have the third parameter be action for now.
     *
     *  source is the full source node.
     **/
    //  this.receive(dat.node, dat.port, dat.out, dat.action);

  }, {
    key: 'receive',
    value: function receive(source, port, p, action) {
      var match = 0;

      if (p.hasOwner()) {
        // node should have released packet.
        this.emit('error', Error('Refusing to receive owned packet'), p);
        return;
      } else {
        // If the output of this node has any target nodes
        if (this.targetMap.has(source.pid)) {
          // If there are any target nodes defined
          if (this.targetMap.get(source.pid).length) {
            // Iterate those targets
            var length = this.targetMap.get(source.pid).length;
            for (var i = 0; i < length; i++) {
              // Process this link
              var xlink = this.targetMap.get(source.pid)[i];
              // If the link is about this source port
              if (port === xlink.source.port) {
                match++;
                // did this output came from an action
                // if so, is it an action we are listening for.
                if (!action || xlink.source.action === action) {
                  if (xlink.source.get('collect')) {
                    debug('%s: collecting packets', xlink.ioid);
                    this.CHI.collect(xlink, p);
                    continue; // will be handled by event
                  }
                  //const noQueue = xlink.target.has('noqueue');
                  var noQueue = false;
                  this.emit('send', xlink);

                  p.setOwner(xlink);

                  // queue must always be used otherwise persist
                  // will not work..
                  if (noQueue) {
                    // must be sure, really no queue, also not after input.
                    this.send(xlink, p);
                  } else {
                    debug('%s: queueing', xlink.ioid);
                    this.queueManager.queue(xlink.ioid, p);
                  }

                  if (i + 1 < length) {
                    p = p.clone(xlink);
                    p.release(xlink);
                  }
                }
              }
            }
          }
        }

        if (port === 'error' && match === 0) {
          throw Error(util.format('Unhandled port error for %s: %s', source.id, p.dump()));
        }
      }
    }

    // collected is about the link
    // a group is collected for that link
    // and is thus always an array.
    // this means the target should be used to re-send
    // the collected input.
    // the group information is actually not interesting.
    // we only know we want the data from the last group.
    // and use it.

  }, {
    key: 'collected',
    value: function collected() /*target, p*/{
      /*
       data.data
       data.link
       */
    }
  }, {
    key: 'beginGroup',
    value: function beginGroup() /*group*/{}
  }, {
    key: 'sendGroup',
    value: function sendGroup() /*group, data*/{}
    /*
     data.data
     data.link
     */

    /**
     *
     * Add Queue Manager.
     *
     * @param {QueueManager} qm
     * @private
     *
     */

  }, {
    key: 'addQueueManager',
    value: function addQueueManager(qm) {
      this.queueManager = qm;
    }
  }, {
    key: 'getSyncedTargetPorts',
    value: function getSyncedTargetPorts(target) {
      var originId = target.get('sync');
      if (!this.syncedTargetMap.has(target.pid)) {
        throw new Error(util.format('Unkown sync: `%s`', target.pid));
      }
      if (!this.syncedTargetMap.get(target.pid).hasOwnProperty(originId)) {
        throw new Error(util.format('Unkown sync with: `%s`', originId));
      }
      // returns the ports array, those who wanna sync with originId
      return this.syncedTargetMap.get(target.pid)[originId];
    }
  }, {
    key: 'getPointerPorts',
    value: function getPointerPorts(originId) {
      if (this.pointerPorts.has(originId)) {
        return this.pointerPorts.get(originId);
      } else {
        throw new Error(util.format('%s has no pointer ports', originId));
      }
    }

    /**
     *
     * Send synchronized input
     *
     * TODO: Input is synced here then we
     *   throw it into the input sender.
     *   They probably stay synced, but
     *   it's not enforced anywhere after this.
     *
     * @param {string} targetId
     * @param {object} data
     */

  }, {
    key: 'sendSynced',
    value: function sendSynced(targetId, data) {
      for (var targetPort in data) {
        if (data.hasOwnProperty(targetPort)) {
          var synced = data[targetPort];
          // opens all queues, a it radical..
          this.queueManager.flushAll();
          // keep in sync, do not use setImmediate
          debug('%s: sendSynced', synced.link.ioid);
          this.__sendData(synced.link, synced.p);
        }
      }
    }
  }, {
    key: 'drop',
    value: function drop(packet, origin) {
      // TODO: drop data/packet gracefully
      debug('IoMapHandler: Dropping packet %s %s', packet, origin);
      this.emit('drop', packet);
    }
  }]);

  return IoMapHandler;
})(EventEmitter);

module.exports = IoMapHandler;
//# sourceMappingURL=mapHandler.js.map

},{"../packet":31,"../queue/defaultManager":35,"./indexHandler":24,"chix-chi":44,"debug":"V4HZ/5","events":1,"util":6,"uuid":61}],26:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var uuid = require('uuid').v4;
var Connector = require('./connector');
var Setting = require('./setting');
var validate = require('./validate');

/**
 *
 * xLink
 *
 *
 * Settings:
 *
 *   - ttl
 *   - expire
 *   - dispose: true
 *
 * Just need something to indicate it's an iip.
 *
 * @constructor
 * @public
 */

var Link = (function (_Setting) {
  _inherits(Link, _Setting);

  function Link(id, ioid) {
    _classCallCheck(this, Link);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Link).call(this));

    _this.fills = 0;
    _this.writes = 0;
    _this.rejects = 0;
    _this.id = id === undefined ? uuid() : id;
    _this.ioid = ioid || uuid();
    _this.metadata = {};
    return _this;
  }

  _createClass(Link, [{
    key: 'build',
    value: function build(ln) {
      if (!ln.source) {
        throw Error('Create link expects a source');
      }

      if (!ln.target) {
        throw Error('Create link expects a target');
      }

      validate.link(ln);

      this.setSource(ln.source.id, ln.source.port, ln.source.setting, ln.source.action);

      if (ln.metadata) {
        this.setMetadata(ln.metadata);
      } else {
        this.setMetadata({});
      }

      this.setTarget(ln.target.id, ln.target.port, ln.target.setting, ln.target.action);
    }

    /**
     *
     * Set target
     *
     * @param {String} targetId
     * @param {String} port
     * @param {Object} settings
     * @param {String} action
     * @public
     */

  }, {
    key: 'setTarget',
    value: function setTarget(targetId, port, settings, action) {
      this.target = new Connector(settings);
      this.target.wire = this;
      this.target.plug(targetId, port, action);
    }
  }, {
    key: 'write',
    value: function write(p) {
      this.writes++;

      // loose ownership
      p.release(this);

      // just re-emit
      this.emit('data', p);
    }

    /**
     *
     * Set Source
     *
     * @param {Object} sourceId
     * @param {String} port
     * @param {Object} settings
     * @param {String} action
     * @public
     */

  }, {
    key: 'setSource',
    value: function setSource(sourceId, port, settings, action) {
      this.source = new Connector(settings);
      this.source.wire = this;
      this.source.plug(sourceId, port, action);
    }

    /**
     *
     * Setting of pid's is delayed.
     * I would like them to be available during plug.
     * but whatever.
     *
     */

  }, {
    key: 'setSourcePid',
    value: function setSourcePid(pid) {
      this.source.setPid(pid);
    }
  }, {
    key: 'setTargetPid',
    value: function setTargetPid(pid) {
      this.target.setPid(pid);
    }
  }, {
    key: 'setMetadata',
    value: function setMetadata(metadata) {
      this.metadata = metadata;
    }
  }, {
    key: 'setMeta',
    value: function setMeta(key, val) {
      this.metadata[key] = val;
    }

    /**
     *
     * Set Title
     *
     * @param {String} title
     * @public
     */

  }, {
    key: 'setTitle',
    value: function setTitle(title) {
      this.setMeta('title', title);
      this.emit('change', this, 'metadata', this.metadata);
    }
  }, {
    key: 'clear',
    value: function clear() {
      this.fills = 0;
      this.writes = 0;
      this.rejects = 0;
      this.emit('clear', this);
    }

    /**
     *
     * Update link by passing it a full object.
     *
     * Will only emit one change event.
     *
     */

  }, {
    key: 'update',
    value: function update(ln) {
      this.build(ln);
      this.emit('change', this);
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      // TODO: use schema validation for toJSON
      if (!this.hasOwnProperty('source')) {
        console.log(this);
        throw Error('Link should have a source property');
      }
      if (!this.hasOwnProperty('target')) {
        throw Error('Link should have a target property');
      }

      var link = {
        id: this.id,
        source: this.source.toJSON(),
        target: this.target.toJSON()
      };

      if (this.metadata) {
        link.metadata = this.metadata;
      }

      if (this.fills) {
        link.fills = this.fills;
      }

      if (this.rejects) {
        link.rejects = this.rejects;
      }

      if (this.writes) {
        link.writes = this.writes;
      }

      if (this.data !== undefined) {
        link.data = JSON.parse(JSON.stringify(this.data));
      }

      return link;
    }
  }], [{
    key: 'create',
    value: function create() {
      var ln = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var link = new Link(ln.id, ln.ioid);

      if (ln.source || ln.target) {
        link.build(ln);
      }

      return link;
    }
  }]);

  return Link;
})(Setting);

module.exports = Link;
//# sourceMappingURL=link.js.map

},{"./connector":20,"./setting":40,"./validate":41,"uuid":61}],27:[function(require,module,exports){
'use strict'

/**
 *
 * Mixin
 *
 * Will invoke any init() methods immediately if they are defined.
 *
 * @param {Object} context instance
 * @param {Array} mixins Array of mixins
 */
;
module.exports = function mixin(context) {
  for (var _len = arguments.length, mixins = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    mixins[_key - 1] = arguments[_key];
  }

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = mixins[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _mixin = _step.value;

      var props = Object.getOwnPropertyNames(_mixin.prototype);
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = props[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var prop = _step2.value;

          if (prop !== 'constructor') {
            context.prototype[prop] = _mixin.prototype[prop];
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }
};
//# sourceMappingURL=mixin.js.map

},{}],28:[function(require,module,exports){
'use strict'

/**
 * Function to sort multidimensional array
 *
 * Simplified version of:
 *
 *   https://coderwall.com/p/5fu9xw
 *
 * @param {array} a
 * @param {array} b
 * @param {array} columns List of columns to sort
 * @param {array} orderBy List of directions (ASC, DESC)
 * @param {array} index
 * @returns {array}
 */
;
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.multisort = multisort;
function multisortRecursive(a, b, columns, orderBy, index) {
  var direction = orderBy[index] === 'DESC' ? 1 : 0;
  var x = a[columns[index]];
  var y = b[columns[index]];

  if (x < y) {
    return direction === 0 ? -1 : 1;
  }

  if (x === y) {
    return columns.length - 1 > index ? multisortRecursive(a, b, columns, orderBy, index + 1) : 0;
  }

  return direction === 0 ? 1 : -1;
}

function multisort(arr, columns, orderBy) {
  if (typeof columns === 'undefined') {
    columns = [];
    for (var x = 0; x < arr[0].length; x++) {
      columns.push(x);
    }
  }

  if (typeof orderBy === 'undefined') {
    orderBy = [];
    for (var x = 0; x < arr[0].length; x++) {
      orderBy.push('ASC');
    }
  }

  return arr.sort(function (a, b) {
    return multisortRecursive(a, b, columns, orderBy, 0);
  });
}
//# sourceMappingURL=multisort.js.map

},{}],29:[function(require,module,exports){
'use strict'

/* jshint -W040 */

;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Packet = require('./packet');
var Connector = require('./connector');
var util = require('util');
var NodeBox = require('./sandbox/node');
var PortBox = require('./sandbox/port');
var BaseNode = require('./node/interface');
var Port = require('./port');
var debug = require('debug')('chix:node');
var portFiller = require('./port/filler');

// Running within vm is also possible and api should stay
// compatible with that, but disable for now.
// vm = require('vm'),

/**
 * Error Event.
 *
 * @event Node#error
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} msg - The error message
 */

/**
 * Executed Event.
 *
 * @event Node#executed
 * @type {object}
 * @property {object} node - An export of this node
 */

/**
 * Context Update event.
 *
 * @event Node#contextUpdate
 */

/**
 * Output Event.
 *
 * Fired multiple times on output
 *
 * Once for every output port.
 *
 * @event Node#output
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} port - The output port
 * @property {string} out - A (reference) to the output
 */

/**
 *
 * Node
 *
 * TODO:
 *   do not copy all those properties extend the node object itself.
 *   however, do not forget the difference between a nodeDefinition
 *   and a node.
 *
 *   node contains the process definition, which is the node
 *   definition merged with the instance configuration.
 *
 * @author Rob Halff <rob.halff@gmail.com>
 * @param {String} id
 * @param {Object} node
 * @param {String} identifier
 * @param {CHI} CHI
 * @constructor
 * @public
 */

var xNode = (function (_BaseNode) {
  _inherits(xNode, _BaseNode);

  function xNode(id, node, identifier, CHI) {
    _classCallCheck(this, xNode);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(xNode).call(this, id, node, identifier, CHI));
    // detection of async is still needed.
    // Really should all just be different classes.
    // Problem now, we have to run the nodebox to
    // determine async, which is a super hacky way.

    if (_this.async !== true) {
      // super might have set it
      _this.async = node.type === 'async';
      _this.async = node.async ? true : _this.async;
    }

    _this.type = 'node';

    _this.state = {};

    _this.persist = {};

    _this.transit = {};

    _this._delay = 0;

    // remember def for .compile()
    _this.def = node;

    /**
     *
     * Indicates whether this instance is active.
     *
     * This works together with the active state
     * of the sandbox.
     *
     * When a blackbox sends async output done()
     * should be used to inform us it is done.
     *
     * @property {Boolean} active
     * @public
     */
    _this.active = false;

    /**
     *
     * Indicates whether this node expects async input.
     *
     * Async input listening is done by:
     *
     *   on.input.<port-name> = function() {}
     *
     * Any node can send async output.
     *
     * Async nodes are handled differently, their function body
     * is only executed once, during startup.
     *
     * I think the port input function can be handled the same
     * as a normal function body, we'll just have several
     * functions to execute based on what input port is targeted.
     *
     * The common state is represented in the `state` object.
     * This is the only variable which is accessible to all ports
     * and during startup.
     *
     */
    _this.nodebox = new NodeBox();

    // done() is added to the nodebox
    _this.nodebox.set('done', _this.complete.bind(_this));
    _this.nodebox.set('cb', _this._asyncOutput.bind(_this));
    _this.nodebox.set('state', _this.state);

    _this._setup();

    /** @property {Mixed} chi */
    _this.chi = {};

    /** delay interval */
    _this.interval = 100;

    /** @property {Object} input */
    _this.input = {};

    /** @property {Object} context */
    _this.context = {};

    /** @property {Object} dependencies */
    _this.dependencies = node.dependencies || {};

    /** @property {Array} expose */
    _this.expose = node.expose;

    /** @property {String} fn */
    _this.fn = node.fn;

    /**
     * @property {Numeric} nodeTimeout
     * @default 3000
     */
    _this.nodeTimeout = node.nodeTimeout || 3000;

    /**
     *
     * inputTimeout in milliseconds
     *
     * If inputTimeout === `false` there will be no timeout
     *
     * @property {Mixed} inputTimeout
     * @default 3000
     */
    _this.inputTimeout = typeof node.inputTimeout === 'undefined' ? 3000 : node.inputTimeout;

    /** @private */
    _this.__halted = false; // was halted by a hold

    /** @private */
    _this._inputTimeout = null;

    /** @property {Numeric} filled */
    Object.defineProperty(_this, 'filled', {
      enumerable: true,
      configurable: false,
      get: function get() {
        return Object.keys(this.input).length;
      }
    });

    // Solving yet another `design` problem
    // object containing the current connections in use
    // will be reset during free Port.
    // Also belongs to the port objects.
    _this._activeConnections = {};

    _this.status = 'init';

    // setup the core
    _this._fillCore();

    // If this node is async, run it once
    // all ports will be setup and sandbox state will be filled.
    if (_this._isPreloaded()) {
      // still need to add the precompiled function
      if (_this.fn) {
        //this.nodebox.fill(this.fn);
        // not tested..
        _this.nodebox.fill(_this.fn);
      }

      if (_this.async) {
        // how about nodebox.state?
        // state is now in the definition itself..
        // this should really also be a deep copy.
        _this.nodebox.state = node.state;
        _this._loadAsync();
      }
    } else {
      _this.nodebox.compile(_this.fn);

      if (_this.async) {
        // This collects the port definitions they
        // attach to `on`
        _this.nodebox.run();

        _this._loadAsync();
      }
    }
    return _this;
  }

  _createClass(xNode, [{
    key: 'start',
    value: function start() {
      var sb = undefined;
      if (this.status === 'created') {
        this.setStatus('started');
        debug('%s: running on start', this.identifier);
        if (this.nodebox.on.start) {
          // Run onStart functionality first
          if (typeof this.nodebox.on.start === 'function') {
            sb = this._createPortBox(this.nodebox.on.start);
          } else {
            sb = this._createPortBox(this.nodebox.on.start.toString());
          }
          sb.run(this);
          this.nodebox.state = this.state = sb.state;
        }

        this.emit('started', {
          node: this.export()
        });
      }
    }

    /***
     *
     * Async problem.
     *
     * start() -> isStartable()
     *
     * If links are not connected yet, this logic will not work.
     * However, how to know we are complete.
     * addnode addnode addlink addlink etk
     *
     *
     *
     */
    // ok, nice, multiple ip's will not be possible?, yep..

  }, {
    key: 'isStartable',
    value: function isStartable() {
      if (this.hasConnections()) {
        // should never happen with IIPs so fix that bug first
        return false;
      }

      var fillable = 0;
      for (var port in this.ports.input) {
        // null is possible..
        if (this.ports.input[port].default !== undefined) {
          fillable++;
        } else if (this.context[port]) {
          fillable++;
        } else if (port === ':start') {
          fillable++;
          //} else if (!this.ports.input[port].required) {
        } else if (this.ports.input[port].required === false) {
            fillable++;
          }
      }

      return fillable === this.inPorts.length;
    }
  }, {
    key: 'hasData',
    value: function hasData(port) {
      //return undefined !== this.input[port].data;
      //return undefined !== this.input[port];
      return this.input.hasOwnProperty(port);
    }
  }, {
    key: 'fill',
    value: function fill(target, data, settings) {
      var p = undefined;
      if (data instanceof Packet) {
        p = data;
      } else {

        // TODO: duplicate error handling from plug()
        // error definition should be in one place.
        if (this.portExists('input', target.port || target)) {
          p = new Packet(this, data, this.getPortType('input', target.port || target));
        } else {
          return Error(util.format('Process `%s` has no input port named `%s`\n\n\t' + 'Input ports available: %s\n\n\t', this.identifier, target.port, this._portsAvailable()));
        }
      }

      // allow for simple api
      if (typeof target === 'string') {
        var port = target;
        target = new Connector(settings || {});
        target.plug(this.id, port);
        // target.set('dispose', true); should be on wire
        if (settings) {
          target.set('persist', true);
        }
        this.plug(target);
      }

      // better call it pointer
      if (target.has('mask')) {
        p.point(this, target.get('mask'));
      }

      var ret = this._receive(target, p);

      debug('%s:%s receive  %s', this.identifier, target.port, ret);

      if (ret !== true) {
        // Error or `false`
        if (this.ports.input.hasOwnProperty(target.port)) {
          this.ports.input[target.port].rejects++;
          this.ports.input[target.port].lastError = ret;
        }
      }

      return ret;
    }
  }, {
    key: 'clearContextProperty',
    value: function clearContextProperty(port) {
      debug('%s:%s clear context', this.identifier, port);

      // drop packet?
      delete this.context[port];

      this.event(':contextClear', {
        node: this,
        port: port
      });
    }

    /**
     *
     * Starts the node
     *
     * TODO: dependencies are always the same, only input is different.
     * dependencies must be created during createScript.
     * also they must be wrapped within a function.
     * otherwise you cannot overwrite window and document etc.
     * ...Maybe statewise it's a good thing, dependencies are re-required.
     *
     * FIXME: this method does too much on it's own.
     *
     * Note: start is totally unprotected, it assumes the input is validated
     * and all required ports are filled.
     * Start should never really be called directly, the node starts when
     * input is ready.
     *
     * @param {Function} fn
     * @param {String} name
     * @emits Node#error
     * @emits Node#require
     * @emits Node#expose
     * @private
     */

    /**
     *
     * Contains much of the port's logic, this should be abstracted out
     * into port objects.
     *
     * For now just add extra functionality overhere.
     *
     * TODO:
     *  - Detect if the input port is defined as Array.
     *  - If it is an array, detect what is it's behaviour
     *
     * Behaviours:
     *  - Multiple non-array ports are connected: wait until all have send
     *    their input and release the array of data.
     *  - One port is connect of the type Array, just accept it and run
     *  - Multiple array ports give input/are connected... same as the above
     *  Arrays will be handled one by one.
     *  - So basically, if we receive an array, we process it.
     *  If it is not we will join multiple connections.
     *  - If there is only one port connected and it is not of an array type
     *    We will just sit there and wait forever,
     *    because we cannot make an array out of it.
     * - I think the rules should be simple, if you want it more complex,
     *   just solve it within the flow by adding extra nodes.
     *   What a port does must be understandable.
     *   So that's why it's also good if
     *   you can specify different kind of port behaviour.
     *   So if you do not like a certain kind of behaviour,
     *   just select another one.
     *   Yet all should be simple to grasp.
     *   You could also explain an array as being a port that expects multiple.
     *
     *   The filled concept stays the same, the only thing changing is when we
     *   consider something to be filled.
     *
     *   So.. where is the port type information.
     *
     // TODO: once a connection overwrites a setting.
     // it will not be put back, this is a choice.
     // at what point do we set persistent from a link btw?
     //
     */

  }, {
    key: 'handlePortSettings',
    value: function handlePortSettings(port) {
      if (this.ports.input.hasOwnProperty(port)) {}
    }

    /* Unused?
     syncFilled = function() {
      var port;
      for (port in this.input) {
     if (!this.ports.input[port].async &&
     typeof this.input[port] === 'undefined') {
     return false;
     }
     }
      return true;
      };
      syncFilledCount = function() {
      var port;
      var cnt = 0;
     for (port in this.input) {
     if (!this.ports.input[port].async &&
     typeof this.input[port] !== 'undefined') {
     cnt++;
     }
     }
      return cnt;
      };
     */

  }, {
    key: 'clearInput',
    value: function clearInput(port) {
      delete this.input[port];
    }

    /**
     *
     * Checks whether all required ports are filled
     *
     * Used to determine if this node should start running.
     *
     * @public
     */

  }, {
    key: 'allConnectedFilled',
    value: function allConnectedFilled() {
      for (var port in this.openPorts) {
        if (this.openPorts.hasOwnProperty(port)) {
          if (!this.input.hasOwnProperty(port)) {
            //if (this.input[port] === undefined) {
            return xNode.ALL_CONNECTED_NOT_FILLED;
          }
        }
      }
      return true;
    }

    /**
     *
     * Holds all input until release is called
     *
     * @public
     */

  }, {
    key: 'hold',
    value: function hold() {
      this.setStatus('hold');
    }

    /**
     *
     * Releases the node if it was on hold
     *
     * @public
     */

  }, {
    key: 'release',
    value: function release() {
      this.setStatus('ready');

      if (this.__halted) {
        this.__halted = false;
      }
      return this._readyOrNot();
    }
  }, {
    key: 'isHalted',
    value: function isHalted() {
      return this.__halted;
    }

    /**
     *
     * Node completion
     *
     * Sends an empty string to the :complete port.
     * Each node automatically has one of those available.
     *
     * Emits the complete event and frees all input ports.
     *
     * @private
     */

  }, {
    key: 'complete',
    value: function complete() {
      this.active = false;

      // uses this.event() now.
      // this.sendPortOutput(':complete', '', this.chi);

      /**
       * Complete Event.
       *
       * The node has completed.
       *
       * TODO: a node can set itself as being active
       * active must be taken into account before calling
       * a node complete. As long as a node is active
       * it is not complete.
       *
       * @event Node#complete
       * @type {object}
       * @property {object} node - An export of this node
       */

      this.freeInput();

      this.setStatus('complete');

      this.event(':complete', {
        node: this.export()
      });
    }

    /**
     *
     * Runs the shutdown method of the blackbox
     *
     * An asynchronous node can define a shutdown function:
     *
     *   on.shutdown = function() {
    *
    *     // do shutdown stuff
    *
    *   }
     *
     * When a network shuts down, this function will be called.
     * To make sure all nodes shutdown gracefully.
     *
     * e.g. A node starting a http server can use this
     *      method to shutdown the server.
     *
     * @param {function} cb
     * @returns {undefined}
     * @public
     */

  }, {
    key: 'shutdown',
    value: function shutdown(cb) {
      if (this.nodebox.on && this.nodebox.on.shutdown) {
        // TODO: nodes now do nothing with the callback, they should..
        // otherwise we will hang
        this.nodebox.on.shutdown(cb);

        // TODO: send the nodebox, or just the node export?
        this.event(':shutdown', this.nodebox);
      } else {
        if (cb) {
          cb();
        }
      }
    }

    /**
     *
     * Cleanup
     *
     * @public
     */

  }, {
    key: 'destroy',
    value: function destroy() {
      for (var i = 0; i < xNode.events.length; i++) {
        this.removeAllListeners(xNode.events[i]);
      }
    }

    /**
     *
     * Live reset, connections, etc. stay alive.
     *
     */

  }, {
    key: 'reset',
    value: function reset() {
      debug('%s: reset', this.identifier);

      // clear persistence
      this.persist = {};

      // clear any input
      this.freeInput();

      // reset status
      // note: also will retrigger the .start thing on nodebox.
      this.status = 'created';

      // reset any internal state.
      this.state = {};

      this.runCount = 0;
    }
  }, {
    key: 'unwrapPackets',
    value: function unwrapPackets(input) {
      var self = this;
      return Object.keys(input).reduce(function (obj, k) {
        obj[k] = input[k].read(self);
        return obj;
      }, {});
    }

    /**
     *
     * Frees the input
     *
     * After a node has run the input ports are freed,
     * removing their reference.
     *
     * Exceptions:
     *
     *  - If the port is set to persistent, it will keep it's
     *    reference to the variable and stay filled.
     *
     * NOTE: at the moment a port doesn't have a filled state.
     *  we only count how many ports are filled to determine
     *  if we are ready to run.
     *
     * if a node is still in active state it's input can also not
     * be freed... at the moment it will do so, which is bad.
     *
     * @public
     */

  }, {
    key: 'freeInput',
    value: function freeInput() {
      // this.filled = 0;
      // Reset this.chi.
      // must be before freePort otherwise chi will overlap
      this.chi = {};

      var freed = [];
      for (var i = 0; i < this.inPorts.length; i++) {
        var port = this.inPorts[i];

        // TODO: don't call freeInput in the first place if undefined
        //if (this.input[port] !== undefined) {
        if (this.input.hasOwnProperty(port)) {
          this.freePort(port);
          freed.push(port);
        }
      }
    }
  }, {
    key: 'freePort',
    value: function freePort(port) {
      /*
       var persist = this.getPortOption('input', port, 'persist');
       if (persist) {
       // persist, chi, hmz, seeze to exist.
       // but wouldn't matter much, with peristent ports.
       // TODO: this.filled is not used anymore.
       debug('%s:%s persisting', this.identifier, port);
        // indexes are persisted per index.
       // store inside persit
       if (Array.isArray(persist)) {
       // TODO: means object is not supported..
       this.persist[port] = [];
       for (var k in this.input[port]) {
       if (persist.indexOf(k) === -1) {
       //debug('%s:%s[%s] persisting', this.identifier, port, k);
       // remove
       //delete this.input[port][k];
       } else {
       debug('%s:%s[%s] persisting', this.identifier, port, k);
       this.perists[port][k] = this.input[port][k];
       }
       delete this.input[port][k];
       }
       } else {
        this.persist[port] = this.input[port];
       delete this.input[port];
        }
       }
       */
      //else {

      // this also removes context and default..
      this.clearInput(port);

      debug('%s:%s :freePort event', this.identifier, port);
      this.event(':freePort', {
        node: this.export(),
        link: this._activeConnections[port], // can be undefined, ok
        port: port
      });

      this.emit('freePort', {
        node: this.export(),
        link: this._activeConnections[port],
        port: port
      });

      // delete reference to active connection (if there was one)
      // delete this._activeConnections[port];
      this._activeConnections[port] = null;
      //}
    }

    /**
     * Usage of `$`
     *
     * Idea is to do the reverse of super() all extending `classes`
     * only have $ methods.
     *
     * @param {type} port
     * @param {type} data
     * @returns {undefined}
     * @shielded
     */

  }, {
    key: '$setContextProperty',
    value: function $setContextProperty(port, data) {
      debug('%s:%s set context', this.identifier, port);
      var p = undefined;
      if (data instanceof Packet) {
        p = data;
      } else {
        p = new Packet(this, data, this.getPortType('input', port));
      }
      this.context[port] = p;
    }
  }, {
    key: '$portIsFilled',
    value: function $portIsFilled(port) {
      return this.input.hasOwnProperty(port);
    }

    // TODO: this generic, however options does not exists anymore, it's settings

  }, {
    key: '_setup',
    value: function _setup() {
      for (var port in this.ports.input) {
        if (this.ports.input.hasOwnProperty(port)) {
          if (this.ports.input[port].options) {
            for (var opt in this.ports.input[port].options) {
              if (this.ports.input[port].options.hasOwnProperty(opt)) {
                this.setPortOption('input', port, opt, this.ports.input[port].options[opt]);
              }
            }
          }
        }
      }
    }

    /**
     *
     * Determines whether we are ready to go.
     * And starts the node accordingly.
     *
     * TODO: it's probably not so smart to consider default
     * it means we can never send an IIP to a port with a default.
     * Because the default will already trigger the node to run.
     *
     * @private
     */

  }, {
    key: '_readyOrNot',
    value: function _readyOrNot() {
      // all connected ports are filled.
      if (this._allConnectedSyncFilled()) {
        if (this._inputTimeout) {
          clearTimeout(this._inputTimeout);
        }

        // Check context/defaults etc. and fill it
        // should only fill defaults for async ports..
        // *if* the async port is not connected.
        var ret = portFiller.fill(this);

        // TODO: if all are async, just skip all the above
        // async must be as free flow as possible.
        if (util.isError(ret)) {
          debug('%s: filler error `%s`', this.identifier, ret);

          return ret;
        } else {
          // temp for debug
          //this.ready = true;

          // todo better to check for ready..
          if (this.status !== 'hold') {
            if (this.async) {
              // really have no clue why these must run together
              // and why I try to support 4 different ways of writing
              // a component and sqeeze it into one class.
              var asyncRan = 0;
              for (var port in this.ports.input) {
                // run all async which have input.
                // persistent async will have input etc.
                if ((this.ports.input[port].async || this.ports.input[port].fn) &&
                // need to check packet or?
                this.input.hasOwnProperty(port)) {
                  //this.input[port] !== undefined) {

                  ret = this._runPortBox(port);

                  if (ret === false) {
                    // revoke input
                    if (asyncRan > 0) {
                      // only problem now is the multpile async ports.
                      //
                      throw Error('Input revoked, yet one async already ran');
                    }

                    debug('%s:%s() revoked input', this.identifier, port);

                    return Port.INPUT_REVOKED;
                  }

                  asyncRan++;
                }
              }

              if (asyncRan > 0) {
                this.freeInput();
              }
            } else {
              // not async
              if (Object.keys(this.input).length !== this.inPorts.length) {
                //return this.error(util.format(
                return Error(util.format('Input does not match, Input: %s, InPorts: %s', Object.keys(this.input).toString(), this.inPorts.toString()));
              } else {
                this.setStatus('running');
                this.__start();
              }
            }
          } else {
            this.__halted = true;
          }
        }

        return true;
      }

      // OK, this false has nothing to do with fill return codes..
      // yet above for async I treat false as a failed fill.
      // console.log('SYNC NOT FILLED!', ret, this.identifier);
      //return false;
      return true;
    }
  }, {
    key: '__start',
    value: function __start() {
      if (this.active) {
        // try again, note: this is different from input queueing..
        // used for longer running processes.
        debug('%s: node still active delaying', this.identifier);
        this._delay = this._delay + this.interval;
        setTimeout(this.start.bind(this), 500 + this._delay);
        return false;
      }

      // set active state.
      this.active = true;

      // Note: moved to the beginning.
      this.runCount++;

      if (!this.async) {
        if (this.nodebox.on) {
          if (this.nodebox.on.shutdown) {
            debug('%s: running shutdown', this.identifier);
            this.shutdown();
          }
        }
      }

      this.nodebox.set('input', this.unwrapPackets(this.input));

      // difference in notation, TODO: explain these constructions.
      // done before compile.
      // this.nodebox.output = this.async ? this._asyncOutput.bind(this) : {};

      this._runOnce();
    }

    /**
     *
     * Runs the node
     *
     * @emits Node#nodeTimeout
     * @emits Node#start
     * @emits Node#executed
     * @private
     */

  }, {
    key: '_runOnce',
    value: function _runOnce() {
      var t = setTimeout((function () {
        debug('%s: node timeout', this.identifier);

        /**
         * Timeout Event.
         *
         * @event Node#nodeTimeout
         * @type {object}
         * @property {object} node - An export of this node
         */
        this.event(':nodeTimeout', {
          node: this.export()
        });
      }).bind(this), this.nodeTimeout);

      /**
       * Start Event.
       *
       * @event Node#start
       * @type {object}
       * @property {object} node - An export of this node
       */
      this.event(':start', {
        node: this.export()
      });

      //this.nodebox.runInNewContext(this.sandbox);
      //
      // ok, this depends on what is the code whether it's running or not...
      // that's why async should be definied per port.
      this.setStatus('running');

      this.nodebox.run();
      this.state = this.nodebox.state;

      debug('%s: nodebox executed', this.identifier);

      this.emit('executed', {
        node: this
      });
      this.event(':executed', {
        node: this
      });

      clearTimeout(t);

      this._output(this.nodebox.output);
    }

    /**
     *
     * Fills the core of this node with functionality.
     *
     * @emits Node#fillCore
     * @private
     */

  }, {
    key: '_fillCore',
    value: function _fillCore() {
      debug('%s: fill core', this.identifier);

      /**
       * Fill Core Event.
       *
       * @event Node#fillCore
       * @type {object}
       * @property {object} node - An export of this node
       * @property {function} fn - The function being installed
       * @property {string} fn - The name of the function
       */
      this.event(':fillCore', {
        node: this.export(),
        fn: this.fn,
        name: this.name
      });

      this.nodebox.require(this.dependencies.npm);
      this.nodebox.expose(this.expose, this.CHI);

      this.nodebox.set('output', this.async ? this._asyncOutput.bind(this) : {});

      this.setStatus('created');
    }

    /**
     *
     * Test whether this is a preloaded node.
     *
     * @private
     */

  }, {
    key: '_isPreloaded',
    value: function _isPreloaded() {
      if (typeof this.fn === 'function') {
        return true;
      }

      for (var port in this.ports.input) {
        if (this.ports.input.hasOwnProperty(port)) {
          if (this.ports.input[port].fn) {
            return true;
          }
        }
      }

      return false;
    }

    /**
     *
     * @private
     */

  }, {
    key: '_loadAsync',
    value: function _loadAsync() {
      for (var port in this.ports.input) {
        if (this.ports.input.hasOwnProperty(port)) {
          // If there is a port function defined for this port
          // it means it's async
          if (this.nodebox.on.input.hasOwnProperty(port)) {
            this.ports.input[port].fn = this._createPortBox(this.nodebox.on.input[port].toString(), ('__' + port + '__').toUpperCase());

            this.async = true;
            this.ports.input[port].async = true;
          } else if (this.ports.input[port].fn) {
            // pre-compiled
            this.ports.input[port].fn = this._createPortBox(this.ports.input[port].fn, ('__' + port + '__').toUpperCase());

            this.async = true;
            this.ports.input[port].async = true;
          } else {
            // It is a sync port
          }
        }
      }

      this.setStatus('created');

      // could just act on general status change event, who uses this?
      this.emit('created', {
        node: this.export()
      });

      this.state = this.nodebox.state;
    }

    /**
     *
     * Generic Callback wrapper
     *
     * Will collect the arguments and pass them on to the next node
     *
     * So technically the next node is the callback.
     *
     * Parameters are defined on the output as ports.
     *
     * Each callback argument must be defined as output port
     * in the callee's schema
     *
     * e.g.
     *
     *  node style callback:
     *
     *  ports.output: { err: ..., result: ... }
     *
     *  connect style callback:
     *
     *  ports.output: { req: ..., res: ..., next: ... }
     *
     * The order of appearance of arguments must match those of the ports within
     * the json schema.
     *
     * TODO: Within the schema you must define the correct type otherwise output
     * will be refused
     *
     *
     * @private
     */

  }, {
    key: '_callbackWrapper',
    value: function _callbackWrapper() {
      var obj = {};
      var ports = this.outPorts;

      for (var i = 0; i < arguments.length; i++) {
        if (!ports[i]) {
          // TODO: eventemitter expects a new Error()
          // not the object I send
          // Not sure what to do here, it's not really fatal.
          this.event(':error', {
            msg: Error(util.format('Unexpected extra port of type %s', _typeof(arguments[i]) === 'object' ? arguments[i].constructor.name : _typeof(arguments[i])))
          });
        } else {
          obj[ports[i]] = arguments[i];
        }
      }

      this._output(obj);
    }

    /**
     *
     * Execute the delegated callback for this node.
     *
     * [fs, 'readFile', '/etc/passwd']
     *
     * will execute:
     *
     * fs['readFile']('/etc/passwd', this.callbackWrapper);
     *
     * @param {Object} output
     * @emits Node#branching
     * @private
     */

  }, {
    key: '_delegate',
    value: function _delegate(output) {
      var fn = output.splice(0, 1).pop();
      var method = output.splice(0, 1).pop();

      output.push(this._callbackWrapper.bind(this));
      fn[method].apply(fn, output);
    }

    /**
     *
     * This node handles the output of the `blackbox`
     *
     * It is specific to the API of the internal Chix node function.
     *
     * out = { port1: data, port2: data }
     * out = [fs.readFile, arg1, arg2 ]
     *
     * Upon output the input will be freed.
     *
     * @param {Object} output
     * @param {Object} chi
     * @emits Node#output
     * @private
     */

  }, {
    key: '_asyncOutput',
    value: function _asyncOutput(output, chi) {
      // Ok, delegate and object output has
      // synchronous output on _all_ ports
      // however we do not know if we we're called from
      // the function type of output..
      for (var port in output) {
        if (output.hasOwnProperty(port)) {
          this.sendPortOutput(port, output[port], chi);
        }
      }
    }

    /**
     *
     * @private
     */

  }, {
    key: '_allConnectedSyncFilled',
    value: function _allConnectedSyncFilled() {
      for (var i = 0; i < this.openPorts.length; i++) {
        var port = this.openPorts[i];

        // .async test can be removed, .fn is enough
        if (!this.ports.input[port].async || !this.ports.input[port].fn) {
          // should be better index check perhaps
          if (!this.persist.hasOwnProperty(port)) {
            if (this.ports.input[port].indexed) {
              if (/object/i.test(this.ports.input[port].type)) {
                return this._objectPortIsFilled(port);
              } else {
                return this._arrayPortIsFilled(port);
              }
            } else if (!this.input.hasOwnProperty(port)) {
              return xNode.SYNC_NOT_FILLED;
            }
          }
        }
      }

      return true;
    }

    /**
     *
     * Output
     *
     * Directs the output to the correct handler.
     *
     * If output is a function it is handled by asyncOutput.
     *
     * If it's an array, it means it's the shorthand variant
     *
     * e.g. output = [fs, 'readFile']
     *
     * This will be handled by the delegate() method.
     *
     * Otherwise it is a normal output object containing the output for the ports.
     *
     * e.g. { out1: ...,  out2: ...,  error: ... } etc.
     *
     * TODO: not sure if this should always call complete.
     *
     * @param {Object} output
     * @private
     */

  }, {
    key: '_output',
    value: function _output(output) {
      if (typeof output === 'function') {
        output.call(this, this._asyncOutput.bind(this));
        return;
      }

      if (Array.isArray(output)) {
        this._delegate(output);
        return;
      }

      for (var port in output) {
        if (output.hasOwnProperty(port)) {
          this.sendPortOutput(port, output[port]);
        }
      }

      this.complete();
    }

    /**
     *
     * Executes the async variant
     *
     * state is the only variable which will persist.
     *
     * @param {string} fn - Portbox Function Body
     * @returns {PortBox}
     * @private
     */

  }, {
    key: '_createPortBox',
    value: function _createPortBox(fn, name) {
      debug('%s: creating portbox `%s`', this.identifier, name);

      var portbox = new PortBox(name);
      portbox.set('state', this.nodebox.state);
      portbox.set('output', this._asyncOutput.bind(this));

      // also absorbes already required.
      portbox.require(this.dependencies.npm, true);
      portbox.expose(this.expose, this.CHI);

      if (typeof fn !== 'function') {
        fn = fn.slice(fn.indexOf('{') + 1, fn.lastIndexOf('}'));
        portbox.compile(fn);
      } else {
        portbox.fill(fn);
      }

      return portbox;
    }

    /**
     *
     * @param {string} port
     * @private
     */

  }, {
    key: '_runPortBox',
    value: function _runPortBox(port) {
      var sb = this.ports.input[port].fn;
      // fill in the values

      this.event(':start', {
        node: this.export()
      });

      sb.set('data', this.input[port].read(this));
      sb.set('x', this.chi);
      sb.set('state', this.state);
      // sb.set('source', source); is not used I hope

      sb.set('input', this.unwrapPackets(this.input));
      // add all (sync) input.

      this.setStatus('running');

      // remember last one for cloneing
      this.transit[port] = this.input[port];

      var ret = sb.run(this);

      this.nodebox.state = this.state = sb.state;

      if (ret === false) {
        // if ret === false input should be revoked and re-queued.
        // which means it must look like we didn't accept the packet in
        // the first place.

        // this.setStatus('idle');
        var d = this.input[port];

        // freePort somehow doesn't work
        // only the below + unlock during unshift works.
        // but has the danger of creating an infinite loop.
        // if rejection is always false.
        delete this.input[port];
        delete this._activeConnections[port];

        this.event(':portReject', {
          node: this.export(),
          port: port,
          data: d // TODO: other portReject emits full packet instead of data.
        });

        return false;
      }

      this.runCount++;
      this.ports.input[port].runCount++;

      debug('%s:%s() executed', this.identifier, port);

      this.emit('executed', {
        node: this,
        port: port
      });

      this.event(':executed', {
        node: this,
        port: port
      });
    }

    /**
     * Fill one of our ports.
     *
     * First the input data will be validated. A port
     * will only be filled if the data is of the correct type
     * or even structure.
     *
     * The following events will be emitted:
     *
     *   - `portFill`
     *   - `inputTimeout`
     *   - `clearTimeout` (TODO: remove this)
     *
     * FIXME:
     *  - options are set and overwritten on portFill
     *    which is probably undesired in most cases.
     *
     *  - portFill is the one who triggers the start of a node
     *    it's probably better to trigger an inputReady event.
     *    and start the node based on that.
     *
     * @param {Connector} target
     * @param {Packet} p
     * @returns {Node.error.error|Boolean}
     * #private
     */

  }, {
    key: '_fillPort',
    value: function _fillPort(target, p) {
      if (undefined === p.read(this)) {
        return Error('data may not be `undefined`');
      }

      // Not used
      //this.handlePortSettings(target.port);

      // PACKET WRITE, TEST THIS
      // this is not good, it's too early.
      p.write(this, this._handleFunctionType(target.port, p.read(this)));

      var res = this._validateInput(target.port, p.read(this));

      if (util.isError(res)) {
        return res;
      } else {
        if (target.has('persist')) {
          // do array index thing here also.
          //this.persist[target.port] = p.data;
          this.persist[target.port] = p;
          return true;
        } else {
          // this is too early, defaults do not get filled this way.
          if (this.ports.input[target.port].async === true && !this._allConnectedSyncFilled()) {

            this.event(':portReject', {
              node: this.export(),
              port: target.port,
              data: p
            });

            // do not accept
            console.log('early block');
            return false;
          }

          try {
            // CHI MERGING check this.
            // Or is this to early, can we still get a reject?
            this.CHI.merge(this.chi, p.chi);
          } catch (e) {
            // this means chi was not cleared,
            // yet the input which caused the chi setting
            // freed the port, so how is this possible.
            return this.error(util.format('%s: chi item overlap during fill of port `%s`\n' + 'chi arriving:\n%s\nchi already collected:\n%s', this.identifier, target.port, JSON.stringify(p.chi), JSON.stringify(this.chi)));
          }
        }

        // this.filled++;

        if (!this._inputTimeout && this.inputTimeout &&
        //!this.getPortOption('input', port, 'persist')
        !target.has('persist')) {
          this._inputTimeout = setTimeout((function () {

            /**
             * Input Timeout Event.
             *
             * Occurs when there is an input timeout for this node.
             *
             * This depends on the inputTimeout property of the node.
             * If inputTimeout is false, this event will never occur.
             *
             * @event Node#inputTimeout
             * @type {object}
             * @property {object} node - An export of this node
             */
            this.event(':inputTimeout', {
              node: this.export()
            });
          }).bind(this), this.inputTimeout);
        }

        // used during free port to find back our connections.
        // Should belong to the port object (non existant yet)
        if (target.wire) {
          // direct node.fill() does not have it
          // does not really happen can be removed..
          if (this._activeConnections[target.port]) {
            throw Error('There still is a connection active');
          } else {
            this._activeConnections[target.port] = target.wire;
          }
        }

        // set input port data
        // this could be changed to still contain the Packet.
        this._fillInputPort(target.port, p);

        /**
         * Port Fill Event.
         *
         * Occurs when a port is filled with data
         *
         * At this point the data is already validated
         *
         * @event Node#portFill
         * @type {object}
         * @property {object} node - An export of this node
         * @property {string} port - Name of the port
         */
        //this.event(':portFill', {
        //todo: not all events are useful to send as output
        //TODO: just _do_ emit both
        this.emit('portFill', {
          node: this.export(),
          link: target.wire,
          port: target.port
        });

        this.event(':portFill', {
          node: this.export(),
          link: target.wire,
          port: target.port
        });

        var ret = this._readyOrNot();
        return ret;
      }
    }

    /**
     *
     * @param {string} port
     * @param {Packet} p
     * @private
     */

  }, {
    key: '_fillInputPort',
    value: function _fillInputPort(port, p) {
      debug('%s:%s fill', this.identifier, port);

      this.input[port] = p;

      // increment fill counter
      this.ports.input[port].fills++;
    }
  }]);

  return xNode;
})(BaseNode);

xNode.SYNC_NOT_FILLED = false;
xNode.ALL_CONNECTED_NOT_FILLED = false;

module.exports = xNode;
//# sourceMappingURL=node.js.map

},{"./connector":20,"./node/interface":30,"./packet":31,"./port":32,"./port/filler":33,"./sandbox/node":38,"./sandbox/port":39,"debug":"V4HZ/5","util":6}],30:[function(require,module,exports){
'use strict'

/* jshint -W040 */

;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('../events/after');
var util = require('util');
var X = require('chix-chi');
var Port = require('../port');
var Packet = require('../packet');
var validate = require('../validate');
var Connections = require('../ConnectionMap');
var debug = require('debug')('chix:inode');

var BaseNode = (function (_EventEmitter) {
  _inherits(BaseNode, _EventEmitter);

  function BaseNode(id, node, identifier, CHI) {
    _classCallCheck(this, BaseNode);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(BaseNode).call(this));

    _this.pid = null;

    _this.provider = node.provider;

    /**
     * @property {String} status
     * @public
     */
    _this.status = 'unknown';

    /**
     * @property {String} id
     * @public
     */
    _this.id = id;

    /**
     * @property {String} name
     * @public
     */
    _this.name = node.name;

    /**
     * @property {String} ns
     * @public
     */
    _this.ns = node.ns;

    /**
     * @property {String} title
     * @public
     */
    _this.title = node.title;

    /**
     * @property {String} description
     * @public
     */
    _this.description = node.description;

    /**
     * @property {Object} metadata
     * @public
     */
    _this.metadata = node.metadata || {};

    /**
     * @property {String} identifier
     * @public
     */
    _this.identifier = identifier || node.ns + ':' + node.name;

    if (!node.hasOwnProperty('ports')) {
      throw Error('NodeDefinition does not declare any ports');
    }

    if (!node.ports.output) {
      node.ports.output = {};
    }

    if (!node.ports.input) {
      node.ports.input = {};
    }

    if (CHI && CHI.constructor.name !== 'CHI') {
      throw Error('CHI should be instance of CHI');
    }

    _this.CHI = CHI || new X();

    // let the node `interface` instantiate all port objects.
    // each extended will already have port object setup.

    /**
     *
     * Ports which are opened by openPort.
     *
     * The Actor opens each port when it connects to it.
     *
     * Also for IIPs the port will have to be opened first.
     *
     * @private
     **/
    _this.openPorts = [];

    /**
     *
     * Will keep a list of connections to each port.
     *
     */
    _this._connections = new Connections();

    /** @property {Object} ports */
    _this.ports = _this._clonePorts(node.ports);

    // how many times this node has run
    /** @property {Numeric} runCount */
    _this.runCount = 0;

    // how many times this node gave port output
    /** @property {Numeric} outputCount */
    _this.outputCount = 0;

    /** @property {Array} inPorts */
    Object.defineProperty(_this, 'inPorts', {
      enumerable: true,
      get: function get() {
        return Object.keys(this.ports.input);
      }
    });

    /** @property {Array} outPorts */
    Object.defineProperty(_this, 'outPorts', {
      enumerable: true,
      get: function get() {
        return Object.keys(this.ports.output);
      }
    });
    /*
     Object.defineProperty(this, 'filled', {
     enumerable: true,
     configurable: false,
     get: function() {
     return Object.keys(this.input).length;
     }
     });
     */

    // Always add complete port, :start port will be added
    // dynamicaly
    _this.ports.output[':complete'] = {
      name: ':complete',
      type: 'any'
    };

    var key;
    // TODO: should just be proper port objects.
    for (key in _this.ports.input) {
      if (_this.ports.input.hasOwnProperty(key)) {
        _this.ports.input[key].fills = 0;
        _this.ports.input[key].runCount = 0;
        _this.ports.input[key].rejects = 0;
        // auto detect async
        if (_this.ports.input[key].fn) {
          _this.async = true;
        }
      }
    }

    for (key in _this.ports.output) {
      if (_this.ports.output.hasOwnProperty(key)) {
        _this.ports.output[key].fills = 0;
      }
    }
    return _this;
  }

  /**
   *
   * Create a Node
   *
   * @public
   */

  _createClass(BaseNode, [{
    key: 'getPid',
    value: function getPid() {
      return this.pid;
    }

    /**
     *
     * @param {type} pid
     * @public
     */

  }, {
    key: 'setPid',
    value: function setPid(pid) {
      this.pid = pid;
    }

    /**
     *
     * Set Title
     *
     * Used to set the title of a node *within* a graph.
     * This property overwrites the setting of the node definition
     * and is returned during toJSON()
     *
     * @param {string} title
     * @public
     */

  }, {
    key: 'setTitle',
    value: function setTitle(title) {
      this.title = title;
    }

    /**
     *
     * Set Description
     *
     * Used to set the description of a node *within* a graph.
     * This property overwrites the setting of the node definition
     * and is returned during toJSON()
     *
     * @param {string} description
     * @public
     */

  }, {
    key: 'setDescription',
    value: function setDescription(description) {
      this.description = description;
    }

    /**
     *
     * Set metadata
     *
     * Currently:
     *
     *   x: x position hint for display
     *   y: y position hint for display
     *
     * These values are returned during toJSON()
     *
     * @param {object} metadata
     * @public
     */

  }, {
    key: 'setMetadata',
    value: function setMetadata(metadata) {
      for (var k in metadata) {
        if (metadata.hasOwnProperty(k)) {
          this.setMeta(k, metadata[k]);
        }
      }
    }

    /**
     *
     * @param {string} key
     * @param {any} value
     */

  }, {
    key: 'setMeta',
    value: function setMeta(key, value) {
      this.metadata[key] = value;
    }

    /**
     *
     * Set node status.
     *
     * This is unused at the moment.
     *
     * Should probably contain states like:
     *
     *  - Hold
     *  - Complete
     *  - Ready
     *  - Error
     *  - Timeout
     *  - etc.
     *
     * Maybe something like Idle could also be implemented.
     * This would probably only make sense if there are persistent ports
     * which hold a reference to an instance upon which we can call methods.
     *
     * Such an `idle` state would indicate the node is ready to accept new
     * input.
     *
     * @param {String} status
     * @private
     */

  }, {
    key: 'setStatus',
    value: function setStatus(status) {
      this.status = status;

      /**
       * Status Update Event.
       *
       * Fired multiple times on output
       *
       * Once for every output port.
       *
       * @event BaseNode#statusUpdate
       * @type {object}
       * @property {object} node - An export of this node
       * @property {string} status - The status
       */
      this.event(':statusUpdate', {
        node: this.export(),
        status: this.status
      });
    }

    /**
     *
     * Fills the port.
     *
     * Does the same as fillPort, however it also checks:
     *
     *   - port availability
     *   - port settings
     *
     * FIXME: fill & fillPort can just be merged probably.
     *
     * @param {Object} target
     * @public
     */

  }, {
    key: 'handleLinkSettings',
    value: function handleLinkSettings(target) {
      // FIX: hold is not handled anywhere as setting anymore
      if (target.has('hold')) {
        this.hold();
      } else if (target.has('persist')) {
        // FIX ME: has become a weird construction now
        //
        // THIS IS NOW BROKEN, on purpose.. :-)
        var index = target.get('index');

        // specialized case, make this more clear.
        // persist can be a boolean, or it becomes an array of
        // indexes to persist.
        if (index) {
          if (!Array.isArray(this.ports.input[target.port].persist)) {
            this.ports.input[target.port].persist = [];
          }
          this.ports.input[target.port].persist.push(index);
        } else {
          this.ports.input[target.port].persist = true;
        }
      }
    }

    /**
     *
     * Checks whether the input port is available
     *
     * @param {Connector}  target
     * @public
     */

  }, {
    key: 'inputPortAvailable',
    value: function inputPortAvailable(target) {
      if (target.has('index')) {
        if (this.ports.input[target.port].type !== 'array' && this.ports.input[target.port].type !== 'object') {

          return Error([this.identifier, 'Unexpected Index[] information on non array port:', target.port].join(' '));
        }

        // not defined yet
        if (!this.input.hasOwnProperty(target.port)) {
          return Port.AVAILABLE;
        }

        // only available if [] is not already filled.
        if (this.input[target.port].read(this)[target.get('index')] !== undefined) {
          return Port.INDEX_NOT_AVAILABLE;
        }

        if (this.input.length === this._connections[target.port].length) {
          return Port.ARRAY_PORT_FULL;
        }

        return Port.INDEX_AVAILABLE;
      }

      var ret = this.$portIsFilled(target.port) ? Port.UNAVAILABLE : Port.AVAILABLE;
      return ret;
    }

    /**
     *
     * @param {Connector} target
     * @returns {Boolean}
     * @public
     */

  }, {
    key: 'plug',
    value: function plug(target) {
      if (target.port === ':start') {
        this._initStartPort();
      }

      if (this.portExists('input', target.port)) {
        if (!this._connections[target.port]) {
          this._connections[target.port] = [];
        }

        // direct node fill does not have it.
        if (target.wire) {
          this._connections[target.port].push(target.wire);
        }

        this.event(':plug', {
          node: this.export(),
          port: target.port,
          connections: this._connections[target.port].length
        });

        this.openPort(target.port);

        return true;
      } else {
        // problem of whoever tries to attach
        return Error(util.format('Process `%s` has no input port named `%s`\n\n\t' + 'Input ports available: %s\n\n\t', this.identifier, target.port, this._portsAvailable()));
      }
    }

    /**
     *
     * Unplugs a connection from a port
     *
     * Will decrease the amount of connections to a port.
     *
     * TODO: make sure we remove the exact target
     *       right now it just uses pop()
     *
     * @param {Connector} target
     * @public
     */

  }, {
    key: 'unplug',
    value: function unplug(target) {
      if (this.portExists('input', target.port)) {
        // direct node fill does not have it
        if (target.wire) {
          if (!this._connections[target.port] || !this._connections[target.port].length) {
            return this.error('No such connection');
          }

          var pos = this._connections[target.port].indexOf(target.wire);
          if (pos === -1) {
            // problem of whoever tries to unplug it
            //return Error(this, 'Link is not connected to this port');
            return Error('Link is not connected to this port');
          }

          this._connections[target.port].splice(pos, 1);
        }

        this.event(':unplug', {
          node: this.export(),
          port: target.port,
          connections: this._connections[target.port].length
        });

        // ok port should only be closed if there are no connections to it
        if (!this.portHasConnections(target.port)) {
          this.closePort(target.port);
        }

        // if this is the :start port also remove it from inports
        // this port is re-added next time during open port
        // TODO: figure out what happens with multiple connections
        // to a :start port because that's also possible,
        // when true connections are made to it,
        // not iip onces,
        if (target.port === ':start' && target.wire.source.port === ':iip' && // start always has a wire.
        this._connections[target.port].length === 0) {
          this.removePort('input', ':start');
        }

        return true;
      } else if (target.port !== ':start') {
        // :start is dynamic, maybe the throw below is no necessary at all
        // no harm in unplugging something non-existent
        // problem of whoever tries to unplug
        return Error(util.format('Process `%s` has no input port named `%s`\n\n\t' + 'Input ports available: \n\n\t%s', this.identifier, target.port, this._portsAvailable()));
      }
    }
  }, {
    key: 'sendPortOutput',
    value: function sendPortOutput(port, output, chi) {
      if (!chi) {
        chi = {};
      }

      this.CHI.merge(chi, this.chi, false);

      if (output === undefined) {
        throw Error(util.format('%s: Undefined output is not allowed `%s`', this.identifier, port));
      }

      if (port === 'error' && output === null) {
        // allow nodes to send null error, but don't trigger it as output.
        return;
      }

      if (this.ports.output.hasOwnProperty(port) || BaseNode.events.indexOf(port) !== -1 // system events
      ) {
          if (this.ports.output.hasOwnProperty(port)) {
            this.ports.output[port].fills++;
            this.outputCount++;
          }

          var p = this.wrapPacket(port, output);
          p.set('chi', chi);

          // loose the ownership
          p.release(this);

          debug('%s:%s output', this.identifier, port);

          this.emit('output', {
            node: this.export(),
            port: port,
            out: p
          });
        } else {
        throw Error(this.identifier + ': no such output port ' + port);
      }
    }
  }, {
    key: 'start',
    value: function start() {
      throw Error('Node needs to implement start() method');
    }

    /**
     *
     * Validate a single value
     *
     * TODO: Object (and function) validation could be expanded
     * to match an expected object structure, this information
     * is already available.
     *
     * @param {String} type
     * @param {Object} data
     * @private
     */

    /**
     *
     * Does both send events through output ports
     * and emits them.
     *
     * Not sure whether sending the chi is really necessary..
     *
     * @param {string} eventName
     * @param {Packet} p
     * @protected
     */

  }, {
    key: 'event',
    value: function event(eventName, p) {
      // event ports are prefixed with `:`
      this.sendPortOutput(eventName, p);
    }

    /**
     *
     * Could be used to externally set a node into error state
     *
     * BaseNode.error(node, Error('you are bad');
     *
     * @param {Error} err
     * @returns {Error}
     */

  }, {
    key: 'error',
    value: function error(err) {
      var error = util.isError(err) ? err : Error(err);

      // Update our own status
      this.setStatus('error');

      // TODO: better to have full (custom) error objects
      var eobj = {
        //node: node.export(),
        node: this, // do not export so soon.
        msg: err
      };

      // Used for in graph sending
      this.event(':error', eobj);

      // Used by Process Manager or whoever handles the node
      this.emit('error', eobj);

      return error;
    }

    /**
     *
     * Add context.
     *
     * Must be set in one go.
     *
     * @param {Object} context
     * @public
     */

  }, {
    key: 'addContext',
    value: function addContext(context) {
      var port;
      for (port in context) {
        if (context.hasOwnProperty(port)) {
          this.setContextProperty(port, context[port]);
        }
      }
    }

    /**
     *
     * Set context to a port.
     *
     * Can be changed during runtime, but will never trigger
     * a start.
     *
     * Adding the whole context in one go could trigger a start.
     *
     * Packet wise thise content is anonymous.
     *
     * @param {String} port
     * @param {Mixed} data
     * @emits BaseNode#contextUpdate
     * @private
     */

  }, {
    key: 'setContextProperty',
    value: function setContextProperty(port, data) {
      if (port === ':start') {
        this._initStartPort();
      }

      if (this.portExists('input', port)) {
        var res = this._validateInput(port, data);

        if (util.isError(res)) {
          this.event(':error', {
            node: this.export(),
            msg: Error('setContextProperty: ' + res.message)
          });
        } else {
          data = this._handleFunctionType(port, data);

          this.$setContextProperty(port, data);

          this.event(':contextUpdate', {
            node: this,
            port: port,
            data: data
          });
        }
      } else {
        throw Error('No such input port: ' + port);
      }
    }

    /**
     *
     * Wires a source port to one of our ports
     *
     * target is the target object of the connection.
     * which consist of a source and target object.
     *
     * So in this calink.se the target is _our_ port.
     *
     * If a connection is made to the virtual `:start` port
     * it will be created automatically if it does not exist already.
     *
     * The port will be set to the open state and the connection
     * will be registered.
     *
     * A port can have multiple connections.
     *
     * TODO: the idea was to also keep track of
     *       what sources are connected.
     *
     * @private
     */

  }, {
    key: '_initStartPort',
    value: function _initStartPort() {
      // add it to known ports
      if (!this.portExists('input', ':start')) {
        debug('%s:%s initialized', this.identifier, ':start');
        this.addPort('input', ':start', {
          type: 'any',
          name: ':start',
          rejects: 0,
          fills: 0,
          runCount: 0
        });
      }
    }

    // TODO: these port function only make sense for a graph
    //       or a dynamic node.

  }, {
    key: 'addPort',
    value: function addPort(type, port, def) {
      if (this.portExists(type, port)) {
        return Error('Port already exists');
      } else {
        this.ports[type][port] = def;
        return true;
      }
    }
  }, {
    key: 'removePort',
    value: function removePort(type, port) {
      if (this.portExists(type, port)) {
        delete this.ports[type][port];
        if (type === 'input') {
          this.clearInput(port);
          this.clearContextProperty(port);
          return true;
        }
      } else {
        //return Error(this, 'No such port');
        return Error('No such port');
      }
    }
  }, {
    key: 'renamePort',
    value: function renamePort(type, from, to) {
      if (this.portExists(type, from)) {
        this.ports[type][to] = this.ports[type][from];
        delete this.ports[type][from];
        return true;
      } else {
        //return Error(this, 'No such port');
        return Error('No such port');
      }
    }
  }, {
    key: 'getPort',
    value: function getPort(type, name) {
      if (this.ports.hasOwnProperty(type) && this.ports[type].hasOwnProperty(name)) {
        return this.ports[type][name];
      } else {
        throw new Error('Port `' + name + '` does not exist');
      }
    }
  }, {
    key: 'getInputPort',
    value: function getInputPort(name) {
      return this.getPort('input', name);
    }
  }, {
    key: 'getOutputPort',
    value: function getOutputPort(name) {
      return this.getPort('output', name);
    }
  }, {
    key: 'getPortOption',
    value: function getPortOption(type, name, opt) {
      var port = this.getPort(type, name);
      if (port.hasOwnProperty(opt)) {
        return port[opt];
      } else {
        return undefined;
      }
    }
  }, {
    key: 'portExists',
    value: function portExists(type, port) {
      return this.ports[type] && this.ports[type].hasOwnProperty(port) || type === 'output' && BaseNode.events.indexOf(port) >= 0;
    }

    /**
     *
     *
     * @param {String} port
     * @public
     */

  }, {
    key: 'openPort',
    value: function openPort(port) {
      if (this.portExists('input', port)) {
        if (this.openPorts.indexOf(port) === -1) {
          this.openPorts.push(port);

          this.event(':openPort', {
            node: this.export(),
            port: port,
            connections: this._connections.hasOwnProperty(port) ? this._connections[port].length : // enough info for now
            0 // set by context
          });
        }

        // opening twice is allowed.
        return true;
      } else {
        // TODO: make these error codes, used many times, etc.
        return Error(util.format('no such port: **%s**', port));
      }
    }

    // Array format is used to get nested property type

  }, {
    key: 'getPortType',
    value: function getPortType(kind, port) {
      var i;
      var obj;
      var type;
      if (Array.isArray(port)) {
        obj = this.ports[kind];
        for (i = 0; i < port.length; i++) {
          if (i === 0) {
            obj = obj[port[i]];
          } else {
            obj = obj.properties[port[i]];
          }
        }
        type = obj.type;
      } else {
        if (this.ports[kind].hasOwnProperty(port)) {
          type = this.ports[kind][port].type;
        } else {
          // same as...
          return Error('No such input port: ' + port);
        }
      }
      if (type) {
        return type;
      } else {
        throw Error('Unable to determine type for ' + port);
      }
    }

    /**
     *
     * @param {string} port
     * @returns {Boolean}
     */

  }, {
    key: 'closePort',
    value: function closePort(port) {
      if (this.portExists('input', port)) {

        this.openPorts.splice(this.openPorts.indexOf(port), 1);

        this.event(':closePort', {
          node: this.export(),
          port: port
        });

        return true;
      } else {
        // TODO: make these error codes, used many times, etc.
        //return Error(this, util.format('no such port: **%s**', port));
        return Error(util.format('no such port: **%s**', port));
      }
    }

    /**
     * Whether a port is currently opened
     *
     * @param {String} port
     * @return {Boolean}
     * @private
     */

  }, {
    key: 'portIsOpen',
    value: function portIsOpen(port) {
      return this.openPorts.indexOf(port) >= 0;
    }

    /**
     *
     * Sets an input port option.
     *
     * The node schema for instance can specifiy whether a port is persistent.
     *
     * At the moment a connection can override these values.
     * It's a way of saying I give you this once so take care of it.
     *
     * @param {string} type
     * @param {string} name
     * @param {string} opt
     * @param {any} value
     * @returns {undefined}
     */

  }, {
    key: 'setPortOption',
    value: function setPortOption(type, name, opt, value) {
      var port = this.getPort(type, name);
      port[opt] = value;
    }
  }, {
    key: 'setPortOptions',
    value: function setPortOptions(type, options) {
      var opt;
      var port;
      for (port in options) {
        if (options.hasOwnProperty(port)) {
          for (opt in options[port]) {
            if (options[port].hasOwnProperty(opt)) {
              if (options.hasOwnProperty(opt)) {
                this.setPortOption(type, port, opt, options[opt]);
              }
            }
          }
        }
      }
    }

    /**
     *
     * Determine whether this node has any connections
     *
     * FIX this.
     *
     * @return {Boolean}
     * @public
     */

  }, {
    key: 'hasConnections',
    value: function hasConnections() {
      //return this.openPorts.length;
      var port;
      for (port in this._connections) {
        if (this._connections[port] && this._connections[port].length) {
          return true;
        }
      }

      return false;
    }

    // Connection Stuff, should be in the Port object

  }, {
    key: 'portHasConnection',
    value: function portHasConnection(port, link) {
      return this._connections[port] && this._connections[port].indexOf(link) >= 0;
    }
  }, {
    key: 'portHasConnections',
    value: function portHasConnections(port) {
      return Boolean(this._connections[port] && this._connections[port].length > 0);
    }
  }, {
    key: 'portGetConnections',
    value: function portGetConnections(port) {
      return this._connections[port] || [];
    }
  }, {
    key: 'getConnections',
    value: function getConnections() {
      return this._connections;
    }
  }, {
    key: 'determineOutputType',
    value: function determineOutputType(port, output, origType) {
      var type;
      // preferably should be used and set, maybe enforce this.
      if (this.ports.output[port].type) {
        return this.ports.output[port].type;
      }

      type = typeof output === 'undefined' ? 'undefined' : _typeof(output);

      if (type !== 'object') {
        return type;
      }

      // do not modify type, keep packet type as is
      return origType;
    }

    // TODO: many checks only have to be determined one time.

  }, {
    key: 'pickPacket',
    value: function pickPacket(port) {
      if (this.input.hasOwnProperty(port)) {
        return this.input[port];
      } else if (this.transit.hasOwnProperty(port)) {
        // clone
        var c = this.transit[port].clone(this);
        c.c--; // adjust
        return c;
      } else {
        return new Packet(this, null, this.ports.input[port].type);
        //throw Error('Unable to determine source packet');
      }
    }
  }, {
    key: 'wrapPacket',
    value: function wrapPacket(port, output) {
      var p;

      if (port[0] === ':') {
        return new Packet(this, output, 'string');
      }

      // check 1:1 (:start && :complete) are ignored
      var ins = Object.keys(this.ports.input).filter(function (a) {
        return a[0] !== ':';
      });
      var outs = Object.keys(this.ports.output).filter(function (a) {
        return a[0] !== ':';
      });

      if (outs.length === 1 && ins.length === 1) {
        // assume we are doing the same packet.
        p = this.pickPacket(ins[0]);
        if (p) {
          p.write(this, output, this.determineOutputType(port, output, p.type));

          this.freePort(ins[0]);
        } else {
          throw Error(util.format('%s: Cannot determine packet for port `%s`, `%s` is empty', this.identifier, port, ins[0]));
        }
      } else if (port === 'out') {
        if (this.ports.input.hasOwnProperty('in')) {
          p = this.pickPacket('in');
          if (p) {
            p.write(this, output, this.determineOutputType(port, output, p.type));
            this.freePort('in');
          } else {
            console.log(this.export());
            throw Error(util.format('%s: Cannot determine packet for port `out`', this.identifier));
          }
        } else {
          // failing silently, no packet flow match
          debug('%s: Unable to find corresponding `in` port for port `out`', this.identifier);
        }
      } else if (this.inPorts.indexOf(port) >= 0) {
        // same port name context/context
        p = this.pickPacket(port);
        if (p) {
          p.write(this, output, this.determineOutputType(port, output, p.type));
          this.freePort(port);
        } else {
          throw Error(util.format('%s: Cannot determine packet for outport `%s`', this.identifier, port));
        }
      } else {
        // TODO: test for ports.input.out = ['out1', 'out2']
      }
      if (!p) {
        p = new Packet(this, output, this.determineOutputType(port, output, 'any' // if all else fails
        ));
      }
      return p;
    }

    /**
     *
     * Get the current node status.
     *
     * This is unused at the moment.
     *
     * @public
     */

  }, {
    key: 'getStatus',
    value: function getStatus() {
      return this.status;
    }
  }, {
    key: 'getParent',
    value: function getParent() {
      return this.parent;
    }
  }, {
    key: 'setParent',
    value: function setParent(node) {
      this.parent = node;
    }
  }, {
    key: 'hasParent',
    value: function hasParent() {
      return Boolean(this.parent);
    }

    /**
     *
     * Do a lightweight export of this node.
     *
     * Used in emit's to give node information
     *
     *
     * @return {Object}
     * @public
     */

  }, {
    key: 'export',
    value: function _export() {
      return {
        id: this.id,
        ns: this.ns,
        name: this.name,
        title: this.title,
        pid: this.pid,
        identifier: this.identifier,
        ports: this.ports,
        cycles: this.cycles,
        inPorts: this.inPorts,
        outPorts: this.outPorts,
        filled: this.filled,
        context: this.context,
        require: this.require,
        status: this.status,
        runCount: this.runCount,
        expose: this.expose,
        active: this.active,
        metadata: this.metadata,
        provider: this.provider,
        input: this._filteredInput(),
        openPorts: this.openPorts,
        nodeTimeout: this.nodeTimeout,
        inputTimeout: this.inputTimeout
      };
    }

    /**
     *
     * @returns {Object}
     * @public
     */

  }, {
    key: 'report',
    value: function report() {
      return {
        id: this.id,
        identifier: this.identifier,
        title: this.title,
        filled: this.filled,
        runCount: this.runCount,
        outputCount: this.outputCount,
        status: this.status,
        input: this._filteredInput(),
        context: this.context,
        ports: this.ports,
        state: this.state,
        openPorts: this.openPorts,
        connections: this._connections.toJSON()
      };
    }

    /**
     *
     * Returns the node representation to be stored along
     * with the graph.
     *
     * This is not the full definition of the node itself.
     *
     * The full definition can be found using the ns/name pair
     * along with the provider property.
     *
     */

  }, {
    key: 'toJSON',
    value: function toJSON() {
      var self = this;

      var json = {
        id: this.id,
        ns: this.ns,
        name: this.name
      };

      ['title', 'description', 'metadata', 'provider'].forEach(function (prop) {
        if (self[prop]) {
          if (_typeof(self[prop]) !== 'object' || Object.keys(self[prop]).length > 0) {
            json[prop] = self[prop];
          }
        }
      });

      return json;
    }
  }, {
    key: '_receive',
    value: function _receive(target, p) {
      if (this.status === 'error') {
        return new Error('Port fill refused process is in error state');
      }

      if (!this.portExists('input', target.port)) {

        return new Error(util.format('Process %s has no input port named `%s`\n\n' + '\tInput ports available:\n\n\t%s', this.identifier, target.port, this._portsAvailable()));
      }

      if (!this.portIsOpen(target.port)) {
        return Error(util.format('Trying to send to a closed port open it first: %s', target.port));
      }

      // should probably moved somewhere later
      this.handleLinkSettings(target);

      var type = this.ports.input[target.port].type;

      if (type === 'array' && target.has('index')) {
        return this._handleArrayPort(target, p);
      }

      if (type === 'object' && target.has('index')) {
        return this._handleObjectPort(target, p);
      }

      // queue manager could just act on the false return
      // instead of checking inputPortAvailable by itself
      var ret = this.inputPortAvailable(target);
      if (!ret || util.isError(ret)) {

        /**
         * Port Reject Event.
         *
         * Fired when input on a port is rejected.
         *
         * @event BaseNode#portReject
         * @type {object}
         * @property {object} node - An export of this node
         * @property {string} port - Name of the port this rejection occured
         */
        this.event(':portReject', {
          node: this.export(),
          port: target.port,
          data: p
        });

        return ret;
      } else {
        ret = this._fillPort(target, p);
        return ret;
      }
    }

    /**
     *
     * Handles an Array port
     *
     * [0,1,2]
     *
     * When sending IIPs the following can also happen:
     * [undefined, undefined, 2]
     * IIPs in this way must be send as a group.
     * That group will be added in reverse order.
     * This way 2 will create an array of length 3
     * This is important because we will check the length
     * whether we are ready to go.
     *
     * If 0 was added first, the length will be 1 and
     * it seems like we are ready to go, then 1 comes
     * and finds the process is already running..
     *
     * [undefined, undefined, 2]
     *
     * Connections:
     * [undefined, undefined, 2]
     *
     * @param {Connector} target
     * @param {Packet} p
     * @private
     */

  }, {
    key: '_handleArrayPort',
    value: function _handleArrayPort(target, p) {
      // start building the array.
      if (target.has('index')) {

        // Marked the port as being indexed
        this.ports.input[target.port].indexed = true;

        // we have an index.
        // ok, one problem, with async, this.input
        // is never really filled...
        // look at that, will cause dangling data.
        if (!this.input[target.port]) {
          // becomes a new packet
          this.input[target.port] = new Packet(this, [], 'array');
        }

        if (this.input[target.port].read(this)[target.get('index')] !== undefined) {
          // input not available, it will be queued.
          // (queue manager also stores [])
          return Port.INDEX_NOT_AVAILABLE;
        } else {

          this.event(':index', {
            node: this.export(),
            port: target.port,
            index: target.get('index')
          });
          // merge chi
          this.CHI.merge(this.input[target.port].chi, p.chi, false);
          this.input[target.port].read(this)[target.get('index')] = p.read(this);
          // drop packet..
        }

        // it should at least be our length
        if (this._arrayPortIsFilled(target.port)) {
          // packet writing, CHECK THIS.
          // p.data = this.input[target.port]; // the array we've created.

          // Unmark the port as being indexed
          delete this.ports.input[target.port].indexed;

          // ok, above all return true or false
          // this one is either returning true or an error.
          //return this._fillPort(target, p);
          return this._fillPort(target, this.input[target.port]);
        } else {
          // input length less than known connections length.
          return Port.AWAITING_INDEX;
        }
      } else {
        throw Error(util.format('%s: `%s` value arriving at Array port `%s`, but no index[] is set', this.identifier, _typeof(p.data), target.port));
      }
    }

    /**
     *
     * Handles an Object port
     *
     * @param {String} port
     * @param {Object} data
     * @param {Object} chi
     * @param {Object} source
     * @private
     */
    // todo, the name of the variable should be target not source.
    // source is only handled during output.

  }, {
    key: '_handleObjectPort',
    value: function _handleObjectPort(target, p) {
      // start building the array.
      if (target.has('index')) {
        // we have a key.
        // Marked the port as being indexed
        this.ports.input[target.port].indexed = true;

        // Initialize empty object
        if (!this.input[target.port]) {
          this.input[target.port] = new Packet(this, {}, 'object');
        }

        // input not available, it will be queued.
        // (queue manager also stores [])
        if (typeof this.input[target.port][target.get('index')] !== 'undefined') {
          return false;
        } else {

          this.event(':index', {
            node: this.export(),
            port: target.port,
            index: target.get('index')
          });

          // define the key
          this.CHI.merge(this.input[target.port].chi, p.chi, false);
          this.input[target.port].read(this)[target.get('index')] = p.read(this);
        }

        // it should at least be our length
        //
        // Bug:
        //
        // This check is not executed when another port triggers
        // execution. the input object is filled, so it will
        // start anyway.
        //
        if (this._objectPortIsFilled(target.port)) {

          // PACKET WRITING CHECK THIS.
          // p.data = this.input[target.port];

          // Unmark the port as being indexed
          delete this.ports.input[target.port].indexed;

          //return this._fillPort(target, p);
          return this._fillPort(target, this.input[target.port]);
        } else {
          // input length less than known connections length.
          return Port.AWAITING_INDEX;
        }
      } else {

        throw Error(util.format('%s: `%s` value arriving at Object port `%s`, but no index[] is set', this.identifier, _typeof(p.data), target.port));
      }
    }

    /**
     *
     * @param {string} port
     * @private
     */

  }, {
    key: '_arrayPortIsFilled',
    value: function _arrayPortIsFilled(port) {

      // Not even initialized
      //if (typeof this.input[port] === undefined) {
      if (!this.input.hasOwnProperty(port)) {
        return false;
      }

      if (this.input[port].read(this).length < this._connections[port].length) {
        return false;
      }

      // Make sure we do not have undefined (unfulfilled ports)
      // (Should not really happen)
      for (var i = 0; i < this.input[port].read(this).length; i++) {
        if (this.input[port].read(this)[i] === undefined) {
          return false;
        }
      }

      // Extra check for weird condition
      if (this.input[port].read(this).length > this._connections[port].length) {

        this.error(util.format('%s: Array length out-of-bounds for port', this.identifier, port));

        return false;
      }

      return true;
    }

    /**
     *
     * @param {string} port
     * @private
     */

  }, {
    key: '_objectPortIsFilled',
    value: function _objectPortIsFilled(port) {
      // Not even initialized
      //if (typeof this.input[port] === undefined) {
      if (!this.input.hasOwnProperty(port)) {
        return false;
      }

      // Not all connections have provided input yet
      if (Object.keys(this.input[port].read(this)).length < this._connections[port].length) {
        return false;
      }

      // Make sure we do not have undefined (unfulfilled ports)
      // (Should not really happen)
      for (var key in this.input[port]) {
        //if (this.input[port][key] === undefined) {
        if (this.input[port].read(this)[key] === undefined) {
          return false;
        }
      }

      // Extra check for weird condition
      if (Object.keys(this.input[port].read(this)).length > this._connections[port].length) {

        this.error(util.format('%s: Object keys length out-of-bounds for port `%s`', this.identifier, port));

        return false;
      }

      return true;
    }

    /**
     *
     * @param {string} port
     * @param {Mixed} data
     * @private
     */

  }, {
    key: '_validateInput',
    value: function _validateInput(port, data) {
      var type;

      if (!this.ports.input.hasOwnProperty(port)) {

        var msg = Error(util.format('no such port: **%s**', port));

        return Error(msg);
      }

      type = this.getPortType('input', port);

      if (!validate.data(type, data)) {

        // TODO: emit these errors, with error constants
        var real = Object.prototype.toString.call(data).match(/\s(\w+)/)[1];

        if (data && (typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object' && data.constructor.name === 'Object') {
          var tmp = Object.getPrototypeOf(data).constructor.name;

          if (tmp) {
            // not sure, sometimes there is no name?
            // in witch case all you can do is type your name as being an 'object'
            real = tmp;
          }
        }

        return Error(util.format('Expected `%s` got `%s` on port `%s`', type, real, port));
      }

      /**
       * Input Validated Event.
       *
       * Occurs when a port was succesfully validated
       *
       * @event BaseNode#inputValidated
       * @type {object}
       * @property {object} node - An export of this node
       * @property {string} port - Name of the port
       */
      this.event(':inputValidated', {
        node: this.export(),
        port: port
      });

      return true;
    }

    /**
     *
     * @param {string} port
     * @param {Mixed} data
     * @private
     */

  }, {
    key: '_handleFunctionType',
    value: function _handleFunctionType(port, data) {
      var portObj = this.getPort('input', port);
      // convert function if it's not already a function
      if (portObj.type === 'function' && typeof data === 'string') {
        // args, can be used as a hint for named parms
        // if there are no arg names defined, use arguments
        var args = portObj.args ? portObj.args : [];
        data = new Function(args, data);
      }

      return data;
    }
  }, {
    key: '_clonePorts',
    value: function _clonePorts(ports) {
      var type;
      var port;
      var copy = JSON.parse(JSON.stringify(ports));

      // keep fn in tact.
      // all same `instances` share this function.
      for (type in ports) {
        if (ports.hasOwnProperty(type)) {
          for (port in ports[type]) {
            if (ports[type].hasOwnProperty(port)) {
              if (ports[type][port].fn) {
                copy[type][port].fn = ports[type][port].fn;
                this.async = true; // TODO: remove the need of this flagging.
              }
            }
          }
        }
      }

      return copy;
    }

    /**
     *
     * Filters the input for export.
     *
     * Leaving out everything defined as a function
     *
     * Note: depends on the stage of emit whether this value contains anything
     *
     * @return {Object} Filtered Input
     * @private
     */

  }, {
    key: '_filteredInput',
    value: function _filteredInput() {
      var port;
      var type;
      var input = {};

      for (port in this.input) {
        if (this.portExists('input', port)) {
          type = this.ports.input[port].type;

          if (type === 'string' || type === 'number' || type === 'enum' || type === 'boolean') {
            input[port] = this.input[port];
          } else {
            // can't think of anything better right now
            input[port] = Object.prototype.toString.call(this.input[port]);
          }
        } else {

          // faulty but used during export so we want to know
          input[port] = this.input[port];
        }
      }

      return input;
    }
  }, {
    key: '_portsAvailable',
    value: function _portsAvailable() {
      var ports = [];
      var self = this;
      Object.keys(this.ports.input).forEach(function (port) {
        if ((!self.ports.input[port].hasOwnProperty('required') || self.ports.input[port].required === true) && !self.ports.input[port].hasOwnProperty('default')) {
          ports.push(port + '*');
        } else {
          ports.push(port);
        }
      });
      return ports.join(', ');
    }
  }], [{
    key: 'create',
    value: function create(id, def, identifier, CHI) {
      return new BaseNode(id, def, identifier, CHI);
    }
  }]);

  return BaseNode;
})(EventEmitter);

BaseNode.events = [':closePort', ':contextUpdate', ':contextClear', ':complete', ':error', ':executed', ':expose', ':fillCore', ':freePort', ':index', ':inputTimeout', ':inputValidated', ':nodeTimeout', ':openPort', ':output', ':plug', ':unplug', ':portFill', ':portReject', ':require', ':statusUpdate', ':start', ':shutdown'];

BaseNode.prototype.setContext = BaseNode.prototype.setContextProperty;

module.exports = BaseNode;
//# sourceMappingURL=interface.js.map

},{"../ConnectionMap":11,"../events/after":22,"../packet":31,"../port":32,"../validate":41,"chix-chi":44,"debug":"V4HZ/5","util":6}],31:[function(require,module,exports){
'use strict'

// TODO: only has to be a pointer packet if it's actually used.
;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var JsonPointer = require('json-ptr');

/**
 *
 * A Packet wraps the data.
 *
 * The packet is always owned by one owner at a time.
 *
 * In order to read or write a packet, the owner must identify
 * itself first, by sending itself als a reference as first argument
 * to any of the methods.
 *
 * var p = new Packet(data);
 *
 * Packet containing it's own map of source & target.
 * Could be possible, only what will happen on split.
 *
 */
var nr = 10000000000;

// temp to debug copy problem
function Container(data) {
  this['.'] = data;
}

var Packet = (function () {
  function Packet(owner, data, type, n, c) {
    _classCallCheck(this, Packet);

    this.owner = owner;
    this.trail = [];
    this.typeTrail = [];

    if (type === undefined) {
      throw Error('type not specified');
    }

    this.type = type;

    // err ok, string must be assigned to? or {".": "string"}
    // which means base is /. instead of ''
    this.__data = data instanceof Container ? data : new Container(data);
    this.chi = {};
    this.nr = n ? n : nr++;
    this.c = c ? c : 0; // clone version
    this.pointer = JsonPointer.create('/.');

    Object.defineProperty(this, 'data', {
      get: function get() {
        throw Error('data property should not be accessed');
      },
      set: function set() {
        throw Error('data property should not be written to');
      }
    });

    // probably too much info for a basic packet.
    // this.created_at =
    // this.updated_at =
  }

  /**
   *
   * Pointer is a JSON Pointer.
   *
   * If the pointer does not start with a slash
   * the pointer will be (forward) relative to the current position
   * If the pointer is empty the pointer will be to the root.
   *
   * @param {Object} owner
   * @param {String} pointer JSON Pointer
   */

  _createClass(Packet, [{
    key: 'point',
    value: function point(owner, pointer) {
      if (this.isOwner(owner)) {
        if (pointer === undefined || pointer === '') {
          this.pointer = JsonPointer.create('/.');
        } else if (pointer[0] === '/') {
          this.pointer = JsonPointer.create('/.' + pointer);
        } else {
          this.pointer = JsonPointer.create(this.pointer.pointer + '/' + pointer);
        }
        return this;
      }
    }
  }, {
    key: 'read',
    value: function read(owner) {
      if (this.isOwner(owner)) {
        return this.pointer.get(this.__data);
      }
    }
  }, {
    key: 'write',
    value: function write(owner, data, type) {
      if (this.isOwner(owner)) {
        this.pointer.set(this.__data, data);
        if (type) {
          this.type = type;
        }
        return this;
      }
    }

    // clone can only take place on plain object data.

    /**
     * Clone the current packet
     *
     * In case of non plain objects it's mostly desired
     * not to clone the data itself, however do create a *new*
     * packet with the other cloned information.
     *
     * To enable this set cloneData to true.
     *
     * @param {Object} owner Owner of the packet
     * @param {Boolean} cloneData Whether or not to clone the data.
     */

  }, {
    key: 'clone',
    value: function clone(owner) {
      if (this.isOwner(owner)) {
        var p = new Packet(owner, null, null, this.nr, ++this.c);
        if (!this.type) {
          throw Error('Refusing to clone substance of unkown type');
        }
        // TODO: make sure String Object are always lowercase.
        // I think they are..
        if (this.type === 'function' || /[A-Z]/.test(this.type)) {
          // do not clone, ownership will throw if things go wrong
          // gah, this is hard.
          var d = this.__data;
          p.__data = d;
        } else {
          p.__data = JSON.parse(JSON.stringify(this.__data));
        }
        p.type = this.type;
        p.pointer = JsonPointer.create(this.pointer.pointer);
        p.set('chi', JSON.parse(JSON.stringify(this.chi)));
        return p;
      }
    }
  }, {
    key: 'setType',
    value: function setType(owner, type) {
      if (this.isOwner(owner)) {
        this.typeTrail.push(this.type);
        this.type = type;
        return this;
      }
    }
  }, {
    key: 'release',
    value: function release(owner) {
      if (this.isOwner(owner)) {
        this.trail.push(owner);
        this.owner = undefined;
        return this;
      }
    }
  }, {
    key: 'setOwner',
    value: function setOwner(newOwner) {
      if (this.owner === undefined) {
        this.owner = newOwner;
        return this;
      } else {
        if (newOwner === this.owner) {
          throw Error('Packet already owned by this owner');
        } else {
          throw Error('Refusing to overwrite owner');
        }
      }
    }
  }, {
    key: 'hasOwner',
    value: function hasOwner() {
      return this.owner !== undefined;
    }
  }, {
    key: 'isOwner',
    value: function isOwner(owner) {
      if (owner === this.owner) {
        return true;
      } else {
        if (!owner) {
          throw Error('Packet expects an owner object as parameter');
        } else if (this.owner === undefined) {
          throw Error('Packet is unclaimed, claim it first');
        } else {
          console.log('REQUESTOR:', owner.identifier || owner);
          console.log('OWNER', this.owner.identifier || this.owner);
          throw Error('Packet is not owned by this instance.');
        }
      }
    }
  }, {
    key: 'dump',
    value: function dump() {
      return JSON.stringify(this, null, 2);
    }

    // Are these used?

  }, {
    key: 'set',
    value: function set(prop, val) {
      this[prop] = val;
    }
  }, {
    key: 'get',
    value: function get(prop) {
      return this[prop];
    }
  }, {
    key: 'del',
    value: function del(prop) {
      delete this[prop];
    }
  }, {
    key: 'has',
    value: function has(prop) {
      return this.hasOwnProperty(prop);
    }
  }]);

  return Packet;
})();

module.exports = Packet;
//# sourceMappingURL=packet.js.map

},{"json-ptr":59}],32:[function(require,module,exports){
'use strict'

/**
 *
 * Port
 *
 * Distinct between input & output port
 * Most methods are for input ports.
 *
 * @example
 *
 *  var port = new Port();
 *  port.receive(p);
 *  port.receive(p); // rejected
 *  port.read();
 *  port.read();
 *  port.receive(p);
 *
 */
;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Port = (function () {
  function Port() {
    _classCallCheck(this, Port);

    // important to just name it input for refactor.
    // eventually can be renamed to something else.
    //
    // node.input[port] becomes node.getPort(port).input
    //
    this.input = undefined;

    this._open = false;

    // If async the value will pass right through a.k.a. non-blocking
    // If there are multiple async ports, the code implementation
    // consequently must be a state machine.
    // async + sync is still possible. One async port is just one
    // function call and thus not a state machine.
    this.async = false;
    this._connections = [];
  }

  /**
   *
   * Used from within a component to receive the port data
   *
   */

  _createClass(Port, [{
    key: 'receive',
    value: function receive() {}

    /**
     *
     * Used from within a component to close the port
     *
     * A component receives an open port.
     * When the port closes it's ready to be filled.
     * This also means there are two sides on a port
     * Open for input and open for output to the component.
     *
     */

  }, {
    key: 'close',
    value: function close() {
      this._open = false;
    }
  }, {
    key: 'open',
    value: function open() {
      this._open = true;
    }

    // TODO: after refactor these will end up elsewhere

  }, {
    key: 'hasConnection',
    value: function hasConnection(link) {
      return this._connections && this._connections.indexOf(link) >= 0;
    }
  }, {
    key: 'hasConnections',
    value: function hasConnections() {
      return this._connections.length > 0;
    }
  }, {
    key: 'getConnections',
    value: function getConnections() {
      return this._connections;
    }

    // this seems to be a wrong check?
    // ah no, no property means not filled.
    // but this is just wrong. array port for example is not filled, if it's set.
    // it's being taken care of, but only causes more code to be necessary

  }, {
    key: 'isFilled',
    value: function isFilled() {
      return this.input !== undefined;
    }
  }, {
    key: 'clearInput',
    value: function clearInput() {
      this.input = undefined;
    }
  }, {
    key: 'isAvailable',
    value: function isAvailable() {}

    // Node freePort

  }, {
    key: 'free',
    value: function free() {
      var persist = this.getOption('persist');
      if (persist) {
        // persist, chi, hmz, seeze to exist.
        // but wouldn't matter much, with peristent ports.
        // TODO: this.filled is not used anymore.

        // indexes are persisted per index.
        if (Array.isArray(persist)) {
          for (var k in this.input) {
            if (persist.indexOf(k) === -1) {
              // remove
              delete this.input[k];
            }
          }
        }
      } else {
        // not sure, activeConnections could stay a node thing.

        // this also removes context and default..
        this.clearInput();

        this.event(':freePort', {
          node: this.export(),
          link: this._activeConnections,
          port: this.name
        });

        this.emit('freePort', {
          node: this.export(),
          link: this._activeConnections,
          port: this.name
        });

        // delete reference to active connection (if there was one)
        delete this._activeConnections;
      }
    }
  }, {
    key: 'getOption',
    value: function getOption(opt) {
      if (this.hasOwnProperty(opt)) {
        return this[opt];
      } else {
        return undefined;
      }
    }

    /**
     *
     * Sets an input port option.
     *
     * The node schema for instance can specifiy whether a port is persistent.
     *
     * At the moment a connection can override these values.
     * It's a way of saying I give you this once so take care of it.
     *
     */

  }, {
    key: 'setOption',
    value: function setOption(opt, value) {
      this[opt] = value;
    }
  }, {
    key: 'setOptions',
    value: function setOptions(options) {
      var opt;
      var port;
      for (port in options) {
        if (options.hasOwnProperty(port)) {
          for (opt in options[port]) {
            if (options[port].hasOwnProperty(opt)) {
              if (options.hasOwnProperty(opt)) {
                this.setOption(opt, options[opt]);
              }
            }
          }
        }
      }
    }
  }]);

  return Port;
})();

// requeue

Port.INPUT_REVOKED = false; // removed by a portbox
Port.NOT_FILLED = false; // ??

// used in input port available
Port.AVAILABLE = true; // non index port was set
Port.UNAVAILABLE = false; // not an index port but input is already set
Port.INDEX_AVAILABLE = true; // index was set
Port.INDEX_NOT_AVAILABLE = false; // index already filled
// could be the same as index not available,
// this just tells it's full and will be processed
Port.ARRAY_PORT_FULL = false;

// index was set, but waiting others to be filled
Port.AWAITING_INDEX = true;

// this is a weird return code,
// because it's probably not about the filled port itself
Port.CONTEXT_SET = true;
Port.PERSISTED_SET = true; // idem
Port.DEFAULT_SET = true; // idem
Port.NOT_REQUIRED = true; // idem
Port.FILLED = true; // port was filled.

module.exports = Port;
//# sourceMappingURL=port.js.map

},{}],33:[function(require,module,exports){
'use strict';

var Port = require('../port');
var util = require('util');
var Packet = require('../packet');

var portFill = undefined;

module.exports = portFill = exports;

/***
 *  Packet
 * - fill with persist, done
 * - fill with context, done
 * - fill with defaults
 *  Object:
 *  - enrich with defaults
 *
 * defaults -> context
 * defaults -> persist
 * defaults -> input
 *
 * @param {Node} node The node
 * @param {Object} ports Input port definitions
 * @param {Object} input Current input
 * @param {Object} context Context
 * @param {Object} persist Input to be persisted
 **/
exports.fill = function fill(node) {
  var ports = node.ports.input;
  // For every non-connceted port fill the defaults

  for (var port in ports) {
    if (ports.hasOwnProperty(port)) {
      if (node.portHasConnections(port) && !node.persist.hasOwnProperty(port)) {
        // mainly to not fill async ports with connects
        // but do have defaults
        // nop
      } else {
          // seems the return is not correct no more also.
          var ret = portFill.defaulter(node, port, []);
          if (util.isError(ret)) {
            return ret;
          }
        }
    }
  }

  return true;
};

// also fill the defaults one level deep..
/**
 *
 * @param {xNode} node
 * @param {String} port
 * @param {String} path
 * @private
 */
exports.defaulter = function defaulter(node, port, path) {
  if (!portFill.check(node, node.ports.input, port, node.input, node.context, node.persist, path) && !node.ports.input[port].async) {
    if (port[0] !== ':') {
      return Port.SYNC_PORTS_UNFULFILLED;
      /*
        // fail hard
        return Error(util.format(
          '%s: Cannot determine input for port `%s`',
          node.identifier,
          port
        ));
      */
    }
  }
};

/***
 *
 * Fills properties with defaults
 *
 * Note how context and persist make no sense here...
 * It's already filled.
 *
 * @param {xNode} node Node
 * @param {Object} def Current object schema
 * @param {Object} input the input to be filled
 * @param {String} port The port
 */
exports.checkProperties = function checkProperties(node, def, input, port) {
  for (var prop in def.properties) {
    if (def.properties.hasOwnProperty(prop)) {
      var property = def.properties[prop];
      // check the existance of default (a value of null is also valid)
      if (!input.hasOwnProperty(prop)) {
        if (property.hasOwnProperty('default')) {
          input[prop] = property.default;
        } else if (property.required === false) {
          // filled with packet, but the value is undefined.
          // input[key] = null; // undefined not possible at this level.
          input[prop] = undefined; // undefined not possible at this level.
        } else {
            if (property.type === 'object') {
              if (property.hasOwnProperty('properties')) {
                if (!input.hasOwnProperty(prop)) {
                  // always fill with empty object?
                  input[prop] = {};
                }
                return this.checkProperties(node, property, input[prop], port);
              }
            }
            // fail check
            // return or throw?
            // return throw Error(util.format(
            throw Error(util.format('%s: Cannot determine input for port `%s`', node.identifier, port));
          }
      }
    }
  }
};

// first level
/**
 *
 * @param {xNode} node Node
 * @param {Object} def Current object schema
 * @param {String} port Port
 * @param {Object} input the input to be filled
 * @param {Object} context Current level context
 * @param {Object} persist Current level persist
 */
exports.check = function check(node, def, port, input, context, persist) {
  var ret = undefined;

  // check whether input was defined for this port
  if (!input.hasOwnProperty(port)) {
    // This will not really work for persisted indexes
    // or at least it should check whether the array is full after
    // this fill
    ret = Port.NOT_FILLED;
    if (persist && persist.hasOwnProperty(port)) {
      input[port] = persist[port].clone(node);
      ret = Port.PERSISTED_SET;
    } else if (context && context.hasOwnProperty(port)) {
      // if there is context, use that.
      input[port] = context[port].clone(node);
      ret = Port.CONTEXT_SET;
      // check the existance of default (a value of null is also valid)
    } else if (def[port].hasOwnProperty('default')) {
        input[port] = new Packet(node, def[port].default, node.getPortType('input', port));
        ret = Port.DEFAULT_SET;
      } else if (def[port].required === false) {
        // filled with packet, but the value is undefined.
        input[port] = new Packet(node, undefined, node.getPortType('input', port));
        ret = Port.NOT_REQUIRED;
      }

    // if it's an object, fill in defaults
    if (def[port].properties) {
      //
      var init = undefined;
      var obj = {};

      // initialize packet on the first level
      if (!input[port]) {
        init = true;
        input[port] = new Packet(node, obj, 'object');
      } else {
        obj = input[port].read(node) || {};
      }

      portFill.checkProperties(node, def[port], obj, port);

      // TODO: check ret value correctness
      if (!Object.keys(obj).length && init) {
        // remove empty packet again
        delete input[port];
        ret = Port.NOT_FILLED;
      } else {
        ret = Port.FILLED;
      }
    }

    return ret;
  } else {
    return Port.FILLED;
  }
};
//# sourceMappingURL=filler.js.map

},{"../packet":31,"../port":32,"util":6}],34:[function(require,module,exports){
(function (process){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var uuid = require('uuid').v4;
var EventEmitter = require('events').EventEmitter;

var onExit = [];
if (process.on) {
  // old browserify
  process.on('exit', function onExitHandlerProcessManager() {
    onExit.forEach(function (instance) {
      var reports = {};

      for (var _process in instance.processes.values()) {
        if (_process.type === 'flow') {
          var report = _process.report();
          if (!report.ok) {
            reports[_process] = report;
          }
        }
      }

      if (Object.keys(reports).length) {
        instance.emit('report', reports);
      }
    });
  });
}

/**
 *
 * Default Process Manager
 *
 * @constructor
 * @public
 *
 */

var ProcessManager = (function (_EventEmitter) {
  _inherits(ProcessManager, _EventEmitter);

  function ProcessManager() {
    _classCallCheck(this, ProcessManager);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ProcessManager).call(this));

    _this.processes = new Map();
    onExit.push(_this);
    return _this;
  }

  _createClass(ProcessManager, [{
    key: 'getMainGraph',
    value: function getMainGraph() {
      return this.getMainGraphs().pop();
    }
  }, {
    key: 'getMainGraphs',
    value: function getMainGraphs() {
      var main = [];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.processes.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _process2 = _step.value;

          if (_process2.type === 'flow' && !_process2.hasParent()) {
            main.push(_process2);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return main;
    }
  }, {
    key: 'onProcessStartHandler',
    value: function onProcessStartHandler(event) {
      this.emit('startProcess', event.node);
    }
  }, {
    key: 'onProcessStopHandler',
    value: function onProcessStopHandler(event) {
      this.emit('stopProcess', event.node);
    }
  }, {
    key: 'register',
    value: function register(node) {
      if (node.pid) {
        throw new Error('Refusing to add node with existing process id');
      }

      var pid = uuid();
      node.setPid(pid);
      this.processes.set(pid, node);

      // Note: at the moment only subgraphs emit the start event.
      // and only subgraphs can be stopped, this is good I think.
      // The process manager itself holds *all* nodes.
      // Start is a push on the actor.
      // However, when we start a network we only care about
      // the push on the main actor, not the subgraphs.
      // So this is something to think about when you listen
      // for startProcess.
      // Maybe for single stop and start of nodes the actor should be used
      // and the actor emits the stop & start events, with the node info
      // To stop a node: this.get(graphId).hold(nodeId);
      // Ok you just do not stop single nodes, you hold them.
      // Stop a node and your network is borked.
      node.on('start', this.onProcessStartHandler.bind(this));
      node.on('stop', this.onProcessStopHandler.bind(this));

      // Process manager handles all errors.
      // or in fact, ok we have to add a errorHandler ourselfes also
      // but the process manager will be able to do maintainance?
      node.on('error', this.processErrorHandler.bind(this));

      // pid is in node.pid
      this.emit('addProcess', node);
    }

    /**
     *
     * Process Error Handler.
     *
     * The only errors we receive come from the nodes themselves.
     * It's also garanteed if we receive an error the process itself
     * Is already within an error state.
     *
     */

  }, {
    key: 'processErrorHandler',
    value: function processErrorHandler(event) {
      if (event.node.status !== 'error') {
        console.log('STATUS', event.node.status);
        throw Error('Process is not within error state', event.node.status);
      }

      // Emit it, humans must solve this.
      this.emit('error', event);
    }
  }, {
    key: 'changePid',
    value: function changePid(from, to) {
      if (this.processes.has(from)) {
        this.processes.set(to, this.processes.get(from));
        this.processes.delete(from);
      } else {
        throw Error('Process id not found');
      }

      this.emit('changePid', {
        from: from,
        to: to
      });
    }
  }, {
    key: 'getProcess',
    value: function getProcess(pid) {
      if (this.processes.has(pid)) {
        return this.processes.get(pid);
      }
      throw Error('Process id not found');
    }

    // TODO: improve start, stop, hold, release logic..

  }, {
    key: 'start',
    value: function start(node) {
      // allow by pid and by node object
      var pid = (typeof node === 'undefined' ? 'undefined' : _typeof(node)) === 'object' ? node.pid : node;
      var process = this.getProcess(pid);
      if (process.type === 'flow') {
        process.start();
      } else {
        process.release();
      }
    }
  }, {
    key: 'stop',
    value: function stop(node, cb) {
      // allow by pid and by node object
      var pid = (typeof node === 'undefined' ? 'undefined' : _typeof(node)) === 'object' ? node.pid : node;

      var process = this.getProcess(pid);
      if (process.type === 'flow') {
        process.stop(cb);
      } else {
        process.hold(cb);
      }
    }

    // TODO: just deleting is not enough.
    // links also contains the pids
    // on remove process those links should also be removed.

  }, {
    key: 'unregister',
    value: function unregister(node, cb) {
      if (!node.pid) {
        throw new Error('Process id not found');
      }

      var _onUnregister = (function onUnregister(node, cb) {
        node.removeAllListeners('start');
        node.removeAllListeners('stop');
        node.removeAllListeners('error');

        this.processes.delete(node.pid);

        // remove pid
        delete node.pid;

        // todo maybe normal nodes should also use stop + cb?
        if (cb) {
          cb(node);
        }

        this.emit('removeProcess', node);
      }).bind(this, node, cb);

      var process = this.getProcess(node.pid);

      if (process.type === 'flow') {
        // wait for `subgraph` to be finished
        this.stop(node, _onUnregister);
      } else {
        node.shutdown(_onUnregister);
      }
    }

    /**
     *
     * Get Process
     * Either by id or it's pid.
     *
     */

  }, {
    key: 'get',
    value: function get(pid) {
      return this.processes.get(pid);
    }

    /**
     *
     * Using the same subgraph id for processes can work for a while.
     *
     * This method makes it possible to find graphs by id.
     *
     * Will throw an error if there is a process id conflict.
     *
     * If a containing actor is passed as second parameter
     * the uniqueness of the node is garanteed.
     *
     */

  }, {
    key: 'getById',
    value: function getById(id, actor) {
      return this.findBy('id', id, actor);
    }
  }, {
    key: 'findBy',
    value: function findBy(prop, value, actor) {
      var found = undefined;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.processes.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var _process3 = _step2.value;

          if (_process3[prop] === value && (!actor || actor.hasNode(_process3.id))) {
            if (found) {
              console.log(this.processes);
              throw Error('conflict: multiple ' + prop + 's matching ' + value);
            }
            found = _process3;
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return found;
    }
  }, {
    key: 'filterByStatus',
    value: function filterByStatus(status) {
      return this.filterBy('status', status);
    }
  }, {
    key: 'filterBy',
    value: function filterBy(prop, value) {
      var filtered = [];

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = this.processes.values()[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _process4 = _step3.value;

          if (_process4[prop] === value) {
            filtered.push(_process4);
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return filtered;
    }
  }]);

  return ProcessManager;
})(EventEmitter);

module.exports = ProcessManager;
//# sourceMappingURL=defaultManager.js.map

}).call(this,require("z02cDi"))
},{"events":1,"uuid":61,"z02cDi":4}],35:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var format = require('util').format;
var debug = require('debug')('chix:queue');
var Queue = require('./queue');

/**
 *
 * Default Queue Manager
 *
 * @constructor
 * @public
 *
 */

var QueueManager = (function () {
  function QueueManager(dataHandler) {
    _classCallCheck(this, QueueManager);

    this.queues = {};
    this._shutdown = false;

    this.locks = {}; /* node locks */

    this.pounders = 0; /* cumulative count */

    Object.defineProperty(this, 'inQueue', {
      enumerable: true,
      get: function get() {
        // snapshot of queueLength
        var inQ = 0;
        for (var id in this.queues) {
          if (this.queues.hasOwnProperty(id)) {
            inQ += this.queues[id].queue.length;
          }
        }
        return inQ;
      }
    });

    this.onData(dataHandler);
  }

  _createClass(QueueManager, [{
    key: 'onData',
    value: function onData(handler) {
      this.sendData = handler;
    }
  }, {
    key: 'pounder',
    value: function pounder() {
      var self = this.self;
      if (!self.queues.hasOwnProperty(this.id)) {
        throw Error('Unclean shutdown: Pounding on non-exist substance');
      }

      var queue = self.queues[this.id];
      queue.pounders--;
      self.pounders--;

      var inQueue = queue.queue.length;
      if (inQueue === 0) {
        throw Error('nothing in queue this should not happen!');
      }

      var p = self.pick(this.id);

      if (self._shutdown) {
        self.drop('queued', this.id, p);
      } else if (self.isLocked(this.id)) {
        self.unshift(this.id, p);
      }

      debug('%s:%s.%s send data', this.id, p.nr, p.c);
      self.sendData(this.id, p);
    }
  }, {
    key: 'getQueue',
    value: function getQueue(id) {
      if (this.queues.hasOwnProperty(id)) {
        return this.queues[id];
      }

      throw Error(format('queue id: `%s` is unmanaged', id));
    }
  }, {
    key: 'pound',
    value: function pound(id) {
      if (!id) {
        throw Error('no id!');
      }

      this.getQueue(id).pounders++;
      this.pounders++;

      setTimeout(this.pounder.bind({
        id: id,
        self: this
      }), 0);
    }
  }, {
    key: 'get',
    value: function get(id) {
      return this.getQueue(id).queue;
    }

    /**
     *
     * Queue data for the link given
     *
     * @param {string} id
     * @param {Packet} p
     * @public
     */

  }, {
    key: 'queue',
    value: function queue(id, p) {
      if (p.constructor.name !== 'Packet') {
        throw Error('not an instance of Packet');
      }

      if (this._shutdown) {
        this.drop('queue', id, p);
      } else {
        this.init(id);
        this.getQueue(id).queue.push(p);

        // as many pounds as there are items within queue.
        // the callback is just picking the last item not per se
        // the item we have just put within queue.
        this.pound(id);
      }
    }
  }, {
    key: 'init',
    value: function init(id) {
      if (!this.queues.hasOwnProperty(id)) {
        this.queues[id] = new Queue();
      }
    }
  }, {
    key: 'unshift',
    value: function unshift(id, p) {
      this.getQueue(id).queue.unshift(p);
    }

    /**
     *
     * Pick an item from the queue.
     *
     * @param {id} id
     * @public
     */

  }, {
    key: 'pick',
    value: function pick(id) {
      if (this.hasQueue(id)) {
        return this.queues[id].queue.shift();
      }
    }

    /**
     *
     * Determine whether there is a queue for this link.
     *
     * @param {string} id
     * @public
     */

  }, {
    key: 'hasQueue',
    value: function hasQueue(id) {
      return this.queues[id] && this.queues[id].queue.length > 0;
    }
  }, {
    key: 'isManaged',
    value: function isManaged(id) {
      return this.queues.hasOwnProperty(id);
    }
  }, {
    key: 'size',
    value: function size(id) {
      return this.getQueue(id).queue.length;
    }

    /**
     *
     * Reset this queue manager
     *
     * @public
     */

  }, {
    key: 'reset',
    value: function reset(cb) {
      var self = this;
      var retries = 10;

      this._shutdown = true;

      // all unlocked
      this.unlockAll();

      var countdown = retries;

      var func = function ShutdownQueManager() {
        if (countdown === 0) {
          debug('Failed to stop queue after %s cycles', retries);
        }

        if (self.inQueue === 0 || countdown === 0) {
          self.queues = {};

          self._shutdown = false;

          if (cb) {
            cb();
          }
        } else {
          countdown--;
          setTimeout(func, 0);
        }
      };

      // put ourselves at the back of all unlocks.
      setTimeout(func, 0);
    }
  }, {
    key: 'isLocked',
    value: function isLocked(id) {
      // means whether it has queue length..
      if (!this.isManaged(id)) {
        return false;
      }
      return this.getQueue(id).lock;
    }
  }, {
    key: 'lock',
    value: function lock(id) {
      debug('%s: lock', id);
      this.init(id);
      this.getQueue(id).lock = true;
    }
  }, {
    key: 'flushAll',
    value: function flushAll() {
      debug('flush all');
      for (var id in this.queues) {
        if (this.queues.hasOwnProperty(id)) {
          this.flush(id);
        }
      }
    }
  }, {
    key: 'purgeAll',
    value: function purgeAll() {
      debug('purge all');
      for (var id in this.queues) {
        if (this.queues.hasOwnProperty(id)) {
          this.purge(this.queues[id]);
        }
      }
    }
  }, {
    key: 'purge',
    value: function purge(q) {
      debug('%s: purge', q.id);
      while (q.queue.length) {
        this.drop('purge', q.queue.pop());
      }
    }
  }, {
    key: 'unlockAll',
    value: function unlockAll() {
      debug('unlock all');
      for (var id in this.queues) {
        if (this.queues.hasOwnProperty(id)) {
          this.unlock(id);
        }
      }
    }
  }, {
    key: 'unlock',
    value: function unlock(id) {
      debug('%s: unlock', id);
      if (this.isLocked(id)) {
        this.flush(id);
      }
    }
  }, {
    key: 'flush',
    value: function flush(id) {
      debug('%s: flush', id);
      var q = this.getQueue(id);

      // first determine current length
      var currentLength = q.queue.length - q.pounders;

      q.lock = false;

      for (var i = 0; i < currentLength; i++) {
        this.pound(id);
      }
    }

    // not sure, maybe make only the ioHandler responsible for this?

  }, {
    key: 'drop',
    value: function drop(type) {
      debug('dropping packet: %s %s', type, this.inQueue);
    }

    /**
     *
     * Used to get all queues which have queues.
     * Maybe I should just remove queues.
     * But queues reappear so quickly it's not
     * worth removing it.
     *
     * Something to fix later, in that case this.queues
     * would always be queues which have items.
     *
     * Anyway for debugging it's also much easier
     * because there will not be a zillion empty queues.
     *
     * Usage:
     *
     * if (qm.inQueue()) {
    *   var queued = qm.getQueued();
    * }
     *
     */

  }, {
    key: 'getQueues',
    value: function getQueues() {
      var queued = {};
      for (var id in this.queues) {
        if (this.queues.hasOwnProperty(id)) {
          if (this.queues[id].queue.length > 0) {
            queued[id] = this.queues[id];
          }
        }
      }
      return queued;
    }
  }]);

  return QueueManager;
})();

module.exports = QueueManager;
//# sourceMappingURL=defaultManager.js.map

},{"./queue":36,"debug":"V4HZ/5","util":6}],36:[function(require,module,exports){
"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Queue = function Queue() {
  _classCallCheck(this, Queue);

  this.lock = false;
  this.queue = [];
  this.pounders = 0;
};

module.exports = Queue;
//# sourceMappingURL=queue.js.map

},{}],37:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DefaultContextProvider = require('./context/defaultProvider');

/**
 *
 * We will run inside an instance.
 *
 * At the moment the run context is purely the callback.
 * TODO: which fails hard
 *
 */

var Run = (function () {
  function Run(actor, callback) {
    _classCallCheck(this, Run);

    this.actor = actor;

    // Used with callback handling
    // Keeps track of the number of exposed output ports
    this.outputPorts = [];

    // data we will give to the callback
    this.output = {};
    this.outputCount = 0;

    this.callback = callback;

    if (!actor.contextProvider) {
      actor.contextProvider = new DefaultContextProvider();
    }

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = actor.nodes.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var node = _step.value;

        // Als deze node in onze view zit
        if (actor.view.indexOf(node.id) >= 0) {
          if (this.callback && node.ports && node.ports.output) {
            for (var key in node.ports.output) {
              // this is related to actions.
              // not sure If I want to keep that..
              // Anyway expose is gone, so this is never
              // called now.
              //
              // expose bestaat niet meer, de integrerende flow
              // krijgt gewoon de poorten nu.
              if (node.ports.output.hasOwnProperty(key)) {
                if (node.ports.output[key].expose) {
                  this.outputPorts.push(key);
                }
              }
            }

            node.on('output', this.handleOutput.bind(this));
          }
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    if (this.callback && !this.outputPorts.length) {
      throw new Error('No exposed output ports available for callback');
    }

    if (actor.trigger) {
      actor.sendIIP(actor.trigger, '');
    }
  }

  _createClass(Run, [{
    key: 'handleOutput',
    value: function handleOutput(data) {
      if (this.outputPorts.indexOf(data.port) >= 0) {
        if (!this.output.hasOwnProperty(data.node.id)) {
          this.output[data.node.id] = {};
        }

        this.output[data.node.id][data.port] = data.out;

        this.outputCount++;

        if (this.outputPorts.length === this.outputCount) {
          this.outputCount = 0; // reset

          this.callback.apply(this.actor, [this.output]);

          this.output = {};
        }
      }
    }
  }]);

  return Run;
})();

module.exports = Run;
//# sourceMappingURL=run.js.map

},{"./context/defaultProvider":21}],38:[function(require,module,exports){
(function (process,global){
'use strict'

/* global window */

;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var IOBox = require('iobox');
var path = require('path');

// taken from underscore.string.js
function _underscored(str) {
  // also underscore dot
  return str.replace(/([a-z\d])([A-Z]+)/g, '$1_$2').replace(/[\.\-\s]+/g, '_').toLowerCase();
}

/**
 *
 * NodeBox
 *
 * @constructor
 * @public
 *
 */

var NodeBox = (function (_IOBox) {
  _inherits(NodeBox, _IOBox);

  function NodeBox(name) {
    _classCallCheck(this, NodeBox);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(NodeBox).call(this, name));

    _this.name = name || 'NodeBox';
    _this.define();
    return _this;
  }

  _createClass(NodeBox, [{
    key: 'define',
    value: function define() {
      // Define the structure
      this.addArg('input', {});
      this.addArg('output', {});
      this.addArg('state', {});
      this.addArg('done', null);
      this.addArg('cb', null);
      //this.addArg('console', console);

      this.addArg('on', {
        input: {}
      }); // dynamic construction

      // what to return from the function
      this.addReturn('output');
      this.addReturn('state');
      this.addReturn('on');
    }

    /**
     *
     * Add requires to the sandbox.
     *
     * xNode should use check = true and then have
     * a try catch block.
     *
     * @param {Object} requires
     * @param {Boolean} check
     */

  }, {
    key: 'require',
    value: (function (_require) {
      function require(_x, _x2) {
        return _require.apply(this, arguments);
      }

      require.toString = function () {
        return _require.toString();
      };

      return require;
    })(function (requires, check) {
      // Ok, the generic sandbox should do the same logic
      // for adding the requires but should not check if
      // they are available.
      var ukey = undefined;

      // 'myrequire': '<version'
      for (var key in requires) {
        if (requires.hasOwnProperty(key)) {
          // only take last part e.g. chix-flow/SomeThing-> some_thing
          ukey = _underscored(key.split('/').pop());

          this.emit('require', {
            require: key
          });

          if (check !== false) {
            if (typeof requires[key] !== 'string') {
              // assume it's already required.
              // the npm installed versions use this.
              // e.g. nodule-template
              this.addArg(ukey, requires[key]);
            } else {
              try {
                this.addArg(ukey, require(key));
              } catch (e) {
                // last resort, used by cli
                var p = path.resolve(process.cwd(), 'node_modules', key);
                this.addArg(ukey, require(p));
              }
            }
          } else {
            // just register it, used for generate
            this.addArg(ukey, undefined);
          }
        }
      }
    })
  }, {
    key: 'expose',
    value: function expose(_expose, CHI) {
      // created to allow window to be exposed to a node.
      // only meant to be used for dom nodes.
      var g = typeof window === 'undefined' ? global : window;

      if (_expose) {
        for (var i = 0; i < _expose.length; i++) {
          this.emit('expose', {
            expose: _expose[i]
          });

          if (_expose[i] === 'window') {
            this.addArg('win', window);
          } else if (_expose[i] === 'chi') {
            this.addArg('chi', CHI);
          } else if (_expose[i] === 'self') {
            this.addArg('self', this);
          } else {
            // Do not re-expose anything already going in
            if (!this.args.hasOwnProperty(_expose[i])) {
              this.addArg(_expose[i], g[_expose[i]]);
            }
          }
        }
      }
    }
  }, {
    key: 'compile',
    value: function compile(fn) {
      return _get(Object.getPrototypeOf(NodeBox.prototype), 'compile', this).call(this, fn, true // return as object
      );
    }

    /**
     *
     * Runs the sandbox.
     *
     */

  }, {
    key: 'run',
    value: function run(bind) {
      var res = _get(Object.getPrototypeOf(NodeBox.prototype), 'run', this).apply(this, [bind]);
      var ret = undefined;

      // puts the result back into our args/state
      // TODO: I do not think this is needed?
      for (var k in res) {
        if (k === 'return') {
          ret = res.return;
        } else if (res.hasOwnProperty(k)) {
          this.set(k, res[k]);
        }
      }
      return ret; // original return value
    }
  }]);

  return NodeBox;
})(IOBox);

module.exports = NodeBox;
//# sourceMappingURL=node.js.map

}).call(this,require("z02cDi"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"iobox":51,"path":3,"z02cDi":4}],39:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var NodeBox = require('./node');

/**
 *
 * PortBox
 *
 * @constructor
 * @public
 *
 */

var PortBox = (function (_NodeBox) {
  _inherits(PortBox, _NodeBox);

  function PortBox(name) {
    _classCallCheck(this, PortBox);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(PortBox).call(this, name));

    _this.name = name || 'PortBox';
    return _this;
  }

  _createClass(PortBox, [{
    key: 'define',
    value: function define() {
      // Define the structure
      this.addArg('data', null);
      this.addArg('x', {}); // not sure, _is_ used but set later
      this.addArg('source', null); // not sure..
      this.addArg('state', {});
      this.addArg('input', {});
      this.addArg('output', null); // output function should be set manually

      // what to return from the function.
      this.addReturn('state');
    }
  }]);

  return PortBox;
})(NodeBox);

module.exports = PortBox;
//# sourceMappingURL=port.js.map

},{"./node":38}],40:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

/**
 *
 * Setting
 *
 * Both used by Connector and xLink
 *
 * @constructor
 * @public
 *
 */

var Setting = (function (_EventEmitter) {
  _inherits(Setting, _EventEmitter);

  function Setting(settings) {
    _classCallCheck(this, Setting);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Setting).call(this));

    for (var key in settings) {
      if (settings.hasOwnProperty(key)) {
        _this.set(key, settings[key]);
      }
    }
    return _this;
  }

  /**
   *
   * Set
   *
   * Sets a setting
   *
   * @param {String} name
   * @param {Any} val
   */

  _createClass(Setting, [{
    key: 'set',
    value: function set(name, val) {
      if (undefined !== val) {
        if (!this.setting) {
          this.setting = {};
        }
        this.setting[name] = val;

        this.emit('change', this, 'setting', this.setting);
      }
    }

    /**
     *
     * Get
     *
     * Returns the setting or undefined.
     *
     * @returns {Any}
     */

  }, {
    key: 'get',
    value: function get(name) {
      return this.setting ? this.setting[name] : undefined;
    }

    /**
     *
     * Delete a setting
     *
     * @returns {Any}
     */

  }, {
    key: 'del',
    value: function del(name) {
      if (this.setting && this.setting.hasOwnProperty(name)) {
        delete this.setting[name];
      }
    }

    /**
     *
     * Check whether a setting is set.
     *
     * @returns {Any}
     */

  }, {
    key: 'has',
    value: function has(name) {
      return this.setting && this.setting.hasOwnProperty(name);
    }
  }]);

  return Setting;
})(EventEmitter);

module.exports = Setting;
//# sourceMappingURL=setting.js.map

},{"events":1}],41:[function(require,module,exports){
'use strict';

var jsongate = require('json-gate');
var mSjson = require('../schemas/map.json');
var nDjson = require('../schemas/node.json');
var ljson = require('../schemas/link.json');
var mapSchema = jsongate.createSchema(mSjson);
var nodeSchema = jsongate.createSchema(nDjson);
var linkSchema = jsongate.createSchema(ljson);
var isPlainObject = require('is-plain-object');
var instanceOf = require('instance-of');

function ValidationError(message, id, obj) {
  this.message = message;
  this.id = id;
  this.obj = obj;
  this.name = 'ValidationError';
}

/**
 *
 * Check if we are not adding a (rotten) flow. Where there are id's which
 * overlap other ids in other flows.
 *
 * This shouldn't happen but just perform this check always.
 *
 */
function _checkIds(flow, nodeDefinitions) {
  var knownIds = [];
  var nodes = {};
  var node = undefined;
  var link = undefined;
  var source = undefined;
  var target = undefined;

  if (flow.nodes.length > 0 && !nodeDefinitions) {
    throw new Error('Cannot validate without nodeDefinitions');
  }

  // we will not add the flow, we will show a warning and stop adding the
  // flow.
  for (var i = 0; i < flow.nodes.length; i++) {
    node = flow.nodes[i];

    // nodeDefinition should be loaded
    if (!node.ns) {
      throw new ValidationError('NodeDefinition without namespace: ' + node.name);
    }
    if (!nodeDefinitions[node.ns]) {
      throw new ValidationError('Cannot find nodeDefinition namespace: ' + node.ns);
    }
    if (!nodeDefinitions[node.ns][node.name]) {
      throw new ValidationError('Cannot find nodeDefinition name ' + node.ns + ' ' + node.name);
    }

    knownIds.push(node.id);
    nodes[node.id] = node;
    //_checkPortDefinitions(nodeDefinitions[node.ns][node.name]);
  }

  for (var i = 0; i < flow.links.length; i++) {
    link = flow.links[i];

    // links should not point to non-existing nodes.
    if (knownIds.indexOf(link.source.id) === -1) {
      throw new ValidationError('Source node does not exist ' + link.source.id);
    }
    if (knownIds.indexOf(link.target.id) === -1) {
      throw new ValidationError('Target node does not exist ' + link.target.id);
    }

    // check if what is specified as port.out is an input port on the target
    source = nodes[link.source.id];
    target = nodes[link.target.id];

    // allow :start
    if (link.source.port[0] !== ':' && !nodeDefinitions[source.ns][source.name].ports.output[link.source.port]) {
      throw new ValidationError(['Process', link.source.id, 'has no output port named', link.source.port, '\n\n\tOutput ports available:', '\n\n\t', Object.keys(nodeDefinitions[source.ns][source.name].ports.output).join(', ')].join(' '));
    }

    if (link.target.port[0] !== ':' && !nodeDefinitions[target.ns][target.name].ports.input[link.target.port]) {
      throw new ValidationError(['Process', link.target.id, 'has no input port named', link.target.port, '\n\n\tInput ports available:', '\n\n\t', Object.keys(nodeDefinitions[target.ns][target.name].ports.input).join(', ')].join(' '));
    }
  }

  return true;
}

/**
 *
 * Validates a nodeDefinition
 *
 */
function validateNodeDefinition(nodeDef) {
  nodeSchema.validate(nodeDef);
  // _checkIds(flow, nodeDefinitions);
  // make sure the id's are correct
}

function validateLink(ln) {
  linkSchema.validate(ln);
}

/**
 *
 * Validates the flow
 *
 */
function validateFlow(flow) {
  mapSchema.validate(flow);
  // _checkIds(flow, nodeDefinitions);
  // make sure the id's are correct
}

function validateData(type, data) {
  switch (type) {
    case 'string':
      return typeof data === 'string';

    case 'array':
      return Object.prototype.toString.call(data) === '[object Array]';

    case 'integer':
    case 'number':
      return Object.prototype.toString.call(data) === '[object Number]';

    case 'null':
      type = type.charAt(0).toUpperCase() + type.slice(1);
      return Object.prototype.toString.call(data) === '[object ' + type + ']';

    case 'boolean':
    case 'bool':
      return data === true || data === false || data === 0 || data === 1;

    case 'any':
      return true;
    case 'object':
      if (isPlainObject(data)) {
        return true;
      }
      // TODO: not sure if I meant to return all objects as valid objects.
      return instanceOf(data, type);
    case 'function':
      return true;

    default:
      return instanceOf(data, type);
  }
}

module.exports = {
  data: validateData,
  flow: validateFlow,
  link: validateLink,
  nodeDefinition: validateNodeDefinition,
  nodeDefinitions: _checkIds
};
//# sourceMappingURL=validate.js.map

},{"../schemas/link.json":62,"../schemas/map.json":63,"../schemas/node.json":64,"instance-of":50,"is-plain-object":52,"json-gate":56}],"chix-flow":[function(require,module,exports){
module.exports=require('/+Mzp9');
},{}],"/+Mzp9":[function(require,module,exports){
'use strict';

var xNode = require('./lib/node');
var xFlow = require('./lib/flow');
var xLink = require('./lib/link');
var Actor = require('./lib/actor');
var mapSchema = require('./schemas/map.json');
var nodeSchema = require('./schemas/node.json');
var stageSchema = require('./schemas/stage.json');
var Validate = require('./lib/validate');

module.exports = {
  Node: xNode,
  Flow: xFlow,
  Link: xLink,
  Actor: Actor,
  Validate: Validate,
  Schema: {
    Map: mapSchema,
    Node: nodeSchema,
    Stage: stageSchema
  }
};

},{"./lib/actor":12,"./lib/flow":23,"./lib/link":26,"./lib/node":29,"./lib/validate":41,"./schemas/map.json":63,"./schemas/node.json":64,"./schemas/stage.json":65}],44:[function(require,module,exports){
'use strict';

var util         = require('util');
var Store        = require('./store');
var Group        = require('./group');
var PortSyncer   = require('./portSyncer');
var PortPointer  = require('./portPointer');
var EventEmitter = require('events').EventEmitter;

function CHI() {

  if (!(this instanceof CHI)) return new CHI();

  this.groups   = new Store(); // for groups
  this.pointers = new Store(); // for 'pointers'
  this._sync    = new Store(); // for 'syncing'

  this.queue = {};
}

util.inherits(CHI, EventEmitter);

/**
 *
 * Creates a new group/collection
 *
 */
CHI.prototype.group = function(port, cb) {
  // Generates new groupID
  var g = new Group(port, cb);

  this.groups.set(g.gid(), g);
  this.emit('begingroup', g);

  return g;
};

/**
 *
 * Simple way to give a unique common id to the data
 * at the output ports which want to be synced later on.
 *
 *  *in indicates we want to take along the common id of
 *  the other ports also pointing to the process.
 *
 *  Later this can be used with input ports that have
 *  been set to `sync` with the output originating from
 *  a process they specify.
 *
 * @param {String} nodeId
 * @param {String} port      The current port
 * @param {Object} chi
 * @param {Array}  syncPorts Array of port names to sync
 */
CHI.prototype.pointer = function(sourceId, port, p, identifier) {

  if(p.chi.hasOwnProperty(sourceId)) {
    return;
    /*
    throw new Error(
      'item already set'
    );
    */
  }

  var pp = this.pointers.get(sourceId);

  if(!pp) {
    pp = new PortPointer(identifier);
    this.pointers.set(sourceId, pp);
  }

  // will give the correct id, based on the ports queue
  var itemId = pp.add(port);

  // send along with the chi.
  // note: is within the same space as the groups.
  //
  // The packet now remembers the item id given by this node.
  // The Port Pointer which is created per node, stores this
  // item id.
  //
  // The only job of the PortPointer is assigning unique
  // itemIds, ids which are incremented.
  //
  // Then this.pointers keeps track of these PortPointers
  // per node.
  //
  // So what we end up with is a node tagging each and every
  // node who wanted a pointer and keeping track of
  // what ids were assigned. The collection name *is* a PortPointer
  //
  // Then now, how is the match then actually made?
  //
  // Ah... going different routes, that what this was about.
  // The origin is *one* output event *one* item.
  //
  // Then traveling different paths we ask for port sync.
  //
  // This sync is then based on this id, there became different
  // packets carrying this same item id.
  //
  // So probably the problem is cloning, I just have send
  // the chi along and copied that, so everywhere where that's
  // taking place a clone should take place.
  //
  // If I'll look at how sync works, there is probably
  // not a lot which could go wrong. it's the cloning not taking
  // place. I think something get's overwritten constantly.
  // ending up with the last `contents`
  //
  // De packet data keeps changing which is ok, but the chi
  // changes along with it or something.
  p.chi[sourceId] = itemId;

};

CHI.prototype.sync = function(link, originId, p, syncPorts) {

  var ps = this._sync.get(link.target.pid);
  if(!ps) {
    ps = new PortSyncer(originId, syncPorts);
    this._sync.set(link.target.pid, ps);
  }

  //var ret = ps.add(link, data, chi);
  //
  // This returns whatever is synced
  // And somehow this doesn't give us correct syncing.
  var ret = ps.add(link, p);
  if(ret !== undefined) {
    // what do we get returned?
    this.emit('synced', link.target.pid, ret);
  }

  // chi, need not be removed it could be re-used.
};

//CHI.prototype.collect = function(link, output, chi) {
CHI.prototype.collect = function(link, p) {

  var idx, mx = -1, self = this;

  // ok this is actually hard to determine.
  for(var gid in p.chi) {
    if(p.chi.hasOwnProperty(gid)) {
      // determine last group
      idx = this.groups.order.indexOf(gid);
      mx = idx > mx ? idx : mx;
    }
  }

  if(mx === -1) {
    throw Error('Could not match group');
  }

  gid = this.groups.order[mx];

  if(!this.queue.hasOwnProperty(link.ioid)) {
    this.queue[link.ioid] = {};
  }

  if(!Array.isArray(this.queue[link.ioid][gid])) {
    this.queue[link.ioid][gid] = [];
    this.groups.get(gid).on('complete', function() {
      //self.readySend(link, gid, chi);
      self.readySend(link, gid, p);
    });
  }

  // only push the data, last packet is re-used
  // to write the data back.
  this.queue[link.ioid][gid].push(p.read());

  //this.readySend(link, gid, chi);
  this.readySend(link, gid, p);

};

// TODO: should not work on link here..
//CHI.prototype.readySend = function(link, gid, chi) {
CHI.prototype.readySend = function(link, gid, p) {

  // get group
  var group = this.groups.get(gid);

  if(
     // if group is complete
     group.complete &&
     // if queue length matches the group length
     this.queue[link.ioid][gid].length === group.length
     ) {

    // Important: group seizes to exist for _this_ path.
    delete p.chi[gid];

    // Reusing last collected packet to write the group data
    // packet is not owned while arriving
    p.setOwner(link);
    p.write(link, this.queue[link.ioid][gid]);
    link.write(p);

    // reset
    this.queue[link.ioid][gid] = [];

    /* Not sure..
      delete output.chi[gid];        // remove it for our requester
      // group still exists for other paths.
      delete this.store[gid];        // remove from the store
      this.groupOrder.splice(mx, 1); // remove from the groupOrder.
    */
  }

};

// TODO: could just accept a packet and merge it.
CHI.prototype.merge = function (newChi, oldChi, unique) {

  // nothing to merge
  if(Object.keys(oldChi).length) {

    for(var c in oldChi) {
      if(oldChi.hasOwnProperty(c)) {

        if(newChi.hasOwnProperty(c) &&
          newChi[c] !== oldChi[c]
          ) {

          // problem here is, you are overwriting itemId's
          // Test, not sure if this should never happen.
          // When we merge that *is* what is happening no?
          if(unique) {
            throw new Error('refuse to overwrite chi item');
          }
        } else {
          newChi[c] = oldChi[c];
        }
      }
    }
  }
};

module.exports = CHI;

},{"./group":45,"./portPointer":46,"./portSyncer":47,"./store":48,"events":1,"util":6}],45:[function(require,module,exports){
'use strict';

var util = require('util'),
  uuid = require('uuid').v4,
  EventEmitter = require('events').EventEmitter;

/**
 *
 * Simple grouping.
 *
 * Group can be used from within blackbox.
 *
 * Or is used during cyclic and collect mode.
 *
 * During cyclic mode it can be considered virtual grouping.
 *
 * The virtual group will be recollected during collect mode.
 *
 * For now this will be simple, there can only be one collector
 * and the group will seize too exists once it's collected.
 *
 */
function Group(port, cb) {
  if(arguments.length !== 2) {
    throw new Error('Not enough arguments');
  }

  // these are undefined in virtual mode
  this.cb = cb;
  this.port = port;

  var prefix = 'gid-';
  prefix    += port ? port : '';

  this.info = {
    gid: Group.gid(prefix + '-'),
    complete: false,
    items: []
  };

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.info.items.length;
    }
  });

  Object.defineProperty(this, 'complete', {
    get: function() {
      return this.info.complete;
    }
  });

  /**
   *
   * Used to collect incomming data.
   * Until everything from this group is received.
   *
   */
  this.store = [];

  // send out the group info
  // Ok this will not work with the virtual ones
  // there is no port to send to.
  this.send();
}

util.inherits(Group, EventEmitter);

// allow (tests) to overwrite them
Group.gid    = function(prefix) { return prefix + uuid(); };
Group.itemId = uuid;

/**
 *
 * Generates a new itemId and returns
 * The group and itemId
 *
 * Used like this:
 *
 *  cb({
 *    match: match
 *  }, g.item());
 *
 * The item id is send across 'the wire' and we
 * maintain the total group info overhere.
 *
 * [<gid>] = itemId
 * [<gid>] = itemId
 *
 * Which is a bit too magical, so that must change.
 *
 */
Group.prototype.item = function(obj) {

  // auto merging, could be a bit risky
  // no idea if item is ever called without obj?
  obj = obj || {};
  if(obj.hasOwnProperty(this.info.gid)) {
    throw Error('Object is already within group');
  }

  var id = Group.itemId();

  // This is an ordered array
  this.info.items.push(id);

  obj[this.info.gid] = id;
  return obj;
};

/**
 *
 *
 */
Group.prototype.collect = function(packet) {

  this.store.push(packet);

};

Group.prototype.done = function() {
  // ok, now the send should take place.
  // so this triggers the whole output handling
  // of the node, which is what we want.
  // this is the asyncOutput btw..
  this.info.complete = true;
  // check here if something want's this group.
  // or just emit to CHI and let that class check it.
  this.send();

  this.emit('complete', this);

};

// TODO: remove done..
Group.prototype.end = Group.prototype.done;

/***
 *
 * Sends the output using the callback of the
 * node who requested the group.
 *
 * In case of grouping during cyclic mode, for now,
 * there is nothing to send to. In which case
 * the callback is empty.
 *
 */
Group.prototype.send = function() {

  // only send out if we have a callback.
  if(this.cb) {
    var out = {};
    out[this.port] = {
      gid: this.info.gid,
      complete: !!this.info.complete, // loose reference
      items: this.info.items
    };
    this.cb(out);
  }

};

Group.prototype.items = function() {
  return this.info.items;
};

Group.prototype.gid = function() {
  return this.info.gid;
};

module.exports = Group;

},{"events":1,"util":6,"uuid":61}],46:[function(require,module,exports){
'use strict';

var uuid = require('uuid').v4;

/**
 *
 * The PortPointer initializes
 * each source with the same unique
 * itemId.
 *
 * These are then increased per port.
 * So their id's stay in sync.
 *
 * This does give the restriction both
 * ports should give an equal amount of output.
 *
 * Which is err. pretty errorprone :-)
 * Or at least it depends per node, whether it is.
 */
function PortPointer(identifier) {

  // little more unique than just a number.
  this.id = PortPointer.uid(identifier ? identifier + '-' : '');

  // the idea of this counter is increment
  this.counter = 0;

  //this.cols = cols;

  this.store = {};
}

PortPointer.uid = function(prefix) {
  return prefix + uuid().split('-')[0];
};

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 */
PortPointer.prototype.add = function(port) {

  if(!this.store.hasOwnProperty(port)) {
    this.store[port] = [this.counter];
  }

  // not just taking store[port].length, don't want to reset during flush
  var nr = this.store[port][this.store[port].length - 1];
  this.store[port].push(++nr);

  // At some point we actually do not care about the id's anymore.
  // that's when all ports have the same id. fix that later.

  return this.id + '-' + nr;

};

module.exports = PortPointer;

},{"uuid":61}],47:[function(require,module,exports){
'use strict';

////
//
// Ok a syncArray is made per nodeId.
// So this is with that scope.
//
// chi: {
//   <nodeId>: <uuid>
// }
//
// We keep on serving as a gate for the
// synced ports here.
//
function PortSyncer(originId, syncPorts) {

  this.syncPorts = syncPorts;
  this.originId  = originId;

  this.store = {};

}

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 * If we send the data, we can remove it from our store..
 *
 */
//PortSyncer.prototype.add = function(link, data, chi) {
PortSyncer.prototype.add = function(link, p) {

  if(!p.chi.hasOwnProperty(this.originId)) {
    // that's a fail
    throw new Error([
      'Origin Node',
      this.originId,
      'not found within chi'
    ].join(' '));

  }

  if(this.syncPorts.indexOf(link.target.port) === -1) {
    throw new Error([
      'Refuse to handle data for unknown port:',
      link.target.port
      ].join('')
    );
  }

  // <originId>: <itemId>
  // Read back the item id the PortPointer for this node gave us
  var itemId = p.chi[this.originId];

  // if there is no store yet for this item id, create one
  if(!this.store.hasOwnProperty(itemId)) {
    // Create an object for the sync group
    // To contain the data per port.
    this.store[itemId] = {};
  }

  // store this port's data.
  this.store[itemId][link.target.port] = { link: link, p: p };

  // Ok the case of pointing twice with a port
  // using several links is not covered yet..

  // if we have synced all ports, both have added their data
  // then we are ready to send it back.
  // This is done by CHI.sync based on what is returned here.
  // So.. THE reason why we get wrong merged content can only
  // be if some `chi` has stored the wrong item id.
  // And this can only happen, during merging.
  // However merging does this check, so it does not happen
  // during CHI.merge. If it doesn't happen during CHI.merge
  // We have reference somewhere, where there shouldn't be
  // a reference. we re-use a packet.
  // Nice, so where does that take place.
  // and how to prevent it. at least where itemid is set
  // there should be a check whether it's already set.
  if(Object.keys(this.store[itemId]).length === this.syncPorts.length) {

    // return { in1: <data>, in2: <data> }
    // the synced stuff.
    var dat = this.store[itemId];

    // we will never see this itemId again
    delete this.store[itemId];

    return dat;

  } else {

    // not ready yet.
    return undefined;
  }

};

module.exports = PortSyncer;

},{}],48:[function(require,module,exports){
'use strict';

function Store() {
  this.store = {};
  this.order = [];

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.order.length;
    }
  });
}

Store.prototype.set = function(id, obj) {
  this.store[id] = obj;
  this.order.push(id);
};

Store.prototype.get = function(id) {
  return this.store[id];
};

Store.prototype.del = function(id) {
  this.order.splice(this.order.indexOf(id), 1);
  delete this.store[id];
};

Store.prototype.items = function() {
  return this.store;
};

Store.prototype.pop = function() {
  var id  = this.order.pop();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.shift = function() {
  var id  = this.order.shift();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.isEmpty = function() {
  return Object.keys(this.store).length === 0 &&
    this.order.length === 0;
};

module.exports = Store;

},{}],49:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 *
 * Loader
 *
 * This is the base loader class
 * Ít can be used to implement a definition loader
 * for Chix
 *
 * @api public
 * @author Rob Halff <rob.halff@gmail.com>
 * @constructor
 */
function Loader() {

  this.dependencies = {};

  /**
   *
   * Format:
   *
   * Keeps track of all known nodeDefinitions.
   *
   * {
   *  'http://....': { // url in this case is the identifier
   *
   *    fs: {
   *       readFile:  <definition>
   *       writeFile: <definition>
   *    }
   *
   *  }
   *
   * }
   *
   */
  this.nodeDefinitions = {};

}

util.inherits(Loader, EventEmitter);

/**
 *
 * This is the main method all child classes should implement.
 *
 * @param {Object} graphs
 * @param {Function} callback
 * @api public
 */
Loader.prototype.load = function(graphs, callback /*, update dependencies*/) {

  return callback(
    new Error([
      this.constructor.name,
      'must implement a load method'
    ].join(' ')
    )
  );

};

/**
 *
 * Add node definitions
 *
 * Used to `statically` add nodeDefinitions.
 *
 * @param {String} identifier
 * @param {Object} nodeDefs
 * @api public
 */
Loader.prototype.addNodeDefinitions = function(identifier, nodeDefs) {

  var ns;
  var name;
  var i;

  if (Array.isArray(nodeDefs)) {

    for (i = 0; i < nodeDefs.length; i++) {
      this.addNodeDefinition(identifier, nodeDefs[i]);
    }

  } else {

    for (ns in nodeDefs) {
      if (nodeDefs.hasOwnProperty(ns)) {
        for (name in nodeDefs[ns]) {
          if (nodeDefs[ns].hasOwnProperty(name)) {
            this.addNodeDefinition(identifier, nodeDefs[ns][name]);
          }
        }
      }
    }

  }
};

/**
 *
 * Add a node definition
 *
 * @param {String} identifier
 * @param {Object} nodeDef
 * @api public
 */
Loader.prototype.addNodeDefinition = function(identifier, nodeDef) {

  if (!nodeDef.hasOwnProperty('ns')) {
    throw new Error([
      'Nodefinition for',
      identifier,
      'lacks an ns property'
    ].join(' '));
  }

  if (!nodeDef.hasOwnProperty('name')) {
    throw new Error([
      'Nodefinition for',
      identifier,
      'lacks an name property'
    ].join(' '));
  }

  // store the provider url along with the nodeDefinition
  // Needed for fetching back from storage.
  nodeDef.provider = identifier;

  if (nodeDef.type !== 'flow') {

    // Do normal nodeDefinition stuff
    this.dependencies = this._parseDependencies(this.dependencies, nodeDef);

  } else {
    // also setting default provider here?
    // check this later, if addNodeDefinition(s) is used
    // there will otherwise be no default provider.
    // where is default provider, in chix-loader-remote.. err..
    // I think addNodefinition(s) should set it maybe
    // It's also a bit weird, because if you only add them manually
    // there ain't really an url or path.
    if (!nodeDef.providers || Object.keys(nodeDef.providers).length === 0) {
      nodeDef.providers = {
        '@': {
          url: identifier
        }
      };
    }
  }

  if (!this.nodeDefinitions.hasOwnProperty(identifier)) {
    this.nodeDefinitions[identifier] = {};
  }

  if (!this.nodeDefinitions[identifier].hasOwnProperty(nodeDef.ns)) {
    this.nodeDefinitions[identifier][nodeDef.ns] = {};
  }

  if (!this.nodeDefinitions[identifier][nodeDef.ns]
    .hasOwnProperty([nodeDef.name])) {
    this.nodeDefinitions[identifier][nodeDef.ns][nodeDef.name] = nodeDef;
  }

};

Loader.prototype._parseDependencies = function(dependencies, nodeDef) {
  var r;
  var type;

  if (nodeDef.require) {
    throw Error(
      nodeDef.ns + '/' + nodeDef.name +
      ': nodeDef.require is DEPRECATED, use nodeDef.dependencies'
    );
  }

  if (nodeDef.dependencies) {
    for (type in nodeDef.dependencies) {
      if (nodeDef.dependencies.hasOwnProperty(type)) {

        for (r in nodeDef.dependencies[type]) {

          if (nodeDef.dependencies[type].hasOwnProperty(r)) {

            if (type === 'npm') {
              if (nodeDef.dependencies.npm[r] !== 'builtin') {
                // translate to require string, bower should do the same
                //
                // I think this should be delayed, to when the actual
                // require takes place.
                /*
                requireString = r + '@' + nodeDef.dependencies.npm[r];
                if (requires.indexOf(requireString) === -1) {
                  requires.push(requireString);
                }
                */
                if (!dependencies.hasOwnProperty('npm')) {
                  dependencies.npm = {};
                }

                // TODO: check for duplicates and pick the latest one.
                dependencies.npm[r] = nodeDef.dependencies.npm[r];

              }
            } else if (type === 'bower') {

              if (!dependencies.hasOwnProperty('bower')) {
                dependencies.bower = {};
              }

              // TODO: check for duplicates and pick the latest one.
              dependencies.bower[r] = nodeDef.dependencies.bower[r];

            } else {

              throw Error('Unkown package manager:' + type);

            }

          }

        }

      }
    }
  }
  return dependencies;
};

Loader.prototype.saveNodeDefinition = function() {

  throw new Error([
    this.constructor.name,
    'must implement a save method'
  ].join(' '));

};

/**
 *
 * Ok now it becomes intresting.
 *
 * We will read the definition and are going to detect whether this
 * definition is about a flow, if it is about a flow.
 * We are also going to load those definitions, unless we already
 * have that definition ofcourse.
 *
 * This way we only have to provide the actor with ourselves.
 * The loader. The loader will then already know about all the
 * node definitions it needs. This keeps the actor simpler.
 * All it has to do is .getNodeDefinition() wherever in
 * the hierarchy it is.
 *
 */

/**
 *
 * Check whether we have the definition
 *
 * @param {String} providerUrl
 * @param {String} ns
 * @param {String} name
 * @api public
 */
Loader.prototype.hasNodeDefinition = function(providerUrl, ns, name) {
  return this.nodeDefinitions.hasOwnProperty(providerUrl) &&
    this.nodeDefinitions[providerUrl].hasOwnProperty(ns) &&
    this.nodeDefinitions[providerUrl][ns].hasOwnProperty(name);

};

/**
 *
 * Easier method to just get an already loaded definition
 * TODO: Unrafel getNodeDefinition and make it simpler
 *
 * Anyway, this is the way, we do not want to keep a store of id's
 * in the loader also, so getById can go also.
 */
Loader.prototype.getNodeDefinitionFrom = function(provider, ns, name) {

  if (this.hasNodeDefinition(provider, ns, name)) {
    return this.nodeDefinitions[provider][ns][name];
  }

};

/**
 *
 * Loads the NodeDefinition for a node.
 *
 * In order to do so each node must know the provider url
 * it was loaded from.
 *
 * This is normally not stored directly into flows,
 * but the flow is saved with the namespaces in used.
 *
 * TODO: this really should just be (provider, name, ns, version)
 * Else use the load method.
 *
 * ah this is the exact same as loadDefnition only without callback.
 *
 */
Loader.prototype.getNodeDefinition = function(node, map) {

  var def = this.loadNodeDefinition(node, map);

  // merge the schema of the internal node.
  if (node.type === 'flow') {
    this._mergeSchema(def); // in place
  }

  return def;

};

// this is still the map so nodes are an array
// saves us from having to maintain a nodes list.
// making this mergeSchema more self-reliant
Loader.prototype.findNodeWithinGraph = function(nodeId, graph) {

  for (var i = 0; i < graph.nodes.length; i++) {
    if (nodeId === graph.nodes[i].id) {
      // ok that's the node, but still it needs to be resolved
      // we need to get it's definition
      return graph.nodes[i];
    }
  }

  throw Error('Could not find internal node within graph');

};

Loader.prototype._mergeSchema = function(graph) {
  for (var type in graph.ports) {
    if (graph.ports.hasOwnProperty(type)) {
      for (var port in graph.ports[type]) {
        if (graph.ports[type].hasOwnProperty(port)) {
          var externalPort = graph.ports[type][port];
          if (externalPort.hasOwnProperty('nodeId')) {
            var internalDef = this.getNodeDefinition(
              this.findNodeWithinGraph(externalPort.nodeId, graph),
              graph
            );
            var copy    = JSON.parse(
              JSON.stringify(internalDef.ports[type][externalPort.name])
            );
            copy.title  = externalPort.title;
            copy.name   = externalPort.name;
            copy.nodeId = externalPort.nodeId;
            graph.ports[type][port] = copy;
          } else {
            // not pointing to an internal node. :start etc.
          }
        }
      }
    }
  }
};

/***
 *
 * Recursivly returns the requires.
 *
 * Assumes the map, node is already loaded.
 *
 * Note: Will break if node.provider is an url already.
 *
 * @private
 */
Loader.prototype._collectDependencies = function(dependencies, def) {

  var self = this;
  def.nodes.forEach(function(node) {
    var provider;

    // Just makes this a simple function, used in several locations.
    if (/:\/\//.test(node.provider)) {
      provider = node.provider;
    } else {
      var da = node.provider ? node.provider : '@';
      provider = def.providers[da].url || def.providers[da].path;
    }

    var nDef = self.nodeDefinitions[provider][node.ns][node.name];
    if (node.type === 'flow') {
      dependencies = self._collectDependencies(dependencies, nDef);
    } else {
      dependencies = self._parseDependencies(dependencies, nDef);
    }
  });

  return dependencies;

};

/**
 *
 * Get the dependencies for a certain provider.
 *
 * @param {Object} def
 * @private
 */
Loader.prototype._loadDependencies = function(def) {

  var dependencies = {};

  if (def.type === 'flow') {
    dependencies = this._collectDependencies(dependencies, def);
    return dependencies;
  } else {
    dependencies = this._parseDependencies(dependencies, def);
    return dependencies;
  }

};

// Loader itself only expects preloaded nodes.
// There is no actual load going on.
// Remote loader does implement loading.
Loader.prototype.loadNode = function(providerDef, cb) {

  var provider = providerDef.providerLocation;
  var ns       = providerDef.ns;
  var name     = providerDef.name;
  if (this.nodeDefinitions[provider] &&
    this.nodeDefinitions[provider].hasOwnProperty(ns) &&
    this.nodeDefinitions[provider][ns].hasOwnProperty(name)) {

    cb(null, {
      nodeDef: this.nodeDefinitions[provider][ns][name]
    });

  } else {

    cb(
      Error(
        util.format('Could not load node %s/%s from %s', ns, name, provider)
      )
    );

  }

};

Loader.prototype.loadNodeDefinitionFrom =
  function(provider, ns, name, callback) {

    var self = this;

    // I want cumulative dependencies.
    // Instead of only knowing all dependencies known
    // or only the dependency from the current node.
    // self.load could send this within the callback
    // and then also remember the dependency from this single node.
    // for self.load it's the second argument of the callback.
    var dependencies = {};

    this.loadNode({
    ns: ns,
    name: name,
    url: provider.replace('{ns}', ns).replace('{name}', name),
    providerLocation: provider
  }, function(err, res) {

    if (err) {
      throw err;
    }

    var nodeDef = res.nodeDef;
    // res.providerLocation

    dependencies = self._parseDependencies(dependencies, nodeDef);

    // quick hacking
    if (!self.nodeDefinitions[provider]) {
      self.nodeDefinitions[provider] = {};
    }
    if (!self.nodeDefinitions[provider].hasOwnProperty(ns)) {
      self.nodeDefinitions[provider][ns] = {};
    }
    self.nodeDefinitions[provider][ns][name] = nodeDef;

    if (nodeDef.type === 'flow') {

      self.load(nodeDef, function(/*err, ret*/) {
        callback(
          self.nodeDefinitions[provider][ns][name],
          self._loadDependencies(
            self.nodeDefinitions[provider][ns][name]
          )
        );
      }, false, dependencies);

    } else {
      callback(
        self.nodeDefinitions[provider][ns][name],
        self._loadDependencies(
          self.nodeDefinitions[provider][ns][name]
        )
      );
    }

  });

  };

// Ok this, seems weird, it is loading the map?
// I give it a node which has either a provider as short key
// or the full url, the map is needed to resolve that.
// but then I start loading the full map.
// which seems weird, to say the least.
Loader.prototype.loadNodeDefinition = function(node, map, callback) {

  var location;
  var provider;
  var self = this;

  if (node.provider && node.provider.indexOf('://') >= 0) {
    // it's already an url
    location = node.provider;

  } else if (!node.provider && (!map || !map.providers)) {
    // for direct additions (only @ is possible)
    location = '@';

  } else {

    if (!map) {

      throw Error(
        'loadNodeDefinition needs a map or a node with a full provider url'
      );

    }

    if (node.provider) {
      // 'x': ..
      provider = map.providers[node.provider];
    } else {
      provider = map.providers['@'];
    }

    // fix: find provider by path or url, has to do with provider
    // already resolved (sub.sub.graphs)
    if (!provider) {
      for (var key in map.providers) {
        if (map.providers[key].url === node.provider ||
          map.providers[key].path === node.provider) {
          provider = map.providers[key];
        }
      }
      if (!provider) {
        throw Error('unable to find provider');
      }
    }

    if (provider.hasOwnProperty('path')) {

      location = provider.path;

    } else if (provider.hasOwnProperty('url')) {

      location = provider.url;

    } else {
      throw new Error('Do not know how to handle provider');
    }

    // Remember the provider, this is important to call getDefinition
    // at a later stage, see actor.addMap and createNode.
    // createNode is called without a map.
    // not perfect this, so redo this later.
    // when empty maps are added, createNode should also be
    // able to figure out where it's definitions are.
    // this means the map should be preloaded.
    // This preload should be done with an URL not with @
    // The along with that getNodeDefinitionFrom(providerUrl)
    // should be used. providerUrl is the only way subgraphs
    // are indexed correctly '@' by itself is not unique enough
    // to serve as a provider key. it is for single graphs but
    // is not useable anything beyond that.
    // Also however when a graph is saved the expanded
    // urls should be translated back into short form (fix that)
    // by looking up the provider within providers and putting
    // the key back where now the expanded url is.
    node.provider = location;

  }

  if (!this.nodeDefinitions.hasOwnProperty(location) ||
    !this.nodeDefinitions[location].hasOwnProperty(node.ns) ||
    !this.nodeDefinitions[location][node.ns].hasOwnProperty(node.name)) {

    if (!callback) {
      return false;
    } else {
      // not sure.. node has a full url.
      // but it's not loaded, then we ask to load the full map.
      // which works if provider is x but not if it's already expanded.
      //
      this.load(map, function() {
        callback(self.nodeDefinitions[location][node.ns][node.name]);
      });
    }

  } else {

    if (callback) {
      callback(this.nodeDefinitions[location][node.ns][node.name]);
    } else {
      return this.nodeDefinitions[location][node.ns][node.name];
    }

  }

};

/**
 *
 * Get dependencies for the type given.
 *
 * type is either `npm` or `bower`
 *
 * If no type is given will return all dependencies.
 *
 * Note: this method changed in behavior, used to be
 *  what _loadDependencies is now. which used to be getRequires()...
 *
 * @param {string} type
 * @public
 */
Loader.prototype.getDependencies = function(type) {
  if (type) {
    if (this.dependencies.hasOwnProperty(type)) {
      return this.dependencies[type];
    } else {
      return {};
    }
  } else {
    return this.dependencies;
  }
};

/**
 *
 * Checks whether there are any dependencies.
 *
 * Type can be `npm` or `bower`
 *
 * If no type is given it will tell whether there are *any* dependencies
 *
 * @param {string} type
 * @public
 **/
Loader.prototype.hasDependencies = function(type) {

  if (type) {
    if (this.dependencies.hasOwnProperty(type)) {
      return Object.keys(this.dependencies[type]).length;
    }
  } else {
    for (type in this.dependencies) {
      if (this.dependencies.hasOwnProperty(type)) {
        if (this.hasDependencies(type)) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 *
 * Get Nodedefinitions
 *
 * Optionally with a provider url so it returns only the node definitions
 * at that provider.
 *
 * @param {String} provider (Optional)
 */
Loader.prototype.getNodeDefinitions = function(provider) {

  if (provider) {
    return this.nodeDefinitions[provider];
  } else {
    return this.nodeDefinitions;
  }

};

module.exports = Loader;

},{"events":1,"util":6}],50:[function(require,module,exports){
module.exports = function InstanceOf(obj, type) {
  if(obj === null) return false;
  if(type === 'array') type = 'Array';
  var t = typeof obj;
  if(t === 'object') {
    if(type.toLowerCase() === t) return true; // Object === object
    if(obj.constructor.name === type) return true;
    if(obj.constructor.toString().match(/function (\w*)/)[1] === type) return true;
    return InstanceOf(Object.getPrototypeOf(obj), type);
  } else {
    return t === type;
  }
};

},{}],51:[function(require,module,exports){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * IO Box
 *
 * @param {String} name
 */
var IOBox = function (name, args, returns) {

  if (!(this instanceof IOBox)) {
    return new IOBox(name, args, returns);
  }

  EventEmitter.apply(this, arguments);

  this.name = name || 'UNNAMED';

  // to ensure correct order
  this._keys = [];

  args = args || [];
  returns = returns || [];

  this.setup(args, returns);

};

util.inherits(IOBox, EventEmitter);

/**
 *
 * Setup
 *
 * @param {Array} args
 * @param {Array} returns
 */
IOBox.prototype.setup = function (args, returns) {

  var i;

  this.args = {};
  this.returns = [];
  this.fn = undefined;

  // setup the empty input arguments object
  for (i = 0; i < args.length; i++) {
    this.addArg(args[i], undefined);
  }

  for (i = 0; i < returns.length; i++) {
    this.addReturn(returns[i]);
  }
};

/**
 *
 * Used to access the properties at the top level,
 * but still be able to get all relevant arguments
 * at once using this.args
 *
 * @param {String} key
 * @param {Mixed} initial
 */
IOBox.prototype.addArg = function (key, initial) {

  Object.defineProperty(this, key, {
    set: function (val) {
      this.args[key] = val;
    },
    get: function () {
      return this.args[key];
    }
  });

  this._keys.push(key);

  this[key] = initial; // can be undefined

};

IOBox.prototype.addReturn = function (r) {
  if (this.returns.indexOf(r) === -1) {
    if (this._keys.indexOf(r) !== -1) {
      this.returns.push(r);
    }
    else {
      throw Error([
        'Output `',
        r,
        '` is not one of',
        this._keys.join(', ')
      ].join(' '));
    }
  }
};

/**
 *
 * Sets a property of the sandbox.
 * Because the keys determine what arguments will
 * be generated for the function, it is important
 * we keep some kind of control over what is set.
 *
 * @param {String} key
 * @param {Mixed} value
 *
 */
IOBox.prototype.set = function (key, value) {

  if (this.args.hasOwnProperty(key)) {
    this.args[key] = value;
  }
  else {
    throw new Error([
      'Will not set unknown property',
      key
    ].join(' '));
  }
};

/**
 *
 * Compiles and returns the generated function.
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.compile = function (fn, asObject) {

  if (!this.code) {
    this.generate(fn ? fn.trim() : fn, asObject);
  }

  this.fn = new Function(this.code)();

  return this.fn;

};

/**
 *
 * Fill with a precompiled function
 *
 * Return type in this case is determined by compiled function
 *
 * @param {String} fn
 * @return {String}
 */
IOBox.prototype.fill = function (fn) {

  // argument signature check?

  this.fn = fn;

  return this.fn;

};

/**
 *
 * Wraps the function in yet another function
 *
 * This way it's possible to get the original return.
 *
 * @param {String} fn
 * @return {String}
 */
IOBox.prototype._returnWrap = function (fn) {
  return ['function() {', fn, '}.call(this)'].join('\n');
};
/**
 *
 * Clear generated code
 */
IOBox.prototype.clear = function () {
  this.code = null;
};

/**
 *
 * Generates the function.
 *
 * This can be used directly
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.generate = function (fn, asObject) {

  this.code = [
    'return function ',
    this.name,
    '(',
    this._keys.join(','),
    ') {\n',
    'var r = ', // r goes to 'return'
    this._returnWrap(fn),
    '; return ',
    asObject ? this._asObject() : this._asArray(),
    '; }'
  ].join('');

  return this.code;
};

/**
 *
 * Return output as array.
 *
 * @return {String}
 */
IOBox.prototype._asArray = function () {
  return '[' + this.returns.join(',') + ',r]';
};

/**
 *
 * Return output as object.
 *
 * @return {String}
 */
IOBox.prototype._asObject = function () {
  var ret = [];
  for (var i = 0; i < this.returns.length; i++) {
    ret.push(this.returns[i] + ':' + this.returns[i]);
  }
  ret.push('return:' + 'r');

  return '{' + ret.join(',') + '}';
};

/**
 *
 * Renders the function to string.
 *
 * @return {String}
 */
IOBox.prototype.toString = function () {
  if (this.fn) return this.fn.toString();
  return this.fn;
};

/**
 *
 * Runs the generated function
 *
 * @param {Mixed} bind   Context to bind to the function
 * @return {Mixed}
 */
IOBox.prototype.run = function (bind) {

  var v = [];
  var k;

  for (k in this.args) {
    if (this.args.hasOwnProperty(k)) {
      v[this._keys.indexOf(k)] = this.args[k];
    }
    else {
      throw new Error('unknown input ' + k);
    }
  }

  // returns the output, format depends on the `compile` step
  return this.fn.apply(bind, v);

};

module.exports = IOBox;

},{"events":1,"util":6}],52:[function(require,module,exports){
/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

var isObject = require('isobject');

function isObjectObject(o) {
  return isObject(o) === true
    && Object.prototype.toString.call(o) === '[object Object]';
}

module.exports = function isPlainObject(o) {
  var ctor,prot;
  
  if (isObjectObject(o) === false) return false;
  
  // If has modified constructor
  ctor = o.constructor;
  if (typeof ctor !== 'function') return false;
  
  // If has modified prototype
  prot = ctor.prototype;
  if (isObjectObject(prot) === false) return false;
  
  // If constructor does not have an Object-specific method
  if (prot.hasOwnProperty('isPrototypeOf') === false) {
    return false;
  }
  
  // Most likely a plain Object
  return true;
};

},{"isobject":53}],53:[function(require,module,exports){
/*!
 * isobject <https://github.com/jonschlinkert/isobject>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

module.exports = function isObject(val) {
  return val != null && typeof val === 'object'
    && !Array.isArray(val);
};

},{}],54:[function(require,module,exports){
exports.getType = function (obj) {
	switch (Object.prototype.toString.call(obj)) {
		case '[object String]':
			return 'string';
		case '[object Number]':
			return (obj % 1 === 0) ? 'integer' : 'number';
		case '[object Boolean]':
			return 'boolean';
		case '[object Object]':
			return 'object';
		case '[object Array]':
			return 'array';
		case '[object Null]':
			return 'null';
		default:
			return 'undefined';
	}
}

exports.prettyType = function(type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
			return 'a ' + type;
		case 'integer':
		case 'object':
		case 'array':
			return 'an ' + type;
		case 'null':
			return 'null';
		case 'any':
			return 'any type';
		case 'undefined':
			return 'undefined';
		default:
			if (typeof type === 'object') {
				return 'a schema'
			} else {
				return type;
			}
	}
}


exports.isOfType = function (obj, type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
		case 'object':
		case 'array':
		case 'null':
			type = type.charAt(0).toUpperCase() + type.slice(1);
			return Object.prototype.toString.call(obj) === '[object ' + type + ']';
		case 'integer':
			return Object.prototype.toString.call(obj) === '[object Number]' && obj % 1 === 0;
		case 'any':
		default:
			return true;
	}
}

exports.getName = function (names) {
	return names.length === 0 ? '' : ' property \'' + names.join('.') + '\'';
};

exports.deepEquals = function (obj1, obj2) {
	var p;

	if (Object.prototype.toString.call(obj1) !== Object.prototype.toString.call(obj2)) {
		return false;
	}

	switch (typeof obj1) {
		case 'object':
			if (obj1.toString() !== obj2.toString()) {
				return false;
			}
			for (p in obj1) {
				if (!(p in obj2)) {
					return false;
				}
				if (!exports.deepEquals(obj1[p], obj2[p])) {
					return false;
				}
			}
			for (p in obj2) {
				if (!(p in obj1)) {
					return false;
				}
			}
			return true;
		case 'function':
			return obj1[p].toString() === obj2[p].toString();
		default:
			return obj1 === obj2;
	}
};

},{}],55:[function(require,module,exports){
var RE_0_TO_100 = '([1-9]?[0-9]|100)';
var RE_0_TO_255 = '([1-9]?[0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])';

function validateFormatUtcMillisec(obj) {
	return obj >= 0;
}

function validateFormatRegExp(obj) {
	try {
		var re = RegExp(obj);
		return true;
	} catch(err) {
		return false;
	}
}

var COLORS = ['aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon', 'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow'];
var colorsReHex3 = /^#[0-9A-Fa-f]{3}$/; // #rgb
var colorsReHex6 = /^#[0-9A-Fa-f]{6}$/; // #rrggbb
var colorsReRgbNum = RegExp('^rgb\\(\\s*' + RE_0_TO_255 + '(\\s*,\\s*' + RE_0_TO_255 + '\\s*){2}\\)$'); // rgb(255, 0, 128)
var colorsReRgbPerc = RegExp('^rgb\\(\\s*' + RE_0_TO_100 + '%(\\s*,\\s*' + RE_0_TO_100 + '%\\s*){2}\\)$'); // rgb(100%, 0%, 50%)

function validateFormatColor(obj) {
	return COLORS.indexOf(obj) !== -1 || obj.match(colorsReHex3) || obj.match(colorsReHex6)
		|| obj.match(colorsReRgbNum) || obj.match(colorsReRgbPerc);
}

var phoneReNational = /^(\(\d+\)|\d+)( \d+)*$/;
var phoneReInternational = /^\+\d+( \d+)*$/;

function validateFormatPhone(obj) {
	return obj.match(phoneReNational) || obj.match(phoneReInternational);
}

var formats = {
	'date-time': { // ISO 8601 (YYYY-MM-DDThh:mm:ssZ in UTC time)
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}T[0-2]\d:[0-5]\d:[0-5]\d([.,]\d+)?Z$/
	},
	'date': { // YYYY-MM-DD
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}$/
	},
	'time': { // hh:mm:ss
		types: ['string'],
		regex: /^[0-2]\d:[0-5]\d:[0-5]\d$/
	},
	'utc-millisec': {
		types: ['number', 'integer'],
		func: validateFormatUtcMillisec
	},
	'regex': { // ECMA 262/Perl 5
		types: ['string'],
		func: validateFormatRegExp
	},
	'color': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatColor
	},
	/* TODO: support style
		* style - A string containing a CSS style definition, based on CSS 2.1 [W3C.CR-CSS21-20070719].
		Example: `'color: red; background-color:#FFF'`.

	'style': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatStyle
	},*/
   	'phone': { // E.123
		types: ['string'],
		func: validateFormatPhone
	},
	'uri': {
		types: ['string'],
		regex: RegExp("^([a-z][a-z0-9+.-]*):(?://(?:((?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)(?::(\\d*))?(/(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?|(/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})+(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?)(?:\\?((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?(?:#((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?$", 'i')
	},
	'email': {
		types: ['string'],
		regex: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
	},
	'ip-address': {
		types: ['string'],
		regex: RegExp('^' + RE_0_TO_255 + '(\\.' + RE_0_TO_255 + '){3}$')
	},
	'ipv6': {
		types: ['string'],
		regex: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i
	},
	'host-name': {
		types: ['string'],
		regex: /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/
	}
};

exports.formats = formats;

},{}],56:[function(require,module,exports){
var validateSchema = require('./valid-schema'),
	validateObject = require('./valid-object');

var Schema = function(schema) {
	this.schema = schema;
	validateSchema(schema);

	this.validate = function(obj, done) {
		validateObject(obj, schema, done);
	}
}

module.exports.createSchema = function (schema) {
	return new Schema(schema);
}

},{"./valid-object":57,"./valid-schema":58}],57:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	deepEquals = common.deepEquals;

function throwInvalidValue(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidAttributeValue(names, attribFullName, value, expected) {
	throw new Error('JSON object' + getName(names) + ': ' + attribFullName + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidType(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function throwInvalidDisallow(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should not be ' + expected);
}

function validateRequired(obj, schema, names) {
	//console.log('***', names, 'validateRequired');
	if (schema.required) {
		if (obj === undefined) {
			throw new Error('JSON object' + getName(names) + ' is required');
		}
	}
}

function applyDefault(obj, schema, names) {
	//console.log('***', names, 'applyDefault');
	if (schema.default !== undefined) {
		obj = schema.default;
	}

	return obj;
}

function validateType(obj, schema, names) {
	//console.log('***', names, 'validateType');
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type
				if (!isOfType(obj, schema.type)) {
					throwInvalidType(names, obj, prettyType(schema.type));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.type[i])) {
								return; // success
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								return validateSchema(obj, schema.type[i], names);
							} catch(err) {
								// validation failed
								// TOOD: consider propagating error message upwards
							}
							break;
					}
				}
				throwInvalidType(names, obj, 'either ' + schema.type.map(prettyType).join(' or '));
				break;
		}
	}
}

function validateDisallow(obj, schema, names) {
	//console.log('***', names, 'validateDisallow');
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type
				if (isOfType(obj, schema.disallow)) {
					throwInvalidDisallow(names, obj, prettyType(schema.disallow));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.disallow[i])) {
								throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(obj, schema.disallow[i], names);
							} catch(err) {
								// validation failed
								continue;
							}
							throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							// TOOD: consider propagating error message upwards
							break;
					}
				}
				break;
		}
	}
}

function validateEnum(obj, schema, names) {
	//console.log('***', names, 'validateEnum');
	if (schema['enum'] !== undefined) {
		for (var i = 0; i < schema['enum'].length; ++i) {
			if (deepEquals(obj, schema['enum'][i])) {
				return;
			}
		}
		throw new Error('JSON object' + getName(names) + ' is not in enum');
	}
}

function validateArray(obj, schema, names) {
	//console.log('***', names, 'validateArray');
	var i, j;

	if (schema.minItems !== undefined) {
		if (obj.length < schema.minItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at least ' + schema.minItems);
		}
	}

	if (schema.maxItems !== undefined) {
		if (obj.length > schema.maxItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.maxItems);
		}
	}

	if (schema.items !== undefined) {
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				for (i = 0; i < obj.length; ++i) {
					obj[i] = validateSchema(obj[i], schema.items, names.concat([ '['+i+']' ]));
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				var numChecks = Math.min(obj.length, schema.items.length);
				for (i = 0; i < numChecks; ++i) {
					obj[i] = validateSchema(obj[i], schema.items[i], names.concat([ '['+i+']' ]));
				}
				if (obj.length > schema.items.length) {
					if (schema.additionalItems !== undefined) {
						if (schema.additionalItems === false) {
							throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.items.length + ' - the length of schema items');
						}
						for (; i < obj.length; ++i) {
							obj[i] = validateSchema(obj[i], schema.additionalItems, names.concat([ '['+i+']' ]));
						}
					}
				}
				break;
		}
	}

	if (schema.uniqueItems !== undefined) {
		for (i = 0; i < obj.length - 1; ++i) {
			for (j = i + 1; j < obj.length; ++j) {
				if (deepEquals(obj[i], obj[j])) {
					throw new Error('JSON object' + getName(names) + ' items are not unique: element ' + i + ' equals element ' + j);
				}
			}
		}
	}
}

function validateObject(obj, schema, names) {
	//console.log('***', names, 'validateObject');
	var prop, property;
	if (schema.properties !== undefined) {
		for (property in schema.properties) {
			prop = validateSchema(obj[property], schema.properties[property], names.concat([property]));
			if (prop === undefined) {
				delete obj[property];
			} else {
				obj[property] = prop;
			}
		}
	}

	var matchingProperties = {};
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			var re = RegExp(reStr);
			for (property in obj) {
				if (property.match(re)) {
					matchingProperties[property] = true;
					prop = validateSchema(obj[property], schema.patternProperties[reStr], names.concat(['patternProperties./' + property + '/']));
					if (prop === undefined) {
						delete obj[property];
					} else {
						obj[property] = prop;
					}
				}
			}
		}
	}

	if (schema.additionalProperties !== undefined) {
		for (property in obj) {
			if (schema.properties !== undefined && property in schema.properties) {
				continue;
			}
			if (property in matchingProperties) {
				continue;
			}
			// additional
			if (schema.additionalProperties === false) {
				throw new Error('JSON object' + getName(names.concat([property])) + ' is not explicitly defined and therefore not allowed');
			}
			obj[property] = validateSchema(obj[property], schema.additionalProperties, names.concat([property]));
		}
	}

	if (schema.dependencies !== undefined) {
		for (property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency
					if (property in obj && !(schema.dependencies[property] in obj)) {
						throw new Error('JSON object' + getName(names.concat([schema.dependencies[property]])) + ' is required by property \'' + property + '\'');
					}
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (property in obj && !(schema.dependencies[property][i] in obj)) {
							throw new Error('JSON object' + getName(names.concat([schema.dependencies[property][i]])) + ' is required by property \'' + property + '\'');
						}
					}
					break;
				case 'object':
					// schema dependency
					validateSchema(obj, schema.dependencies[property], names.concat([ '[dependencies.'+property+']' ]));
					break;
			}
		}
	}
}

function validateNumber(obj, schema, names) {
	//console.log('***', names, 'validateNumber');

	if (schema.minimum !== undefined) {
		if (schema.exclusiveMinimum ? obj <= schema.minimum : obj < schema.minimum) {
			throwInvalidValue(names, obj, (schema.exclusiveMinimum ? 'greater than' : 'at least') + ' ' + schema.minimum);
		}
	}

	if (schema.maximum !== undefined) {
		if (schema.exclusiveMaximum ? obj >= schema.maximum : obj > schema.maximum) {
			throwInvalidValue(names, obj, (schema.exclusiveMaximum ? 'less than' : 'at most') + ' ' + schema.maximum);
		}
	}

	if (schema.divisibleBy !== undefined) {
		if (!isOfType(obj / schema.divisibleBy, 'integer')) {
			throwInvalidValue(names, obj, 'divisible by ' + schema.divisibleBy);
		}
	}
}

function validateString(obj, schema, names) {
	//console.log('***', names, 'validateString');

	if (schema.minLength !== undefined) {
		if (obj.length < schema.minLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at least ' + schema.minLength);
		}
	}

	if (schema.maxLength !== undefined) {
		if (obj.length > schema.maxLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at most ' + schema.maxLength);
		}
	}

	if (schema.pattern !== undefined) {
		if (!obj.match(RegExp(schema.pattern))) {
			throw new Error('JSON object' + getName(names) + ' does not match pattern');
		}
	}
}

function validateFormat(obj, schema, names) {
	//console.log('***', names, 'validateFormat');
	if (schema.format !== undefined) {
		var format = formats[schema.format];
		if (format !== undefined) {
			var conforms = true;
			if (format.regex) {
				conforms = obj.match(format.regex);
			} else if (format.func) {
				conforms = format.func(obj);
			}
			if (!conforms) {
				throw new Error('JSON object' + getName(names) + ' does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(obj, schema, names) {
	//console.log('***', names, 'validateItem');
	switch (getType(obj)) {
		case 'number':
		case 'integer':
			validateNumber(obj, schema, names);
			break;
		case 'string':
			validateString(obj, schema, names);
			break;
	}

	validateFormat(obj, schema, names);
}

function validateSchema(obj, schema, names) {
	//console.log('***', names, 'validateSchema');

	validateRequired(obj, schema, names);
	if (obj === undefined) {
		obj = applyDefault(obj, schema, names);
	}
	if (obj !== undefined) {
		validateType(obj, schema, names);
		validateDisallow(obj, schema, names);
		validateEnum(obj, schema, names);

		switch (getType(obj)) {
			case 'object':
				validateObject(obj, schema, names);
				break;
			case 'array':
				validateArray(obj, schema, names);
				break;
			default:
				validateItem(obj, schema, names);
		}
	}

	return obj;
}

// Two operation modes:
// * Synchronous - done callback is not provided. will return nothing or throw error
// * Asynchronous - done callback is provided. will not throw error.
//        will call callback with error as first parameter and object as second
// Schema is expected to be validated.
module.exports = function(obj, schema, done) {
	try {
		validateSchema(obj, schema, []);
	} catch(err) {
		if (done) {
			done(err);
			return;
		} else {
			throw err;
		}
	} 

	if (done) {
		done(null, obj);
	}
};

},{"./common":54,"./formats":55}],58:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	validateObjectVsSchema = require('./valid-object');

function throwInvalidType(names, attribFullName, value, expected) {
	throw new Error('Schema' + getName(names) + ': ' + attribFullName + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function assertType(schema, attribName, expectedType, names) {
	if (schema[attribName] !== undefined) {
		if (!isOfType(schema[attribName], expectedType)) {
			throwInvalidType(names, '\'' + attribName + '\' attribute', schema[attribName], prettyType(expectedType));
		}
	}
}

function validateRequired(schema, names) {
	assertType(schema, 'required', 'boolean', names);
}

function validateDefault(schema, names) {
	if (schema.default !== undefined) {
		try {
			validateObjectVsSchema(schema.default, schema);
		} catch(err) {
			throw new Error('Schema' + getName(names) + ': \'default\' attribute value is not valid according to the schema: ' + err.message);
		}
	}
}

function validateType(schema, names) {
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.type.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'type\' attribute union length is ' + schema.type.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.type[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'type\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'type\' attribute union element ' + i, schema.type[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'type\' attribute', schema.type, 'either a string or an array');
		}
	}
}

function validateDisallow(schema, names) {
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.disallow.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union length is ' + schema.disallow.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.disallow[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'disallow\' attribute union element ' + i, schema.disallow[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'disallow\' attribute', schema.disallow, 'either a string or an array');
		}
	}
}

function validateEnum(schema, names) {
	assertType(schema, 'enum', 'array', names);
}

function validateArray(schema, names) {
	assertType(schema, 'minItems', 'integer', names);
	assertType(schema, 'maxItems', 'integer', names);

	if (schema.items !== undefined) {
		var i;
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				try {
					validateSchema(schema.items, []);
				} catch(err) {
					throw new Error('Schema' + getName(names) + ': \'items\' attribute is not a valid schema: ' + err.message);
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				for (i = 0; i < schema.items.length; ++i) {
					try {
						validateSchema(schema.items[i], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'items\' attribute element ' + i + ' is not a valid schema: ' + err.message);
					}
				}
				break;
			default:
				throwInvalidType(names, '\'items\' attribute', schema.items, 'either an object (schema) or an array');
		}
	}

	if (schema.additionalItems !== undefined) {
		if (schema.additionalItems === false) {
			// ok
		} else if (!isOfType(schema.additionalItems, 'object')) {
			throwInvalidType(names, '\'additionalItems\' attribute', schema.additionalItems, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalItems, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalItems\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'uniqueItems', 'boolean', names);
}

function validateObject(schema, names) {
	assertType(schema, 'properties', 'object', names);
	if (schema.properties !== undefined) {
		for (var property in schema.properties) {
			validateSchema(schema.properties[property], names.concat([property]));
		}
	}

	assertType(schema, 'patternProperties', 'object', names);
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			validateSchema(schema.patternProperties[reStr], names.concat(['patternProperties./' + reStr + '/']));
		}
	}

	if (schema.additionalProperties !== undefined) {
		if (schema.additionalProperties === false) {
			// ok
		} else if (!isOfType(schema.additionalProperties, 'object')) {
			throwInvalidType(names, '\'additionalProperties\' attribute', schema.additionalProperties, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalProperties, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalProperties\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'dependencies', 'object', names);
	if (schema.dependencies !== undefined) {
		for (var property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency - nothing to validate
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (isOfType(schema.dependencies[property][i], 'string')) {
							// simple dependency (inside array) - nothing to validate
						} else {
							throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\' element ' + i, schema.dependencies[property][i], 'a string');
						}
					}
					break;
				case 'object':
					// schema dependency
					try {
						validateSchema(schema.dependencies[property], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'dependencies\' attribute: value of property \'' + property + '\' is not a valid schema: ' + err.message);
					}
					break;
				default:
					throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\'', schema.dependencies[property], 'either a string, an array or an object (schema)');
			}
		}
	}
}

function validateNumber(schema, names) {
	assertType(schema, 'minimum', 'number', names);
	assertType(schema, 'exclusiveMinimum', 'boolean', names);
	assertType(schema, 'maximum', 'number', names);
	assertType(schema, 'exclusiveMaximum', 'boolean', names);
	assertType(schema, 'divisibleBy', 'number', names);
	if (schema.divisibleBy !== undefined) {
		if (schema.divisibleBy === 0) {
			throw new Error('Schema' + getName(names) + ': \'divisibleBy\' attribute must not be 0');
		}
	}
};

function validateString(schema, names) {
	assertType(schema, 'minLength', 'integer', names);
	assertType(schema, 'maxLength', 'integer', names);
	assertType(schema, 'pattern', 'string', names);
}

function validateFormat(schema, names) {
	assertType(schema, 'format', 'string', names);

	if (schema.format !== undefined) {
		if (schema.format in formats) {
			if (formats[schema.format].types.indexOf(schema.type) === -1) {
				throw new Error('Schema' + getName(names) + ': \'type\' attribute does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(schema, names) {
	validateNumber(schema, names);
	validateString(schema, names);
	validateFormat(schema, names);
}

function validateSchema(schema, names) {
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema' + getName(names) + ' is ' + prettyType(getType(schema)) + ' when it should be an object');
	}
	validateRequired(schema, names);
	validateType(schema, names);
	validateDisallow(schema, names);
	validateEnum(schema, names);
	validateObject(schema, names);
	validateArray(schema, names);
	validateItem(schema, names);
	// defaults are applied last after schema is validated
	validateDefault(schema, names);
}

module.exports = function(schema) {
	if (schema === undefined) {
		throw new Error('Schema is undefined');
	}

	// validate schema parameters for object root
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema is ' + prettyType(getType(schema)) + ' when it should be an object');
	}

	validateSchema(schema, []);
};

},{"./common":54,"./formats":55,"./valid-object":57}],59:[function(require,module,exports){
(function (global){
/* jshint laxbreak: true, laxcomma: true*/
/* global global, window */

(function (undefined) {
	"use strict";

	var $scope
	, conflict, conflictResolution = [];
	if (typeof global === 'object' && global) {
		$scope = global;
		conflict = global.JsonPointer;
	} else if (typeof window !== 'undefined') {
		$scope = window;
		conflict = window.JsonPointer;
	} else {
		$scope = {};
	}
	if (conflict) {
		conflictResolution.push(
			function () {
				if ($scope.JsonPointer === JsonPointer) {
					$scope.JsonPointer = conflict;
					conflict = undefined;
				}
			});
	}

	function decodePointer(ptr) {
		if (typeof ptr !== 'string') { throw new TypeError('Invalid type: JSON Pointers are represented as strings.'); }
		if (ptr.length === 0) { return []; }
		if (ptr[0] !== '/') { throw new ReferenceError('Invalid JSON Pointer syntax. Non-empty pointer must begin with a solidus `/`.'); }
		var path = ptr.substring(1).split('/')
		, i = -1
		, len = path.length
		;
		while (++i < len) {
			path[i] = path[i].replace('~1', '/').replace('~0', '~');
		}
		return path;
	}

	function encodePointer(path) {
		if (path && !Array.isArray(path)) { throw new TypeError('Invalid type: path must be an array of segments.'); }
		if (path.length === 0) { return ''; }
		var res = []
		, i = -1
		, len = path.length
		;
		while (++i < len) {
			if (typeof path[i] === 'string') {
				res.push(path[i].replace('~', '~0').replace('/', '~1'));
			} else {
				res.push(path[i]);
			}
		}
		return "/".concat(res.join('/'));
	}

	function decodeUriFragmentIdentifier(ptr) {
		if (typeof ptr !== 'string') { throw new TypeError('Invalid type: JSON Pointers are represented as strings.'); }
		if (ptr.length === 0 || ptr[0] !== '#') { throw new ReferenceError('Invalid JSON Pointer syntax; URI fragment idetifiers must begin with a hash.'); }
		if (ptr.length === 1) { return []; }
		if (ptr[1] !== '/') { throw new ReferenceError('Invalid JSON Pointer syntax.'); }
		var path = ptr.substring(2).split('/')
		, i = -1
		, len = path.length
		;
		while (++i < len) {
			path[i] = decodeURIComponent(path[i]).replace('~1', '/').replace('~0', '~');
		}
		return path;
	}

	function encodeUriFragmentIdentifier(path) {
		if (path && !Array.isArray(path)) { throw new TypeError('Invalid type: path must be an array of segments.'); }
		if (path.length === 0) { return '#'; }
		var res = []
		, i = -1
		, len = path.length
		;
		while (++i < len) {
			var segment = '' + path[i];
			res.push(encodeURIComponent(segment.replace('~', '~0').replace('/', '~1')));
		}
		return "#/".concat(res.join('/'));
	}

	function toArrayIndexReference(arr, idx) {
		var len = idx.length
		, cursor = 0
		;
		if (len === 0 || len > 1 && idx[0] === '0')  { return -1; }
		if (len === 1 && idx[0] === '-') { return arr.length; }

		while (++cursor < len) {
			if (idx[cursor] < '0' || idx[cursor] > '9') { return -1; }
		}
		return parseInt(idx, 10);
	}

	function list(obj, observe, path, key, stack, ptrs) {
		var i, len;
		path = path || [];
		var currentPath = path.slice(0);
		if (typeof key !== 'undefined') {
			currentPath.push(key);
		}
		var type = typeof obj;
		if (type === 'undefined') {
			return; // should only happen at the top level.
		} else {
			var ptr = encodeUriFragmentIdentifier(currentPath);
			if (type === 'object' && obj !== null) {
				stack = stack || [];
				ptrs = ptrs || [];
				var circ = stack.indexOf(obj);
				if (circ < 0) {
					stack.push(obj);
					ptrs.push(ptr);
					observe({
						fragmentId: ptr,
						value: obj
					});
					if (Array.isArray(obj)) {
						i = -1;
						len = obj.length;
						while (++i < len) {
							list(obj[i], observe, currentPath, i, stack, ptrs);
						}
					} else {
						var props = Object.getOwnPropertyNames(obj);
						i = -1;
						len = props.length;
						while (++i < len) {
							list(obj[props[i]], observe, currentPath, props[i], stack, ptrs);
						}
					}
					stack.length = stack.length - 1;
					ptrs.length = ptrs.length - 1;
				} else {
					observe({
						fragmentId: ptr,
						value: { '$ref': ptrs[circ] },
						circular: true
					});
				}
			} else {
				observe({
					fragmentId: ptr,
					value: obj
				});
			}
		}
	}

	function get(obj, path) {
		if (typeof obj !== 'undefined') {
			var it = obj
			, len = path.length
			, cursor = -1
			, step, p;
			if (len) {
				while (++cursor < len && it) {
					step = path[cursor];
					if (Array.isArray(it)) {
						if (isNaN(step)) {
							return;
						}
						p = toArrayIndexReference(it, step);
						if (it.length > p) {
							it = it[p];
						} else {
							return;
						}
					} else {
						it = it[step];
					}
				}
				return it;
			} else {
				return obj;
			}
		}
	}

	function set(obj, val, path, enc) {
		if (path.length === 0) { throw new Error("Cannot set the root object; assign it directly."); }
		if (typeof obj !== 'undefined') {
			var it = obj
			, len = path.length
			, end = path.length - 1
			, cursor = -1
			, step, p, rem;
			if (len) {
				while (++cursor < len) {
					step = path[cursor];
					if (Array.isArray(it)) {
						p = toArrayIndexReference(it, step);
						if (it.length > p) {
							if (cursor === end) {
								rem = it[p];
								it[p] = val;
								return rem;
							}
							it = it[p];
						} else if (it.length === p) {
							it.push(val);
							return undefined;
						} else {
							throw new ReferenceError("Not found: "
								.concat(enc(path.slice(0, cursor + 1), true), '.'));
						}
					} else {
						if (cursor === end) {
							rem = it[step];
							it[step] = val;
							return rem;
						}
						it = it[step];
						if (typeof it === 'undefined') {
							throw new ReferenceError("Not found: "
								.concat(enc(path.slice(0, cursor + 1), true), '.'));
						}
					}
				}
				if (cursor === len) {
					return it;
				}
			} else {
				return it;
			}
		}
	}

	function JsonPointer(ptr) {
		this.encode = (ptr.length > 0 && ptr[0] === '#') ? encodeUriFragmentIdentifier : encodePointer;
		if (Array.isArray(ptr)) {
			this.path = ptr;
		} else {
			var decode = (ptr.length > 0 && ptr[0] === '#') ? decodeUriFragmentIdentifier : decodePointer;
			this.path = decode(ptr);
		}
	}

	Object.defineProperty(JsonPointer.prototype, 'pointer', {
		enumerable: true,
		get: function () { return encodePointer(this.path); }
	});

	Object.defineProperty(JsonPointer.prototype, 'uriFragmentIdentifier', {
		enumerable: true,
		get: function () { return encodeUriFragmentIdentifier(this.path); }
	});

	JsonPointer.prototype.get = function (obj) {
		return get(obj, this.path);
	};

	JsonPointer.prototype.set = function (obj, val) {
		return set(obj, val, this.path, this.encode);
	};

	JsonPointer.prototype.toString = function () {
		return this.pointer;
	};

	JsonPointer.create = function (ptr) { return new JsonPointer(ptr); };
	JsonPointer.get = function (obj, ptr) {
		var decode = (ptr.length > 0 && ptr[0] === '#') ? decodeUriFragmentIdentifier : decodePointer;
		return get(obj, decode(ptr));
	};
	JsonPointer.set = function (obj, ptr, val) {
		var encode = (ptr.length > 0 && ptr[0] === '#') ? encodeUriFragmentIdentifier : encodePointer;
		var decode = (ptr.length > 0 && ptr[0] === '#') ? decodeUriFragmentIdentifier : decodePointer;

		return set(obj, val, decode(ptr), encode);
	};
	JsonPointer.list = function (obj, observe) {
		var res = [];
		observe = observe || function (observation) {
			res.push(observation);
		};
		list(obj, observe);
		if (res.length) {
			return res;
		}
	};
	JsonPointer.decodePointer = decodePointer;
	JsonPointer.encodePointer = encodePointer;
	JsonPointer.decodeUriFragmentIdentifier = decodeUriFragmentIdentifier;
	JsonPointer.encodeUriFragmentIdentifier = encodeUriFragmentIdentifier;

	JsonPointer.noConflict = function () {
		if (conflictResolution) {
			conflictResolution.forEach(function (it) { it(); });
			conflictResolution = null;
		}
		return JsonPointer;
	};

	if (typeof module !== 'undefined' && module && typeof exports === 'object' && exports && module.exports === exports) {
		module.exports = JsonPointer; // nodejs
	} else {
		$scope.JsonPointer = JsonPointer; // other... browser?
	}
}());

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],60:[function(require,module,exports){
(function (global){

var rng;

if (global.crypto && crypto.getRandomValues) {
  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // Moderately fast, high quality
  var _rnds8 = new Uint8Array(16);
  rng = function whatwgRNG() {
    crypto.getRandomValues(_rnds8);
    return _rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var  _rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return _rnds;
  };
}

module.exports = rng;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],61:[function(require,module,exports){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

// Unique ID creation requires a high quality random # generator.  We feature
// detect to determine the best RNG source, normalizing to a function that
// returns 128-bits of randomness, since that's what's usually required
var _rng = require('./rng');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
  _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
  var i = (buf && offset) || 0, ii = 0;

  buf = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
    if (ii < 16) { // Don't overflow!
      buf[i + ii++] = _hexToByte[oct];
    }
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    buf[i + ii++] = 0;
  }

  return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
  var i = offset || 0, bth = _byteToHex;
  return  bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = _rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; n++) {
    b[i + n] = node[n];
  }

  return buf ? buf : unparse(b);
}

// **`v4()` - Generate random UUID**

// See https://github.com/broofa/node-uuid for API details
function v4(options, buf, offset) {
  // Deprecated - 'format' argument, as supported in v1.2
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || _rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ii++) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || unparse(rnds);
}

// Export public API
var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;
uuid.parse = parse;
uuid.unparse = unparse;

module.exports = uuid;

},{"./rng":60}],62:[function(require,module,exports){
module.exports={
  "type": "object",
  "title": "Chiχ Link",
  "properties": {
    "id": {
      "type": "string",
      "required": false
    },
    "source": {
      "type": "object",
      "required": true,
      "properties": {
        "id": {
          "type": "string",
          "required": true
        },
        "port": {
          "type": "string",
          "required": true
        },
        "index": {
          "type": ["string", "number"],
          "required": false
        },
        "settings": {
          "type": "object"
        }
      }
    },
    "target": {
      "type": "object",
      "required": true,
      "properties": {
        "id": {
          "type": "string",
          "required": true
        },
        "port": {
          "type": "string",
          "required": true
        },
        "index": {
          "type": ["string", "number"],
          "required": false
        },
        "settings": {
          "type": "object",
          "properties": {
            "persist": {
              "type": "boolean"
            },
            "sync": {
              "type": "string"
            },
            "cyclic": {
              "type": "boolean"
            }
          }
        }
      }
    },
    "settings": {
      "type": "object",
      "properties": {
        "dispose": {
          "type": "boolean"
        }
      }
    },
    "metadata": {
      "type": "object"
    }
  },
  "additionalProperties": false
}

},{}],63:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Map",
  "collectionName": "flows",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "type": {
      "type":"string",
      "required": true
    },
    "env": {
      "type":"string",
      "required": false
    },
    "ns": {
      "type":"string",
      "required": false
    },
    "name": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string"
    },
    "provider": {
      "type":"string"
    },
    "providers": {
      "type":"object"
    },
    "keywords": {
      "type":"array"
    },
    "nodeDefinitions": {
      "type": "object"
    },
    "ports": {
      "type":"object",
      "properties": {
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        }
      }
    },
    "nodes": {
      "type":"array",
      "title":"Nodes",
      "required": true,
      "items": {
        "type": "object",
        "title": "Node",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": false,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "target": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  },
  "additionalProperties": false
}

},{}],64:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Nodes",
  "properties":{
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string",
      "required": false
    },
    "_id": {
      "type":"string"
    },
    "name": {
      "type":"string",
      "required": true
    },
    "ns": {
      "type":"string",
      "required": true
    },
    "state": {
      "type":"any"
    },
    "phrases": {
      "type":"object"
    },
    "env": {
      "type":"string",
      "enum": ["server","browser","polymer","phonegap"]
    },
    "async": {
      "type":"boolean",
      "required": false
    },
    "dependencies": {
      "type":"object",
      "required": false
    },
    "provider": {
      "required": false,
      "type":"string"
    },
    "providers": {
      "required": false,
      "type":"object"
    },
    "expose": {
      "type":"array",
      "required": false
    },
    "fn": {
      "type":["string","function"],
      "required": false
    },
    "ports": {
      "type":"object",
      "required": true,
      "properties":{
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        },
        "event": {
          "type":"object"
        }
      }
    },
    "type": {
      "enum":[
        "node",
        "flow",
        "provider",
        "data",
        "PolymerNode",
        "ReactNode",
        "StateNode"
      ],
      "required": false
    }
  },
  "additionalProperties": false
}

},{}],65:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Stage",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "env": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": true
    },
    "description": {
      "type":"string",
      "required": true
    },
    "actors": {
      "type":"array",
      "title":"Actors",
      "required": true,
      "items": {
        "type": "object",
        "title": "Actor",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": true,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"string",
            "required": true
          },
          "target": {
            "type":"string",
            "required": true
          },
          "out": {
            "type":"string",
            "required": false
          },
          "in": {
            "type":"string",
            "required": false
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  }
}

},{}],66:[function(require,module,exports){
'use strict';

/**
 *
 * Ok, this should be a general listener interface.
 *
 * One who will use it is the Actor.
 * But I want to be able to do the same for e.g. Loader.
 *
 * They will all be in chix-monitor-*
 *
 * npmlog =  Listener(instance, options);
 *
 * The return is just in case you want to do other stuff.
 *
 * e.g. fbpx wants to add this to npmlog:
 *
 * Logger.level = program.verbose ? 'verbose' : program.debug;
 *
 */
// function NpmLogActorMonitor(actor, opts) {
module.exports = function NpmLogActorMonitor(Logger, actor) {

   // TODO: just make an NpmLogIOMonitor.
   var ioHandler = actor.ioHandler;

   actor.on('removeLink', function(event) {
     Logger.debug(
       event.node ? event.node.identifier : 'Some Actor',
       'removed link'
     );
   });

   // Ok emiting each and every output I don't like for the IOHandler.
   // but whatever can change it later.
   ioHandler.on('output', function(data) {

     // I don't like this data.out.port thing vs data.port
     switch(data.port) {

        case ':plug':
         Logger.debug(
           data.node.identifier,
           'port %s plugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':unplug':
         Logger.debug(
           data.node.identifier,
           'port %s unplugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':portFill':
         Logger.info(
           data.node.identifier,
           'port %s filled with data',
           data.out.read().port);
        break;

        case ':contextUpdate':
         Logger.info(
           data.node.identifier,
           'port %s filled with context',
           data.out.read().port);
        break;

        case ':inputValidated':
          Logger.debug(data.node.identifier, 'input validated');
        break;

        case ':start':
          Logger.info(data.node.identifier, 'START');
        break;

        case ':freePort':
          Logger.debug(data.node.identifier, 'free port %s', data.out.read().port);
        break;

/*
       case ':queue':
         Logger.debug(
           data.node,
           'queue: %s',
           data.port
         );
       break;
*/

       case ':openPort':
         Logger.info(
           data.node.identifier,
           'opened port %s (%d)',
           data.out.read().port,
           data.out.read().connections
           );
       break;

       case ':closePort':
         Logger.info(
           data.node.identifier,
           'closed port %s',
           data.out.read().port
           );
       break;

       case ':index':
         Logger.info(
           data.node.identifier,
           '[%s] set on port `%s`',
           data.out.read().index,
           data.out.read().port
           );
       break;

       case ':nodeComplete':
         // console.log('nodeComplete', data);
         Logger.info(data.node.identifier, 'completed');
       break;

       case ':portReject':
         Logger.debug(
           data.node.identifier,
           'rejected input on port %s',
           data.out.read().port
         );
       break;

       case ':inputRequired':
         Logger.error(
           data.node.identifier,
           'input required on port %s',
           data.out.read().port);
       break;

       case ':error':
         Logger.error(
           data.node.identifier,
           data.out.read().msg
         );
       break;

       case ':nodeTimeout':
         Logger.error(
           data.node.identifier,
           'node timeout'
         );
       break;

       case ':executed':
         Logger.info(
           data.node.identifier,
           'EXECUTED'
         );
       break;

       case ':inputTimeout':
         Logger.info(
           data.node.identifier,
           'input timeout, got %s need %s',
           Object.keys(data.node.input).join(', '),
           data.node.openPorts.join(', '));
       break;

       default:
         // TODO: if the above misses a system port it will be reported
         //       as default normal output.
         Logger.info(data.node.identifier, 'output on port %s', data.port);
       break;

     }

   });

   return Logger;

};

},{}],67:[function(require,module,exports){
'use strict';

/**
 *
 * NpmLog monitor for the Loader
 *
 */
module.exports = function NpmLogLoaderMonitor(Logger, loader) {

  loader.on('loadUrl', function(data) {
    Logger.info( 'loadUrl', data.url);
  });

  loader.on('loadFile', function(data) {
    Logger.info( 'loadFile', data.path);
  });

  loader.on('loadCache', function(data) {
    Logger.debug( 'cache', 'loaded cache file %s', data.file);
  });

  loader.on('purgeCache', function(data) {
    Logger.debug( 'cache', 'purged cache file %s', data.file);
  });

  loader.on('writeCache', function(data) {
    Logger.debug( 'cache', 'wrote cache file %s', data.file);
  });

  return Logger;

};

},{}],"urJme/":[function(require,module,exports){
exports.Actor = require('./lib/actor');
exports.Loader = require('./lib/loader');

},{"./lib/actor":66,"./lib/loader":67}],"chix-monitor-npmlog":[function(require,module,exports){
module.exports=require('urJme/');
},{}],"V4HZ/5":[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":72}],"debug":[function(require,module,exports){
module.exports=require('V4HZ/5');
},{}],72:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":73}],73:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],74:[function(require,module,exports){
/**
 * Specific customUtils for the browser, where we don't have access to the Crypto and Buffer modules
 */

/**
 * Taken from the crypto-browserify module
 * https://github.com/dominictarr/crypto-browserify
 * NOTE: Math.random() does not guarantee "cryptographic quality" but we actually don't need it
 */
function randomBytes (size) {
  var bytes = new Array(size);
  var r;

  for (var i = 0, r; i < size; i++) {
    if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
    bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
  }

  return bytes;
}


/**
 * Taken from the base64-js module
 * https://github.com/beatgammit/base64-js/
 */
function byteArrayToBase64 (uint8) {
  var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    , extraBytes = uint8.length % 3   // if we have 1 byte left, pad 2 bytes
    , output = ""
    , temp, length, i;

  function tripletToBase64 (num) {
    return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
  };

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
    temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
    output += tripletToBase64(temp);
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  switch (extraBytes) {
    case 1:
      temp = uint8[uint8.length - 1];
      output += lookup[temp >> 2];
      output += lookup[(temp << 4) & 0x3F];
      output += '==';
      break;
    case 2:
      temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1]);
      output += lookup[temp >> 10];
      output += lookup[(temp >> 4) & 0x3F];
      output += lookup[(temp << 2) & 0x3F];
      output += '=';
      break;
  }

  return output;
}


/**
 * Return a random alphanumerical string of length len
 * There is a very small probability (less than 1/1,000,000) for the length to be less than len
 * (il the base64 conversion yields too many pluses and slashes) but
 * that's not an issue here
 * The probability of a collision is extremely small (need 3*10^12 documents to have one chance in a million of a collision)
 * See http://en.wikipedia.org/wiki/Birthday_problem
 */
function uid (len) {
  return byteArrayToBase64(randomBytes(Math.ceil(Math.max(8, len * 2)))).replace(/[+\/]/g, '').slice(0, len);
}



module.exports.uid = uid;

},{}],75:[function(require,module,exports){
/**
 * Way data is stored for this database
 * For a Node.js/Node Webkit database it's the file system
 * For a browser-side database it's localStorage when supported
 *
 * This version is the Node.js/Node Webkit version
 */



function exists (filename, callback) {
  // In this specific case this always answers that the file doesn't exist
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }

  if (localStorage.getItem(filename) !== null) {
    return callback(true);
  } else {
    return callback(false);
  }
}


function rename (filename, newFilename, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }

  if (localStorage.getItem(filename) === null) {
    localStorage.removeItem(newFilename);
  } else {
    localStorage.setItem(newFilename, localStorage.getItem(filename));
    localStorage.removeItem(filename);
  }

  return callback();
}


function writeFile (filename, contents, options, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }
  
  // Options do not matter in browser setup
  if (typeof options === 'function') { callback = options; }

  localStorage.setItem(filename, contents);
  return callback();
}


function appendFile (filename, toAppend, options, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }
  
  // Options do not matter in browser setup
  if (typeof options === 'function') { callback = options; }

  var contents = localStorage.getItem(filename) || '';
  contents += toAppend;

  localStorage.setItem(filename, contents);
  return callback();
}


function readFile (filename, options, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }
  
  // Options do not matter in browser setup
  if (typeof options === 'function') { callback = options; }

  var contents = localStorage.getItem(filename) || '';
  return callback(null, contents);
}


function unlink (filename, callback) {
  if (typeof localStorage === 'undefined') { console.log("WARNING - This browser doesn't support localStorage, no data will be saved in NeDB!"); return callback(); }

  localStorage.removeItem(filename);
  return callback();
}


// Nothing done, no directories will be used on the browser
function mkdirp (dir, callback) {
  return callback();
}



// Interface
module.exports.exists = exists;
module.exports.rename = rename;
module.exports.writeFile = writeFile;
module.exports.appendFile = appendFile;
module.exports.readFile = readFile;
module.exports.unlink = unlink;
module.exports.mkdirp = mkdirp;


},{}],"nedb":[function(require,module,exports){
module.exports=require('/tIhav');
},{}],"/tIhav":[function(require,module,exports){
var Datastore = require('./lib/datastore');

module.exports = Datastore;

},{"./lib/datastore":79}],78:[function(require,module,exports){
/**
 * Manage access to data, be it to find, update or remove it
 */
var model = require('./model')
  , _ = require('underscore')
  ;



/**
 * Create a new cursor for this collection
 * @param {Datastore} db - The datastore this cursor is bound to
 * @param {Query} query - The query this cursor will operate on
 * @param {Function} execDn - Handler to be executed after cursor has found the results and before the callback passed to find/findOne/update/remove
 */
function Cursor (db, query, execFn) {
  this.db = db;
  this.query = query || {};
  if (execFn) { this.execFn = execFn; }
}


/**
 * Set a limit to the number of results
 */
Cursor.prototype.limit = function(limit) {
  this._limit = limit;
  return this;
};


/**
 * Skip a the number of results
 */
Cursor.prototype.skip = function(skip) {
  this._skip = skip;
  return this;
};


/**
 * Sort results of the query
 * @param {SortQuery} sortQuery - SortQuery is { field: order }, field can use the dot-notation, order is 1 for ascending and -1 for descending
 */
Cursor.prototype.sort = function(sortQuery) {
  this._sort = sortQuery;
  return this;
};


/**
 * Add the use of a projection
 * @param {Object} projection - MongoDB-style projection. {} means take all fields. Then it's { key1: 1, key2: 1 } to take only key1 and key2
 *                              { key1: 0, key2: 0 } to omit only key1 and key2. Except _id, you can't mix takes and omits
 */
Cursor.prototype.projection = function(projection) {
  this._projection = projection;
  return this;
};


/**
 * Apply the projection
 */
Cursor.prototype.project = function (candidates) {
  var res = [], self = this
    , keepId, action, keys
    ;

  if (this._projection === undefined || Object.keys(this._projection).length === 0) {
    return candidates;
  }

  keepId = this._projection._id === 0 ? false : true;
  this._projection = _.omit(this._projection, '_id');

  // Check for consistency
  keys = Object.keys(this._projection);
  keys.forEach(function (k) {
    if (action !== undefined && self._projection[k] !== action) { throw "Can't both keep and omit fields except for _id"; }
    action = self._projection[k];
  });

  // Do the actual projection
  candidates.forEach(function (candidate) {
    var toPush = action === 1 ? _.pick(candidate, keys) : _.omit(candidate, keys);
    if (keepId) {
      toPush._id = candidate._id;
    } else {
      delete toPush._id;
    }
    res.push(toPush);
  });

  return res;
};


/**
 * Get all matching elements
 * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
 * This is an internal function, use exec which uses the executor
 *
 * @param {Function} callback - Signature: err, results
 */
Cursor.prototype._exec = function(callback) {
  var candidates = this.db.getCandidates(this.query)
    , res = [], added = 0, skipped = 0, self = this
    , error = null
    , i, keys, key
    ;

  try {
    for (i = 0; i < candidates.length; i += 1) {
      if (model.match(candidates[i], this.query)) {
        // If a sort is defined, wait for the results to be sorted before applying limit and skip
        if (!this._sort) {
          if (this._skip && this._skip > skipped) {
            skipped += 1;
          } else {
            res.push(candidates[i]);
            added += 1;
            if (this._limit && this._limit <= added) { break; }
          }
        } else {
          res.push(candidates[i]);
        }
      }
    }
  } catch (err) {
    return callback(err);
  }

  // Apply all sorts
  if (this._sort) {
    keys = Object.keys(this._sort);

    // Sorting
    var criteria = [];
    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      criteria.push({ key: key, direction: self._sort[key] });
    }
    res.sort(function(a, b) {
      var criterion, compare, i;
      for (i = 0; i < criteria.length; i++) {
        criterion = criteria[i];
        compare = criterion.direction * model.compareThings(model.getDotValue(a, criterion.key), model.getDotValue(b, criterion.key));
        if (compare !== 0) {
          return compare;
        }
      }
      return 0;
    });

    // Applying limit and skip
    var limit = this._limit || res.length
      , skip = this._skip || 0;

    res = res.slice(skip, skip + limit);
  }

  // Apply projection
  try {
    res = this.project(res);
  } catch (e) {
    error = e;
    res = undefined;
  }

  if (this.execFn) {
    return this.execFn(error, res, callback);
  } else {
    return callback(error, res);
  }
};

Cursor.prototype.exec = function () {
  this.db.executor.push({ this: this, fn: this._exec, arguments: arguments });
};



// Interface
module.exports = Cursor;

},{"./model":82,"underscore":85}],79:[function(require,module,exports){
var customUtils = require('./customUtils')
  , model = require('./model')
  , async = require('async')
  , Executor = require('./executor')
  , Index = require('./indexes')
  , util = require('util')
  , _ = require('underscore')
  , Persistence = require('./persistence')
  , Cursor = require('./cursor')
  ;


/**
 * Create a new collection
 * @param {String} options.filename Optional, datastore will be in-memory only if not provided
 * @param {Boolean} options.inMemoryOnly Optional, default to false
 * @param {Boolean} options.nodeWebkitAppName Optional, specify the name of your NW app if you want options.filename to be relative to the directory where
 *                                            Node Webkit stores application data such as cookies and local storage (the best place to store data in my opinion)
 * @param {Boolean} options.autoload Optional, defaults to false
 * @param {Function} options.onload Optional, if autoload is used this will be called after the load database with the error object as parameter. If you don't pass it the error will be thrown
 * @param {Function} options.afterSerialization and options.beforeDeserialization Optional, serialization hooks
 * @param {Number} options.corruptAlertThreshold Optional, threshold after which an alert is thrown if too much data is corrupt
 */
function Datastore (options) {
  var filename;

  // Retrocompatibility with v0.6 and before
  if (typeof options === 'string') {
    filename = options;
    this.inMemoryOnly = false;   // Default
  } else {
    options = options || {};
    filename = options.filename;
    this.inMemoryOnly = options.inMemoryOnly || false;
    this.autoload = options.autoload || false;
  }

  // Determine whether in memory or persistent
  if (!filename || typeof filename !== 'string' || filename.length === 0) {
    this.filename = null;
    this.inMemoryOnly = true;
  } else {
    this.filename = filename;
  }

  // Persistence handling
  this.persistence = new Persistence({ db: this, nodeWebkitAppName: options.nodeWebkitAppName
                                      , afterSerialization: options.afterSerialization
                                      , beforeDeserialization: options.beforeDeserialization
                                      , corruptAlertThreshold: options.corruptAlertThreshold
                                      });

  // This new executor is ready if we don't use persistence
  // If we do, it will only be ready once loadDatabase is called
  this.executor = new Executor();
  if (this.inMemoryOnly) { this.executor.ready = true; }

  // Indexed by field name, dot notation can be used
  // _id is always indexed and since _ids are generated randomly the underlying
  // binary is always well-balanced
  this.indexes = {};
  this.indexes._id = new Index({ fieldName: '_id', unique: true });
  
  // Queue a load of the database right away and call the onload handler
  // By default (no onload handler), if there is an error there, no operation will be possible so warn the user by throwing an exception
  if (this.autoload) { this.loadDatabase(options.onload || function (err) {
    if (err) { throw err; }
  }); }
}


/**
 * Load the database from the datafile, and trigger the execution of buffered commands if any
 */
Datastore.prototype.loadDatabase = function () {
  this.executor.push({ this: this.persistence, fn: this.persistence.loadDatabase, arguments: arguments }, true);
};


/**
 * Get an array of all the data in the database
 */
Datastore.prototype.getAllData = function () {
  return this.indexes._id.getAll();
};


/**
 * Reset all currently defined indexes
 */
Datastore.prototype.resetIndexes = function (newData) {
  var self = this;

  Object.keys(this.indexes).forEach(function (i) {
    self.indexes[i].reset(newData);
  });
};


/**
 * Ensure an index is kept for this field. Same parameters as lib/indexes
 * For now this function is synchronous, we need to test how much time it takes
 * We use an async API for consistency with the rest of the code
 * @param {String} options.fieldName
 * @param {Boolean} options.unique
 * @param {Boolean} options.sparse
 * @param {Function} cb Optional callback, signature: err
 */
Datastore.prototype.ensureIndex = function (options, cb) {
  var callback = cb || function () {};

  options = options || {};

  if (!options.fieldName) { return callback({ missingFieldName: true }); }
  if (this.indexes[options.fieldName]) { return callback(null); }

  this.indexes[options.fieldName] = new Index(options);

  try {
    this.indexes[options.fieldName].insert(this.getAllData());
  } catch (e) {
    delete this.indexes[options.fieldName];
    return callback(e);
  }

  // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
  this.persistence.persistNewState([{ $$indexCreated: options }], function (err) {
    if (err) { return callback(err); }
    return callback(null);
  });
};


/**
 * Remove an index
 * @param {String} fieldName
 * @param {Function} cb Optional callback, signature: err 
 */
Datastore.prototype.removeIndex = function (fieldName, cb) {
  var callback = cb || function () {};
  
  delete this.indexes[fieldName];
  
  this.persistence.persistNewState([{ $$indexRemoved: fieldName }], function (err) {
    if (err) { return callback(err); }
    return callback(null);
  });  
};


/**
 * Add one or several document(s) to all indexes
 */
Datastore.prototype.addToIndexes = function (doc) {
  var i, failingIndex, error
    , keys = Object.keys(this.indexes)
    ;

  for (i = 0; i < keys.length; i += 1) {
    try {
      this.indexes[keys[i]].insert(doc);
    } catch (e) {
      failingIndex = i;
      error = e;
      break;
    }
  }

  // If an error happened, we need to rollback the insert on all other indexes
  if (error) {
    for (i = 0; i < failingIndex; i += 1) {
      this.indexes[keys[i]].remove(doc);
    }

    throw error;
  }
};


/**
 * Remove one or several document(s) from all indexes
 */
Datastore.prototype.removeFromIndexes = function (doc) {
  var self = this;

  Object.keys(this.indexes).forEach(function (i) {
    self.indexes[i].remove(doc);
  });
};


/**
 * Update one or several documents in all indexes
 * To update multiple documents, oldDoc must be an array of { oldDoc, newDoc } pairs
 * If one update violates a constraint, all changes are rolled back
 */
Datastore.prototype.updateIndexes = function (oldDoc, newDoc) {
  var i, failingIndex, error
    , keys = Object.keys(this.indexes)
    ;

  for (i = 0; i < keys.length; i += 1) {
    try {
      this.indexes[keys[i]].update(oldDoc, newDoc);
    } catch (e) {
      failingIndex = i;
      error = e;
      break;
    }
  }

  // If an error happened, we need to rollback the update on all other indexes
  if (error) {
    for (i = 0; i < failingIndex; i += 1) {
      this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
    }

    throw error;
  }
};


/**
 * Return the list of candidates for a given query
 * Crude implementation for now, we return the candidates given by the first usable index if any
 * We try the following query types, in this order: basic match, $in match, comparison match
 * One way to make it better would be to enable the use of multiple indexes if the first usable index
 * returns too much data. I may do it in the future.
 *
 * TODO: needs to be moved to the Cursor module
 */
Datastore.prototype.getCandidates = function (query) {
  var indexNames = Object.keys(this.indexes)
    , usableQueryKeys;

  // For a basic match
  usableQueryKeys = [];
  Object.keys(query).forEach(function (k) {
    if (typeof query[k] === 'string' || typeof query[k] === 'number' || typeof query[k] === 'boolean' || util.isDate(query[k]) || query[k] === null) {
      usableQueryKeys.push(k);
    }
  });
  usableQueryKeys = _.intersection(usableQueryKeys, indexNames);
  if (usableQueryKeys.length > 0) {
    return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]]);
  }

  // For a $in match
  usableQueryKeys = [];
  Object.keys(query).forEach(function (k) {
    if (query[k] && query[k].hasOwnProperty('$in')) {
      usableQueryKeys.push(k);
    }
  });
  usableQueryKeys = _.intersection(usableQueryKeys, indexNames);
  if (usableQueryKeys.length > 0) {
    return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]].$in);
  }

  // For a comparison match
  usableQueryKeys = [];
  Object.keys(query).forEach(function (k) {
    if (query[k] && (query[k].hasOwnProperty('$lt') || query[k].hasOwnProperty('$lte') || query[k].hasOwnProperty('$gt') || query[k].hasOwnProperty('$gte'))) {
      usableQueryKeys.push(k);
    }
  });
  usableQueryKeys = _.intersection(usableQueryKeys, indexNames);
  if (usableQueryKeys.length > 0) {
    return this.indexes[usableQueryKeys[0]].getBetweenBounds(query[usableQueryKeys[0]]);
  }

  // By default, return all the DB data
  return this.getAllData();
};


/**
 * Insert a new document
 * @param {Function} cb Optional callback, signature: err, insertedDoc
 *
 * @api private Use Datastore.insert which has the same signature
 */
Datastore.prototype._insert = function (newDoc, cb) {
  var callback = cb || function () {}
    ;

  try {
    this._insertInCache(newDoc);
  } catch (e) {
    return callback(e);
  }

  this.persistence.persistNewState(util.isArray(newDoc) ? newDoc : [newDoc], function (err) {
    if (err) { return callback(err); }
    return callback(null, newDoc);
  });
};

/**
 * Create a new _id that's not already in use
 */
Datastore.prototype.createNewId = function () {
  var tentativeId = customUtils.uid(16);
  // Try as many times as needed to get an unused _id. As explained in customUtils, the probability of this ever happening is extremely small, so this is O(1)
  if (this.indexes._id.getMatching(tentativeId).length > 0) {
    tentativeId = this.createNewId();
  }
  return tentativeId;
};

/**
 * Prepare a document (or array of documents) to be inserted in a database
 * @api private
 */
Datastore.prototype.prepareDocumentForInsertion = function (newDoc) {
  var preparedDoc, self = this;

  if (util.isArray(newDoc)) {
    preparedDoc = [];
    newDoc.forEach(function (doc) { preparedDoc.push(self.prepareDocumentForInsertion(doc)); });
  } else {
    if (newDoc._id === undefined) {
      newDoc._id = this.createNewId();
    }
    preparedDoc = model.deepCopy(newDoc);
    model.checkObject(preparedDoc);
  }
  
  return preparedDoc;
};

/**
 * If newDoc is an array of documents, this will insert all documents in the cache
 * @api private
 */
Datastore.prototype._insertInCache = function (newDoc) {
  if (util.isArray(newDoc)) {
    this._insertMultipleDocsInCache(newDoc);
  } else {
    this.addToIndexes(this.prepareDocumentForInsertion(newDoc));  
  }
};

/**
 * If one insertion fails (e.g. because of a unique constraint), roll back all previous
 * inserts and throws the error
 * @api private
 */
Datastore.prototype._insertMultipleDocsInCache = function (newDocs) {
  var i, failingI, error
    , preparedDocs = this.prepareDocumentForInsertion(newDocs)
    ;

  for (i = 0; i < preparedDocs.length; i += 1) {
    try {
      this.addToIndexes(preparedDocs[i]);
    } catch (e) {
      error = e;
      failingI = i;
      break;
    }
  }
  
  if (error) {
    for (i = 0; i < failingI; i += 1) {
      this.removeFromIndexes(preparedDocs[i]);
    }
    
    throw error;
  }
};

Datastore.prototype.insert = function () {
  this.executor.push({ this: this, fn: this._insert, arguments: arguments });
};


/**
 * Count all documents matching the query
 * @param {Object} query MongoDB-style query
 */
Datastore.prototype.count = function(query, callback) {
  var cursor = new Cursor(this, query, function(err, docs, callback) {
    if (err) { return callback(err); }
    return callback(null, docs.length);
  });

  if (typeof callback === 'function') {
    cursor.exec(callback);
  } else {
    return cursor;
  }
};


/**
 * Find all documents matching the query
 * If no callback is passed, we return the cursor so that user can limit, skip and finally exec
 * @param {Object} query MongoDB-style query
 * @param {Object} projection MongoDB-style projection
 */
Datastore.prototype.find = function (query, projection, callback) {
  switch (arguments.length) {
    case 1:
      projection = {};
      // callback is undefined, will return a cursor
      break;
    case 2:
      if (typeof projection === 'function') {
        callback = projection;
        projection = {};
      }   // If not assume projection is an object and callback undefined
      break;
  }

  var cursor = new Cursor(this, query, function(err, docs, callback) {
    var res = [], i;

    if (err) { return callback(err); }

    for (i = 0; i < docs.length; i += 1) {
      res.push(model.deepCopy(docs[i]));
    }
    return callback(null, res);
  });

  cursor.projection(projection);
  if (typeof callback === 'function') {
    cursor.exec(callback);
  } else {
    return cursor;
  }
};


/**
 * Find one document matching the query
 * @param {Object} query MongoDB-style query
 * @param {Object} projection MongoDB-style projection
 */
Datastore.prototype.findOne = function (query, projection, callback) {
  switch (arguments.length) {
    case 1:
      projection = {};
      // callback is undefined, will return a cursor
      break;
    case 2:
      if (typeof projection === 'function') {
        callback = projection;
        projection = {};
      }   // If not assume projection is an object and callback undefined
      break;
  }

  var cursor = new Cursor(this, query, function(err, docs, callback) {
    if (err) { return callback(err); }
    if (docs.length === 1) {
      return callback(null, model.deepCopy(docs[0]));
    } else {
      return callback(null, null);
    }
  });

  cursor.projection(projection).limit(1);
  if (typeof callback === 'function') {
    cursor.exec(callback);
  } else {
    return cursor;
  }
};


/**
 * Update all docs matching query
 * For now, very naive implementation (recalculating the whole database)
 * @param {Object} query
 * @param {Object} updateQuery
 * @param {Object} options Optional options
 *                 options.multi If true, can update multiple documents (defaults to false)
 *                 options.upsert If true, document is inserted if the query doesn't match anything
 * @param {Function} cb Optional callback, signature: err, numReplaced, upsert (set to true if the update was in fact an upsert)
 *
 * @api private Use Datastore.update which has the same signature
 */
Datastore.prototype._update = function (query, updateQuery, options, cb) {
  var callback
    , self = this
    , numReplaced = 0
    , multi, upsert
    , i
    ;

  if (typeof options === 'function') { cb = options; options = {}; }
  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;
  upsert = options.upsert !== undefined ? options.upsert : false;

  async.waterfall([
  function (cb) {   // If upsert option is set, check whether we need to insert the doc
    if (!upsert) { return cb(); }

    // Need to use an internal function not tied to the executor to avoid deadlock
    var cursor = new Cursor(self, query);
    cursor.limit(1)._exec(function (err, docs) {
      if (err) { return callback(err); }
      if (docs.length === 1) {
        return cb();
      } else {
        var toBeInserted;
        
        try {
          model.checkObject(updateQuery);
          // updateQuery is a simple object with no modifier, use it as the document to insert
          toBeInserted = updateQuery;
        } catch (e) {
          // updateQuery contains modifiers, use the find query as the base,
          // strip it from all operators and update it according to updateQuery
          try {
            toBeInserted = model.modify(model.deepCopy(query, true), updateQuery);
          } catch (err) {
            return callback(err);
          }
        }

        return self._insert(toBeInserted, function (err, newDoc) {
          if (err) { return callback(err); }
          return callback(null, 1, newDoc);
        });
      }
    });
  }
  , function () {   // Perform the update
    var modifiedDoc
	  , candidates = self.getCandidates(query)
	  , modifications = []
	  ;

	// Preparing update (if an error is thrown here neither the datafile nor
	// the in-memory indexes are affected)
    try {
      for (i = 0; i < candidates.length; i += 1) {
        if (model.match(candidates[i], query) && (multi || numReplaced === 0)) {
          numReplaced += 1;
          modifiedDoc = model.modify(candidates[i], updateQuery);
          modifications.push({ oldDoc: candidates[i], newDoc: modifiedDoc });
        }
      }
    } catch (err) {
      return callback(err);
    }
	
	// Change the docs in memory
	try {
      self.updateIndexes(modifications);
	} catch (err) {
	  return callback(err);
	}

	// Update the datafile
    self.persistence.persistNewState(_.pluck(modifications, 'newDoc'), function (err) {
      if (err) { return callback(err); }
      return callback(null, numReplaced);
    });
  }
  ]);
};
Datastore.prototype.update = function () {
  this.executor.push({ this: this, fn: this._update, arguments: arguments });
};


/**
 * Remove all docs matching the query
 * For now very naive implementation (similar to update)
 * @param {Object} query
 * @param {Object} options Optional options
 *                 options.multi If true, can update multiple documents (defaults to false)
 * @param {Function} cb Optional callback, signature: err, numRemoved
 *
 * @api private Use Datastore.remove which has the same signature
 */
Datastore.prototype._remove = function (query, options, cb) {
  var callback
    , self = this
    , numRemoved = 0
    , multi
    , removedDocs = []
    , candidates = this.getCandidates(query)
    ;

  if (typeof options === 'function') { cb = options; options = {}; }
  callback = cb || function () {};
  multi = options.multi !== undefined ? options.multi : false;

  try {
    candidates.forEach(function (d) {
      if (model.match(d, query) && (multi || numRemoved === 0)) {
        numRemoved += 1;
        removedDocs.push({ $$deleted: true, _id: d._id });
        self.removeFromIndexes(d);
      }
    });
  } catch (err) { return callback(err); }

  self.persistence.persistNewState(removedDocs, function (err) {
    if (err) { return callback(err); }
    return callback(null, numRemoved);
  });
};
Datastore.prototype.remove = function () {
  this.executor.push({ this: this, fn: this._remove, arguments: arguments });
};






module.exports = Datastore;

},{"./cursor":78,"./customUtils":74,"./executor":80,"./indexes":81,"./model":82,"./persistence":83,"async":84,"underscore":85,"util":6}],80:[function(require,module,exports){
(function (process){
/**
 * Responsible for sequentially executing actions on the database
 */

var async = require('async')
  ;

function Executor () {
  this.buffer = [];
  this.ready = false;

  // This queue will execute all commands, one-by-one in order
  this.queue = async.queue(function (task, cb) {
    var callback
      , lastArg = task.arguments[task.arguments.length - 1]
      , i, newArguments = []
      ;

    // task.arguments is an array-like object on which adding a new field doesn't work, so we transform it into a real array
    for (i = 0; i < task.arguments.length; i += 1) { newArguments.push(task.arguments[i]); }

    // Always tell the queue task is complete. Execute callback if any was given.
    if (typeof lastArg === 'function') {
      callback = function () {
        if (typeof setImmediate === 'function') {
           setImmediate(cb);
        } else {
          process.nextTick(cb);
        }
        lastArg.apply(null, arguments);
      };

      newArguments[newArguments.length - 1] = callback;
    } else {
      callback = function () { cb(); };
      newArguments.push(callback);
    }


    task.fn.apply(task.this, newArguments);
  }, 1);
}


/**
 * If executor is ready, queue task (and process it immediately if executor was idle)
 * If not, buffer task for later processing
 * @param {Object} task
 *                 task.this - Object to use as this
 *                 task.fn - Function to execute
 *                 task.arguments - Array of arguments
 * @param {Boolean} forceQueuing Optional (defaults to false) force executor to queue task even if it is not ready
 */
Executor.prototype.push = function (task, forceQueuing) {
  if (this.ready || forceQueuing) {
    this.queue.push(task);
  } else {
    this.buffer.push(task);
  }
};


/**
 * Queue all tasks in buffer (in the same order they came in)
 * Automatically sets executor as ready
 */
Executor.prototype.processBuffer = function () {
  var i;
  this.ready = true;
  for (i = 0; i < this.buffer.length; i += 1) { this.queue.push(this.buffer[i]); }
  this.buffer = [];
};



// Interface
module.exports = Executor;

}).call(this,require("z02cDi"))
},{"async":84,"z02cDi":4}],81:[function(require,module,exports){
var BinarySearchTree = require('binary-search-tree').AVLTree
  , model = require('./model')
  , _ = require('underscore')
  , util = require('util')
  ;

/**
 * Two indexed pointers are equal iif they point to the same place
 */
function checkValueEquality (a, b) {
  return a === b;
}

/**
 * Type-aware projection
 */
function projectForUnique (elt) {
  if (elt === null) { return '$null'; }
  if (typeof elt === 'string') { return '$string' + elt; }
  if (typeof elt === 'boolean') { return '$boolean' + elt; }
  if (typeof elt === 'number') { return '$number' + elt; }
  if (util.isArray(elt)) { return '$date' + elt.getTime(); }
  
  return elt;   // Arrays and objects, will check for pointer equality
}


/**
 * Create a new index
 * All methods on an index guarantee that either the whole operation was successful and the index changed
 * or the operation was unsuccessful and an error is thrown while the index is unchanged
 * @param {String} options.fieldName On which field should the index apply (can use dot notation to index on sub fields)
 * @param {Boolean} options.unique Optional, enforce a unique constraint (default: false)
 * @param {Boolean} options.sparse Optional, allow a sparse index (we can have documents for which fieldName is undefined) (default: false)
 */
function Index (options) {
  this.fieldName = options.fieldName;
  this.unique = options.unique || false;
  this.sparse = options.sparse || false;

  this.treeOptions = { unique: this.unique, compareKeys: model.compareThings, checkValueEquality: checkValueEquality };

  this.reset();   // No data in the beginning
}


/**
 * Reset an index
 * @param {Document or Array of documents} newData Optional, data to initialize the index with
 *                                                 If an error is thrown during insertion, the index is not modified
 */
Index.prototype.reset = function (newData) {
  this.tree = new BinarySearchTree(this.treeOptions);

  if (newData) { this.insert(newData); }
};


/**
 * Insert a new document in the index
 * If an array is passed, we insert all its elements (if one insertion fails the index is not modified)
 * O(log(n))
 */
Index.prototype.insert = function (doc) {
  var key, self = this
    , keys, i, failingI, error
    ;

  if (util.isArray(doc)) { this.insertMultipleDocs(doc); return; }

  key = model.getDotValue(doc, this.fieldName);

  // We don't index documents that don't contain the field if the index is sparse
  if (key === undefined && this.sparse) { return; }

  if (!util.isArray(key)) {
    this.tree.insert(key, doc);
  } else {
    // If an insert fails due to a unique constraint, roll back all inserts before it
    keys = _.uniq(key, projectForUnique);

    for (i = 0; i < keys.length; i += 1) {
      try {
        this.tree.insert(keys[i], doc);
      } catch (e) {
        error = e;
        failingI = i;
        break;
      }
    }
    
    if (error) {
      for (i = 0; i < failingI; i += 1) {
        this.tree.delete(keys[i], doc);
      }
      
      throw error;
    }
  }
};


/**
 * Insert an array of documents in the index
 * If a constraint is violated, the changes should be rolled back and an error thrown
 *
 * @API private
 */
Index.prototype.insertMultipleDocs = function (docs) {
  var i, error, failingI;

  for (i = 0; i < docs.length; i += 1) {
    try {
      this.insert(docs[i]);
    } catch (e) {
      error = e;
      failingI = i;
      break;
    }
  }

  if (error) {
    for (i = 0; i < failingI; i += 1) {
      this.remove(docs[i]);
    }

    throw error;
  }
};


/**
 * Remove a document from the index
 * If an array is passed, we remove all its elements
 * The remove operation is safe with regards to the 'unique' constraint
 * O(log(n))
 */
Index.prototype.remove = function (doc) {
  var key, self = this;

  if (util.isArray(doc)) { doc.forEach(function (d) { self.remove(d); }); return; }

  key = model.getDotValue(doc, this.fieldName);

  if (key === undefined && this.sparse) { return; }

  if (!util.isArray(key)) {
    this.tree.delete(key, doc);
  } else {
    _.uniq(key, projectForUnique).forEach(function (_key) {
      self.tree.delete(_key, doc);
    });
  }
};


/**
 * Update a document in the index
 * If a constraint is violated, changes are rolled back and an error thrown
 * Naive implementation, still in O(log(n))
 */
Index.prototype.update = function (oldDoc, newDoc) {
  if (util.isArray(oldDoc)) { this.updateMultipleDocs(oldDoc); return; }

  this.remove(oldDoc);

  try {
    this.insert(newDoc);
  } catch (e) {
    this.insert(oldDoc);
    throw e;
  }
};


/**
 * Update multiple documents in the index
 * If a constraint is violated, the changes need to be rolled back
 * and an error thrown
 * @param {Array of oldDoc, newDoc pairs} pairs
 *
 * @API private
 */
Index.prototype.updateMultipleDocs = function (pairs) {
  var i, failingI, error;

  for (i = 0; i < pairs.length; i += 1) {
    this.remove(pairs[i].oldDoc);
  }

  for (i = 0; i < pairs.length; i += 1) {
    try {
      this.insert(pairs[i].newDoc);
    } catch (e) {
      error = e;
      failingI = i;
      break;
    }
  }

  // If an error was raised, roll back changes in the inverse order
  if (error) {
    for (i = 0; i < failingI; i += 1) {
      this.remove(pairs[i].newDoc);
    }

    for (i = 0; i < pairs.length; i += 1) {
      this.insert(pairs[i].oldDoc);
    }

    throw error;
  }
};


/**
 * Revert an update
 */
Index.prototype.revertUpdate = function (oldDoc, newDoc) {
  var revert = [];

  if (!util.isArray(oldDoc)) {
    this.update(newDoc, oldDoc);
  } else {
    oldDoc.forEach(function (pair) {
      revert.push({ oldDoc: pair.newDoc, newDoc: pair.oldDoc });
    });
    this.update(revert);
  }
};


// Append all elements in toAppend to array
function append (array, toAppend) {
  var i;

  for (i = 0; i < toAppend.length; i += 1) {
    array.push(toAppend[i]);
  }
}


/**
 * Get all documents in index whose key match value (if it is a Thing) or one of the elements of value (if it is an array of Things)
 * @param {Thing} value Value to match the key against
 * @return {Array of documents}
 */
Index.prototype.getMatching = function (value) {
  var res, self = this;

  if (!util.isArray(value)) {
    return this.tree.search(value);
  } else {
    res = [];
    value.forEach(function (v) { append(res, self.getMatching(v)); });
    return res;
  }
};


/**
 * Get all documents in index whose key is between bounds are they are defined by query
 * Documents are sorted by key
 * @param {Query} query
 * @return {Array of documents}
 */
Index.prototype.getBetweenBounds = function (query) {
  return this.tree.betweenBounds(query);
};


/**
 * Get all elements in the index
 * @return {Array of documents}
 */
Index.prototype.getAll = function () {
  var res = [];

  this.tree.executeOnEveryNode(function (node) {
    var i;

    for (i = 0; i < node.data.length; i += 1) {
      res.push(node.data[i]);
    }
  });

  return res;
};




// Interface
module.exports = Index;

},{"./model":82,"binary-search-tree":7,"underscore":85,"util":6}],82:[function(require,module,exports){
/**
 * Handle models (i.e. docs)
 * Serialization/deserialization
 * Copying
 * Querying, update
 */

var util = require('util')
  , _ = require('underscore')
  , modifierFunctions = {}
  , lastStepModifierFunctions = {}
  , comparisonFunctions = {}
  , logicalOperators = {}
  , arrayComparisonFunctions = {}
  ;


/**
 * Check a key, throw an error if the key is non valid
 * @param {String} k key
 * @param {Model} v value, needed to treat the Date edge case
 * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
 * Its serialized-then-deserialized version it will transformed into a Date object
 * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
 */
function checkKey (k, v) {
  if (k[0] === '$' && !(k === '$$date' && typeof v === 'number') && !(k === '$$deleted' && v === true) && !(k === '$$indexCreated') && !(k === '$$indexRemoved')) {
    throw 'Field names cannot begin with the $ character';
  }

  if (k.indexOf('.') !== -1) {
    throw 'Field names cannot contain a .';
  }
}


/**
 * Check a DB object and throw an error if it's not valid
 * Works by applying the above checkKey function to all fields recursively
 */
function checkObject (obj) {
  if (util.isArray(obj)) {
    obj.forEach(function (o) {
      checkObject(o);
    });
  }

  if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach(function (k) {
      checkKey(k, obj[k]);
      checkObject(obj[k]);
    });
  }
}


/**
 * Serialize an object to be persisted to a one-line string
 * For serialization/deserialization, we use the native JSON parser and not eval or Function
 * That gives us less freedom but data entered in the database may come from users
 * so eval and the like are not safe
 * Accepted primitive types: Number, String, Boolean, Date, null
 * Accepted secondary types: Objects, Arrays
 */
function serialize (obj) {
  var res;
  
  res = JSON.stringify(obj, function (k, v) {
    checkKey(k, v);
    
    if (v === undefined) { return undefined; }
    if (v === null) { return null; }

    // Hackish way of checking if object is Date (this way it works between execution contexts in node-webkit).
    // We can't use value directly because for dates it is already string in this function (date.toJSON was already called), so we use this
    if (typeof this[k].getTime === 'function') { return { $$date: this[k].getTime() }; }

    return v;
  });

  return res;
}


/**
 * From a one-line representation of an object generate by the serialize function
 * Return the object itself
 */
function deserialize (rawData) {
  return JSON.parse(rawData, function (k, v) {
    if (k === '$$date') { return new Date(v); }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) { return v; }
    if (v && v.$$date) { return v.$$date; }

    return v;
  });
}


/**
 * Deep copy a DB object
 * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
 * where the keys are valid, i.e. don't begin with $ and don't contain a .
 */
function deepCopy (obj, strictKeys) {
  var res;

  if ( typeof obj === 'boolean' ||
       typeof obj === 'number' ||
       typeof obj === 'string' ||
       obj === null ||
       (util.isDate(obj)) ) {
    return obj;
  }

  if (util.isArray(obj)) {
    res = [];
    obj.forEach(function (o) { res.push(deepCopy(o, strictKeys)); });
    return res;
  }

  if (typeof obj === 'object') {
    res = {};
    Object.keys(obj).forEach(function (k) {
      if (!strictKeys || (k[0] !== '$' && k.indexOf('.') === -1)) {
        res[k] = deepCopy(obj[k], strictKeys);
      }
    });
    return res;
  }

  return undefined;   // For now everything else is undefined. We should probably throw an error instead
}


/**
 * Tells if an object is a primitive type or a "real" object
 * Arrays are considered primitive
 */
function isPrimitiveType (obj) {
  return ( typeof obj === 'boolean' ||
       typeof obj === 'number' ||
       typeof obj === 'string' ||
       obj === null ||
       util.isDate(obj) ||
       util.isArray(obj));
}


/**
 * Utility functions for comparing things
 * Assumes type checking was already done (a and b already have the same type)
 * compareNSB works for numbers, strings and booleans
 */
function compareNSB (a, b) {
  if (a < b) { return -1; }
  if (a > b) { return 1; }
  return 0;
}

function compareArrays (a, b) {
  var i, comp;

  for (i = 0; i < Math.min(a.length, b.length); i += 1) {
    comp = compareThings(a[i], b[i]);

    if (comp !== 0) { return comp; }
  }

  // Common section was identical, longest one wins
  return compareNSB(a.length, b.length);
}


/**
 * Compare { things U undefined }
 * Things are defined as any native types (string, number, boolean, null, date) and objects
 * We need to compare with undefined as it will be used in indexes
 * In the case of objects and arrays, we deep-compare
 * If two objects dont have the same type, the (arbitrary) type hierarchy is: undefined, null, number, strings, boolean, dates, arrays, objects
 * Return -1 if a < b, 1 if a > b and 0 if a = b (note that equality here is NOT the same as defined in areThingsEqual!)
 */
function compareThings (a, b) {
  var aKeys, bKeys, comp, i;

  // undefined
  if (a === undefined) { return b === undefined ? 0 : -1; }
  if (b === undefined) { return a === undefined ? 0 : 1; }

  // null
  if (a === null) { return b === null ? 0 : -1; }
  if (b === null) { return a === null ? 0 : 1; }

  // Numbers
  if (typeof a === 'number') { return typeof b === 'number' ? compareNSB(a, b) : -1; }
  if (typeof b === 'number') { return typeof a === 'number' ? compareNSB(a, b) : 1; }

  // Strings
  if (typeof a === 'string') { return typeof b === 'string' ? compareNSB(a, b) : -1; }
  if (typeof b === 'string') { return typeof a === 'string' ? compareNSB(a, b) : 1; }

  // Booleans
  if (typeof a === 'boolean') { return typeof b === 'boolean' ? compareNSB(a, b) : -1; }
  if (typeof b === 'boolean') { return typeof a === 'boolean' ? compareNSB(a, b) : 1; }

  // Dates
  if (util.isDate(a)) { return util.isDate(b) ? compareNSB(a.getTime(), b.getTime()) : -1; }
  if (util.isDate(b)) { return util.isDate(a) ? compareNSB(a.getTime(), b.getTime()) : 1; }

  // Arrays (first element is most significant and so on)
  if (util.isArray(a)) { return util.isArray(b) ? compareArrays(a, b) : -1; }
  if (util.isArray(b)) { return util.isArray(a) ? compareArrays(a, b) : 1; }

  // Objects
  aKeys = Object.keys(a).sort();
  bKeys = Object.keys(b).sort();

  for (i = 0; i < Math.min(aKeys.length, bKeys.length); i += 1) {
    comp = compareThings(a[aKeys[i]], b[bKeys[i]]);

    if (comp !== 0) { return comp; }
  }

  return compareNSB(aKeys.length, bKeys.length);
}



// ==============================================================
// Updating documents
// ==============================================================

/**
 * The signature of modifier functions is as follows
 * Their structure is always the same: recursively follow the dot notation while creating
 * the nested documents if needed, then apply the "last step modifier"
 * @param {Object} obj The model to modify
 * @param {String} field Can contain dots, in that case that means we will set a subfield recursively
 * @param {Model} value
 */

/**
 * Set a field to a new value
 */
lastStepModifierFunctions.$set = function (obj, field, value) {
  obj[field] = value;
};


/**
 * Unset a field
 */
lastStepModifierFunctions.$unset = function (obj, field, value) {
  delete obj[field];
};


/**
 * Push an element to the end of an array field
 */
lastStepModifierFunctions.$push = function (obj, field, value) {
  // Create the array if it doesn't exist
  if (!obj.hasOwnProperty(field)) { obj[field] = []; }

  if (!util.isArray(obj[field])) { throw "Can't $push an element on non-array values"; }

  if (value !== null && typeof value === 'object' && value.$each) {
    if (Object.keys(value).length > 1) { throw "Can't use another field in conjunction with $each"; }
    if (!util.isArray(value.$each)) { throw "$each requires an array value"; }

    value.$each.forEach(function (v) {
      obj[field].push(v);
    });
  } else {
    obj[field].push(value);
  }
};


/**
 * Add an element to an array field only if it is not already in it
 * No modification if the element is already in the array
 * Note that it doesn't check whether the original array contains duplicates
 */
lastStepModifierFunctions.$addToSet = function (obj, field, value) {
  var addToSet = true;

  // Create the array if it doesn't exist
  if (!obj.hasOwnProperty(field)) { obj[field] = []; }

  if (!util.isArray(obj[field])) { throw "Can't $addToSet an element on non-array values"; }

  if (value !== null && typeof value === 'object' && value.$each) {
    if (Object.keys(value).length > 1) { throw "Can't use another field in conjunction with $each"; }
    if (!util.isArray(value.$each)) { throw "$each requires an array value"; }

    value.$each.forEach(function (v) {
      lastStepModifierFunctions.$addToSet(obj, field, v);
    });
  } else {
    obj[field].forEach(function (v) {
      if (compareThings(v, value) === 0) { addToSet = false; }
    });
    if (addToSet) { obj[field].push(value); }
  }
};


/**
 * Remove the first or last element of an array
 */
lastStepModifierFunctions.$pop = function (obj, field, value) {
  if (!util.isArray(obj[field])) { throw "Can't $pop an element from non-array values"; }
  if (typeof value !== 'number') { throw value + " isn't an integer, can't use it with $pop"; }
  if (value === 0) { return; }

  if (value > 0) {
    obj[field] = obj[field].slice(0, obj[field].length - 1);
  } else {
    obj[field] = obj[field].slice(1);
  }
};


/**
 * Removes all instances of a value from an existing array
 */
lastStepModifierFunctions.$pull = function (obj, field, value) {
  var arr, i;
  
  if (!util.isArray(obj[field])) { throw "Can't $pull an element from non-array values"; }

  arr = obj[field];
  for (i = arr.length - 1; i >= 0; i -= 1) {
    if (match(arr[i], value)) {
      arr.splice(i, 1);
    }
  }
};


/**
 * Increment a numeric field's value
 */
lastStepModifierFunctions.$inc = function (obj, field, value) {
  if (typeof value !== 'number') { throw value + " must be a number"; }

  if (typeof obj[field] !== 'number') {
    if (!_.has(obj, field)) {
      obj[field] = value;
    } else {
      throw "Don't use the $inc modifier on non-number fields";
    }
  } else {
    obj[field] += value;
  }
};

// Given its name, create the complete modifier function
function createModifierFunction (modifier) {
  return function (obj, field, value) {
    var fieldParts = typeof field === 'string' ? field.split('.') : field;

    if (fieldParts.length === 1) {
      lastStepModifierFunctions[modifier](obj, field, value);
    } else {
      obj[fieldParts[0]] = obj[fieldParts[0]] || {};
      modifierFunctions[modifier](obj[fieldParts[0]], fieldParts.slice(1), value);
    }
  };
}

// Actually create all modifier functions
Object.keys(lastStepModifierFunctions).forEach(function (modifier) {
  modifierFunctions[modifier] = createModifierFunction(modifier);
});


/**
 * Modify a DB object according to an update query
 */
function modify (obj, updateQuery) {
  var keys = Object.keys(updateQuery)
    , firstChars = _.map(keys, function (item) { return item[0]; })
    , dollarFirstChars = _.filter(firstChars, function (c) { return c === '$'; })
    , newDoc, modifiers
    ;

  if (keys.indexOf('_id') !== -1 && updateQuery._id !== obj._id) { throw "You cannot change a document's _id"; }

  if (dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length) {
    throw "You cannot mix modifiers and normal fields";
  }

  if (dollarFirstChars.length === 0) {
    // Simply replace the object with the update query contents
    newDoc = deepCopy(updateQuery);
    newDoc._id = obj._id;
  } else {
    // Apply modifiers
    modifiers = _.uniq(keys);
    newDoc = deepCopy(obj);
    modifiers.forEach(function (m) {
      var keys;

      if (!modifierFunctions[m]) { throw "Unknown modifier " + m; }

      try {
        keys = Object.keys(updateQuery[m]);
      } catch (e) {
        throw "Modifier " + m + "'s argument must be an object";
      }

      keys.forEach(function (k) {
        modifierFunctions[m](newDoc, k, updateQuery[m][k]);
      });
    });
  }

  // Check result is valid and return it
  checkObject(newDoc);
  
  if (obj._id !== newDoc._id) { throw "You can't change a document's _id"; }
  return newDoc;
};


// ==============================================================
// Finding documents
// ==============================================================

/**
 * Get a value from object with dot notation
 * @param {Object} obj
 * @param {String} field
 */
function getDotValue (obj, field) {
  var fieldParts = typeof field === 'string' ? field.split('.') : field
    , i, objs;

  if (!obj) { return undefined; }   // field cannot be empty so that means we should return undefined so that nothing can match

  if (fieldParts.length === 0) { return obj; }

  if (fieldParts.length === 1) { return obj[fieldParts[0]]; }
  
  if (util.isArray(obj[fieldParts[0]])) {
    // If the next field is an integer, return only this item of the array
    i = parseInt(fieldParts[1], 10);
    if (typeof i === 'number' && !isNaN(i)) {
      return getDotValue(obj[fieldParts[0]][i], fieldParts.slice(2))
    }

    // Return the array of values
    objs = new Array();
    for (i = 0; i < obj[fieldParts[0]].length; i += 1) {
       objs.push(getDotValue(obj[fieldParts[0]][i], fieldParts.slice(1)));
    }
    return objs;
  } else {
    return getDotValue(obj[fieldParts[0]], fieldParts.slice(1));
  }
}


/**
 * Check whether 'things' are equal
 * Things are defined as any native types (string, number, boolean, null, date) and objects
 * In the case of object, we check deep equality
 * Returns true if they are, false otherwise
 */
function areThingsEqual (a, b) {
  var aKeys , bKeys , i;

  // Strings, booleans, numbers, null
  if (a === null || typeof a === 'string' || typeof a === 'boolean' || typeof a === 'number' ||
      b === null || typeof b === 'string' || typeof b === 'boolean' || typeof b === 'number') { return a === b; }

  // Dates
  if (util.isDate(a) || util.isDate(b)) { return util.isDate(a) && util.isDate(b) && a.getTime() === b.getTime(); }

  // Arrays (no match since arrays are used as a $in)
  // undefined (no match since they mean field doesn't exist and can't be serialized)
  if (util.isArray(a) || util.isArray(b) || a === undefined || b === undefined) { return false; }

  // General objects (check for deep equality)
  // a and b should be objects at this point
  try {
    aKeys = Object.keys(a);
    bKeys = Object.keys(b);
  } catch (e) {
    return false;
  }

  if (aKeys.length !== bKeys.length) { return false; }
  for (i = 0; i < aKeys.length; i += 1) {
    if (bKeys.indexOf(aKeys[i]) === -1) { return false; }
    if (!areThingsEqual(a[aKeys[i]], b[aKeys[i]])) { return false; }
  }
  return true;
}


/**
 * Check that two values are comparable
 */
function areComparable (a, b) {
  if (typeof a !== 'string' && typeof a !== 'number' && !util.isDate(a) &&
      typeof b !== 'string' && typeof b !== 'number' && !util.isDate(b)) {
    return false;
  }

  if (typeof a !== typeof b) { return false; }

  return true;
}


/**
 * Arithmetic and comparison operators
 * @param {Native value} a Value in the object
 * @param {Native value} b Value in the query
 */
comparisonFunctions.$lt = function (a, b) {
  return areComparable(a, b) && a < b;
};

comparisonFunctions.$lte = function (a, b) {
  return areComparable(a, b) && a <= b;
};

comparisonFunctions.$gt = function (a, b) {
  return areComparable(a, b) && a > b;
};

comparisonFunctions.$gte = function (a, b) {
  return areComparable(a, b) && a >= b;
};

comparisonFunctions.$ne = function (a, b) {
  if (a === undefined) { return true; }
  return !areThingsEqual(a, b);
};

comparisonFunctions.$in = function (a, b) {
  var i;

  if (!util.isArray(b)) { throw "$in operator called with a non-array"; }

  for (i = 0; i < b.length; i += 1) {
    if (areThingsEqual(a, b[i])) { return true; }
  }

  return false;
};

comparisonFunctions.$nin = function (a, b) {
  if (!util.isArray(b)) { throw "$nin operator called with a non-array"; }

  return !comparisonFunctions.$in(a, b);
};

comparisonFunctions.$regex = function (a, b) {
  if (!util.isRegExp(b)) { throw "$regex operator called with non regular expression"; }

  if (typeof a !== 'string') {
    return false
  } else {
    return b.test(a);
  }
};

comparisonFunctions.$exists = function (value, exists) {
  if (exists || exists === '') {   // This will be true for all values of exists except false, null, undefined and 0
    exists = true;                 // That's strange behaviour (we should only use true/false) but that's the way Mongo does it...
  } else {
    exists = false;
  }

  if (value === undefined) {
    return !exists
  } else {
    return exists;
  }
};

// Specific to arrays
comparisonFunctions.$size = function (obj, value) {
    if (!util.isArray(obj)) { return false; }
    if (value % 1 !== 0) { throw "$size operator called without an integer"; }

    return (obj.length == value);
};
arrayComparisonFunctions.$size = true;


/**
 * Match any of the subqueries
 * @param {Model} obj
 * @param {Array of Queries} query
 */
logicalOperators.$or = function (obj, query) {
  var i;

  if (!util.isArray(query)) { throw "$or operator used without an array"; }

  for (i = 0; i < query.length; i += 1) {
    if (match(obj, query[i])) { return true; }
  }

  return false;
};


/**
 * Match all of the subqueries
 * @param {Model} obj
 * @param {Array of Queries} query
 */
logicalOperators.$and = function (obj, query) {
  var i;

  if (!util.isArray(query)) { throw "$and operator used without an array"; }

  for (i = 0; i < query.length; i += 1) {
    if (!match(obj, query[i])) { return false; }
  }

  return true;
};


/**
 * Inverted match of the query
 * @param {Model} obj
 * @param {Query} query
 */
logicalOperators.$not = function (obj, query) {
  return !match(obj, query);
};


/**
 * Use a function to match
 * @param {Model} obj
 * @param {Query} query
 */
logicalOperators.$where = function (obj, fn) {
  var result;

  if (!_.isFunction(fn)) { throw "$where operator used without a function"; }

  result = fn.call(obj);
  if (!_.isBoolean(result)) { throw "$where function must return boolean"; }

  return result;
};


/**
 * Tell if a given document matches a query
 * @param {Object} obj Document to check
 * @param {Object} query
 */
function match (obj, query) {
  var queryKeys, queryKey, queryValue, i;

  // Primitive query against a primitive type
  // This is a bit of a hack since we construct an object with an arbitrary key only to dereference it later
  // But I don't have time for a cleaner implementation now
  if (isPrimitiveType(obj) || isPrimitiveType(query)) {
    return matchQueryPart({ needAKey: obj }, 'needAKey', query);
  }
    
  // Normal query
  queryKeys = Object.keys(query);
  for (i = 0; i < queryKeys.length; i += 1) {
    queryKey = queryKeys[i];
    queryValue = query[queryKey];
  
    if (queryKey[0] === '$') {
      if (!logicalOperators[queryKey]) { throw "Unknown logical operator " + queryKey; }
      if (!logicalOperators[queryKey](obj, queryValue)) { return false; }
    } else {
      if (!matchQueryPart(obj, queryKey, queryValue)) { return false; }
    }
  }

  return true;
};


/**
 * Match an object against a specific { key: value } part of a query
 * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
 */
function matchQueryPart (obj, queryKey, queryValue, treatObjAsValue) {
  var objValue = getDotValue(obj, queryKey)
    , i, keys, firstChars, dollarFirstChars;

  // Check if the value is an array if we don't force a treatment as value
  if (util.isArray(objValue) && !treatObjAsValue) {
    // Check if we are using an array-specific comparison function
    if (queryValue !== null && typeof queryValue === 'object' && !util.isRegExp(queryValue)) {
      keys = Object.keys(queryValue);      
      for (i = 0; i < keys.length; i += 1) {
        if (arrayComparisonFunctions[keys[i]]) { return matchQueryPart(obj, queryKey, queryValue, true); }
      }
    }

    // If not, treat it as an array of { obj, query } where there needs to be at least one match
    for (i = 0; i < objValue.length; i += 1) {
      if (matchQueryPart({ k: objValue[i] }, 'k', queryValue)) { return true; }   // k here could be any string
    }
    return false;
  }

  // queryValue is an actual object. Determine whether it contains comparison operators
  // or only normal fields. Mixed objects are not allowed
  if (queryValue !== null && typeof queryValue === 'object' && !util.isRegExp(queryValue)) {
    keys = Object.keys(queryValue);
    firstChars = _.map(keys, function (item) { return item[0]; });
    dollarFirstChars = _.filter(firstChars, function (c) { return c === '$'; });

    if (dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length) {
      throw "You cannot mix operators and normal fields";
    }

    // queryValue is an object of this form: { $comparisonOperator1: value1, ... }
    if (dollarFirstChars.length > 0) {
      for (i = 0; i < keys.length; i += 1) {
        if (!comparisonFunctions[keys[i]]) { throw "Unknown comparison function " + keys[i]; }

        if (!comparisonFunctions[keys[i]](objValue, queryValue[keys[i]])) { return false; }
      }
      return true;
    }
  }

  // Using regular expressions with basic querying
  if (util.isRegExp(queryValue)) { return comparisonFunctions.$regex(objValue, queryValue); }

  // queryValue is either a native value or a normal object
  // Basic matching is possible
  if (!areThingsEqual(objValue, queryValue)) { return false; }

  return true;
}


// Interface
module.exports.serialize = serialize;
module.exports.deserialize = deserialize;
module.exports.deepCopy = deepCopy;
module.exports.checkObject = checkObject;
module.exports.isPrimitiveType = isPrimitiveType;
module.exports.modify = modify;
module.exports.getDotValue = getDotValue;
module.exports.match = match;
module.exports.areThingsEqual = areThingsEqual;
module.exports.compareThings = compareThings;

},{"underscore":85,"util":6}],83:[function(require,module,exports){
(function (process){
/**
 * Handle every persistence-related task
 * The interface Datastore expects to be implemented is
 * * Persistence.loadDatabase(callback) and callback has signature err
 * * Persistence.persistNewState(newDocs, callback) where newDocs is an array of documents and callback has signature err
 */

var storage = require('./storage')
  , path = require('path')
  , model = require('./model')
  , async = require('async')
  , customUtils = require('./customUtils')
  , Index = require('./indexes')
  ;


/**
 * Create a new Persistence object for database options.db
 * @param {Datastore} options.db
 * @param {Boolean} options.nodeWebkitAppName Optional, specify the name of your NW app if you want options.filename to be relative to the directory where
 *                                            Node Webkit stores application data such as cookies and local storage (the best place to store data in my opinion)
 */
function Persistence (options) {
  var i, j, randomString;
  
  this.db = options.db;
  this.inMemoryOnly = this.db.inMemoryOnly;
  this.filename = this.db.filename;
  this.corruptAlertThreshold = options.corruptAlertThreshold !== undefined ? options.corruptAlertThreshold : 0.1;
  
  if (!this.inMemoryOnly && this.filename) {
    if (this.filename.charAt(this.filename.length - 1) === '~') {
      throw "The datafile name can't end with a ~, which is reserved for automatic backup files";
    } else {
      this.tempFilename = this.filename + '~';
      this.oldFilename = this.filename + '~~';
    }
  }

  // After serialization and before deserialization hooks with some basic sanity checks
  if (options.afterSerialization && !options.beforeDeserialization) {
    throw "Serialization hook defined but deserialization hook undefined, cautiously refusing to start NeDB to prevent dataloss";
  }
  if (!options.afterSerialization && options.beforeDeserialization) {
    throw "Serialization hook undefined but deserialization hook defined, cautiously refusing to start NeDB to prevent dataloss";
  }
  this.afterSerialization = options.afterSerialization || function (s) { return s; };
  this.beforeDeserialization = options.beforeDeserialization || function (s) { return s; };
  for (i = 1; i < 30; i += 1) {
    for (j = 0; j < 10; j += 1) {
      randomString = customUtils.uid(i);
      if (this.beforeDeserialization(this.afterSerialization(randomString)) !== randomString) {
        throw "beforeDeserialization is not the reverse of afterSerialization, cautiously refusing to start NeDB to prevent dataloss";
      }
    }
  }
  
  // For NW apps, store data in the same directory where NW stores application data
  if (this.filename && options.nodeWebkitAppName) {
    console.log("==================================================================");
    console.log("WARNING: The nodeWebkitAppName option is deprecated");
    console.log("To get the path to the directory where Node Webkit stores the data");
    console.log("for your app, use the internal nw.gui module like this");
    console.log("require('nw.gui').App.dataPath");
    console.log("See https://github.com/rogerwang/node-webkit/issues/500");
    console.log("==================================================================");
    this.filename = Persistence.getNWAppFilename(options.nodeWebkitAppName, this.filename);
    this.tempFilename = Persistence.getNWAppFilename(options.nodeWebkitAppName, this.tempFilename);
    this.oldFilename = Persistence.getNWAppFilename(options.nodeWebkitAppName, this.oldFilename);
  }
};


/**
 * Check if a directory exists and create it on the fly if it is not the case
 * cb is optional, signature: err
 */
Persistence.ensureDirectoryExists = function (dir, cb) {
  var callback = cb || function () {}
    ;

  storage.mkdirp(dir, function (err) { return callback(err); });
};


Persistence.ensureFileDoesntExist = function (file, callback) {
  storage.exists(file, function (exists) {
    if (!exists) { return callback(null); }
    
    storage.unlink(file, function (err) { return callback(err); });
  });
};


/**
 * Return the path the datafile if the given filename is relative to the directory where Node Webkit stores
 * data for this application. Probably the best place to store data
 */
Persistence.getNWAppFilename = function (appName, relativeFilename) {
  var home;

  switch (process.platform) {
    case 'win32':
    case 'win64':
      home = process.env.LOCALAPPDATA || process.env.APPDATA;
      if (!home) { throw "Couldn't find the base application data folder"; }
      home = path.join(home, appName);
      break;
    case 'darwin':
      home = process.env.HOME;
      if (!home) { throw "Couldn't find the base application data directory"; }
      home = path.join(home, 'Library', 'Application Support', appName);
      break;
    case 'linux':
      home = process.env.HOME;
      if (!home) { throw "Couldn't find the base application data directory"; }
      home = path.join(home, '.config', appName);
      break;
    default:
      throw "Can't use the Node Webkit relative path for platform " + process.platform;
      break;
  }

  return path.join(home, 'nedb-data', relativeFilename);
}


/**
 * Persist cached database
 * This serves as a compaction function since the cache always contains only the number of documents in the collection
 * while the data file is append-only so it may grow larger
 * @param {Function} cb Optional callback, signature: err
 */
Persistence.prototype.persistCachedDatabase = function (cb) {
  var callback = cb || function () {}
    , toPersist = ''
    , self = this
    ;

  if (this.inMemoryOnly) { return callback(null); } 

  this.db.getAllData().forEach(function (doc) {
    toPersist += self.afterSerialization(model.serialize(doc)) + '\n';
  });
  Object.keys(this.db.indexes).forEach(function (fieldName) {
    if (fieldName != "_id") {   // The special _id index is managed by datastore.js, the others need to be persisted
      toPersist += self.afterSerialization(model.serialize({ $$indexCreated: { fieldName: fieldName, unique: self.db.indexes[fieldName].unique, sparse: self.db.indexes[fieldName].sparse }})) + '\n';
    }
  });

  async.waterfall([
    async.apply(Persistence.ensureFileDoesntExist, self.tempFilename)
  , async.apply(Persistence.ensureFileDoesntExist, self.oldFilename)
  , function (cb) {
      storage.exists(self.filename, function (exists) {
        if (exists) {
          storage.rename(self.filename, self.oldFilename, function (err) { return cb(err); });
        } else {
          return cb();
        }
      });  
  }
  , function (cb) {
      storage.writeFile(self.tempFilename, toPersist, function (err) { return cb(err); });
    }
  , function (cb) {
      storage.rename(self.tempFilename, self.filename, function (err) { return cb(err); });
    }
  , async.apply(Persistence.ensureFileDoesntExist, self.oldFilename)
  ], function (err) { if (err) { return callback(err); } else { return callback(null); } })
};


/**
 * Queue a rewrite of the datafile
 */
Persistence.prototype.compactDatafile = function () {
  this.db.executor.push({ this: this, fn: this.persistCachedDatabase, arguments: [] });
};


/**
 * Set automatic compaction every interval ms
 * @param {Number} interval in milliseconds, with an enforced minimum of 5 seconds
 */
Persistence.prototype.setAutocompactionInterval = function (interval) {
  var self = this
    , minInterval = 5000
    , realInterval = Math.max(interval || 0, minInterval)
    ;

  this.stopAutocompaction();

  this.autocompactionIntervalId = setInterval(function () {
    self.compactDatafile();
  }, realInterval);
};


/**
 * Stop autocompaction (do nothing if autocompaction was not running)
 */
Persistence.prototype.stopAutocompaction = function () {
  if (this.autocompactionIntervalId) { clearInterval(this.autocompactionIntervalId); }
};


/**
 * Persist new state for the given newDocs (can be insertion, update or removal)
 * Use an append-only format
 * @param {Array} newDocs Can be empty if no doc was updated/removed
 * @param {Function} cb Optional, signature: err
 */
Persistence.prototype.persistNewState = function (newDocs, cb) {
  var self = this
    , toPersist = ''
    , callback = cb || function () {}
    ;

  // In-memory only datastore
  if (self.inMemoryOnly) { return callback(null); }

  newDocs.forEach(function (doc) {
    toPersist += self.afterSerialization(model.serialize(doc)) + '\n';
  });

  if (toPersist.length === 0) { return callback(null); }

  storage.appendFile(self.filename, toPersist, 'utf8', function (err) {
    return callback(err);
  });
};


/**
 * From a database's raw data, return the corresponding
 * machine understandable collection
 */
Persistence.prototype.treatRawData = function (rawData) {
  var data = rawData.split('\n')
    , dataById = {}
    , tdata = []
    , i
    , indexes = {}
    , corruptItems = -1   // Last line of every data file is usually blank so not really corrupt
    ;
    
  for (i = 0; i < data.length; i += 1) {
    var doc;
    
    try {
      doc = model.deserialize(this.beforeDeserialization(data[i]));
      if (doc._id) {
        if (doc.$$deleted === true) {
          delete dataById[doc._id];
        } else {
          dataById[doc._id] = doc;
        }
      } else if (doc.$$indexCreated && doc.$$indexCreated.fieldName != undefined) {
        indexes[doc.$$indexCreated.fieldName] = doc.$$indexCreated;
      } else if (typeof doc.$$indexRemoved === "string") {
        delete indexes[doc.$$indexRemoved];
      }
    } catch (e) {
      corruptItems += 1;
    }
  }
    
  // A bit lenient on corruption
  if (data.length > 0 && corruptItems / data.length > this.corruptAlertThreshold) {
    throw "More than 10% of the data file is corrupt, the wrong beforeDeserialization hook may be used. Cautiously refusing to start NeDB to prevent dataloss"
  }

  Object.keys(dataById).forEach(function (k) {
    tdata.push(dataById[k]);
  });

  return { data: tdata, indexes: indexes };
};


/**
 * Ensure that this.filename contains the most up-to-date version of the data
 * Even if a loadDatabase crashed before
 */
Persistence.prototype.ensureDatafileIntegrity = function (callback) {
  var self = this  ;

  storage.exists(self.filename, function (filenameExists) {
    // Write was successful
    if (filenameExists) { return callback(null); }
  
    storage.exists(self.oldFilename, function (oldFilenameExists) {
      // New database
      if (!oldFilenameExists) {
        return storage.writeFile(self.filename, '', 'utf8', function (err) { callback(err); });            
      }
    
      // Write failed, use old version
      storage.rename(self.oldFilename, self.filename, function (err) { return callback(err); });
    });
  });
};


/**
 * Load the database
 * 1) Create all indexes
 * 2) Insert all data
 * 3) Compact the database
 * This means pulling data out of the data file or creating it if it doesn't exist
 * Also, all data is persisted right away, which has the effect of compacting the database file
 * This operation is very quick at startup for a big collection (60ms for ~10k docs)
 * @param {Function} cb Optional callback, signature: err
 */
Persistence.prototype.loadDatabase = function (cb) {
  var callback = cb || function () {}
    , self = this
    ;

  self.db.resetIndexes();

  // In-memory only datastore
  if (self.inMemoryOnly) { return callback(null); }

  async.waterfall([
    function (cb) {
      Persistence.ensureDirectoryExists(path.dirname(self.filename), function (err) {
        self.ensureDatafileIntegrity(function (exists) {
          storage.readFile(self.filename, 'utf8', function (err, rawData) {
            if (err) { return cb(err); }
            
            try {
              var treatedData = self.treatRawData(rawData);
            } catch (e) {
              return cb(e);
            }
            
            // Recreate all indexes in the datafile
            Object.keys(treatedData.indexes).forEach(function (key) {
              self.db.indexes[key] = new Index(treatedData.indexes[key]);
            });

            // Fill cached database (i.e. all indexes) with data
            try {
              self.db.resetIndexes(treatedData.data);
            } catch (e) {
              self.db.resetIndexes();   // Rollback any index which didn't fail
              return cb(e);
            }

            self.db.persistence.persistCachedDatabase(cb);
          });
        });
      });
    }
  ], function (err) {
       if (err) { return callback(err); }

       self.db.executor.processBuffer();
       return callback(null);
     });
};


// Interface
module.exports = Persistence;

}).call(this,require("z02cDi"))
},{"./customUtils":74,"./indexes":81,"./model":82,"./storage":75,"async":84,"path":3,"z02cDi":4}],84:[function(require,module,exports){
(function (process){
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                }
            }));
        });
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _each(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor !== Array) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (test()) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (!test()) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if(data.constructor !== Array) {
              data = [data];
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain) cargo.drain();
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.compose = function (/* functions... */) {
        var fns = Array.prototype.reverse.call(arguments);
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // AMD / RequireJS
    if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // Node.js
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require("z02cDi"))
},{"z02cDi":4}],85:[function(require,module,exports){
//     Underscore.js 1.4.4
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var push             = ArrayProto.push,
      slice            = ArrayProto.slice,
      concat           = ArrayProto.concat,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.4.4';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (_.has(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? null : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See: https://bugs.webkit.org/show_bug.cgi?id=80797
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        index : index,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index < right.index ? -1 : 1;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(obj, value, context, behavior) {
    var result = {};
    var iterator = lookupIterator(value || _.identity);
    each(obj, function(value, index) {
      var key = iterator.call(context, value, index, obj);
      behavior(result, key, value);
    });
    return result;
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key, value) {
      (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
    });
  };

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = function(obj, value, context) {
    return group(obj, value, context, function(result, key) {
      if (!_.has(result, key)) result[key] = 0;
      result[key]++;
    });
  };

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    each(input, function(value) {
      if (_.isArray(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(concat.apply(ArrayProto, arguments));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(args, "" + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, l = list.length; i < l; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, l = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    var args = slice.call(arguments, 2);
    return function() {
      return func.apply(context, args.concat(slice.call(arguments)));
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, result;
    var previous = 0;
    var later = function() {
      previous = new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      } else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) result = func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(context, args);
      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var values = [];
    for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var pairs = [];
    for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] == null) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent, but `Object`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                               _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
        return false;
      }
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(n);
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named property is a function then invoke it;
  // otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return null;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

}).call(this);

},{}],"0qV9wd":[function(require,module,exports){
var Loader = function() {

  // will be replaced with the json.
  this.dependencies = {"npm":{"nedb":"latest"}};
  //this.nodes = ;
  this.nodeDefinitions = {"https://serve-chix.rhcloud.com/nodes/{ns}/{name}":{"nedb":{"datastore":{"_id":"54bb1b39fa15e75e679fd1a4","name":"datastore","ns":"nedb","description":"Nedb Datastore","phrases":{"active":"Creating datastore"},"dependencies":{"npm":{"nedb":"latest"}},"ports":{"input":{"options":{"title":"Options","type":"object","required":false,"properties":{"filename":{"type":"string","description":"path to the file where the data is persisted. If left blank, the datastore is automatically considered in-memory only. It cannot end with a ~ which is used in the temporary files NeDB uses to perform crash-safe writes","required":false},"inMemoryOnly":{"Title":"In Memory only","type":"boolean","description":"In Memory Only","default":false},"onload":{"title":"Onload","type":"function","description":"if you use autoloading, this is the handler called after the loadDatabase. It takes one error argument. If you use autoloading without specifying this handler, and an error happens during load, an error will be thrown.","required":false},"afterSerialization":{"title":"After serialization","type":"function","description":"hook you can use to transform data after it was serialized and before it is written to disk. Can be used for example to encrypt data before writing database to disk. This function takes a string as parameter (one line of an NeDB data file) and outputs the transformed string, which must absolutely not contain a \n character (or data will be lost)","required":false},"beforeDeserialization":{"title":"Before Deserialization","type":"function","description":"reverse of afterSerialization. Make sure to include both and not just one or you risk data loss. For the same reason, make sure both functions are inverses of one another. Some failsafe mechanisms are in place to prevent data loss if you misuse the serialization hooks: NeDB checks that never one is declared without the other, and checks that they are reverse of one another by testing on random strings of various lengths. In addition, if too much data is detected as corrupt, NeDB will refuse to start as it could mean you're not using the deserialization hook corresponding to the serialization hook used before (see below)","required":false},"corruptAlertThreshold":{"type":"number","description":"between 0 and 1, defaults to 10%. NeDB will refuse to start if more than this percentage of the datafile is corrupt. 0 means you don't tolerate any corruption, 1 means you don't care","minValue":0,"maxValue":1,"required":false}}}},"output":{"db":{"title":"Database","type":"Datastore"},"error":{"title":"Error","type":"Error"}}},"fn":"output = function() {\n  var db = new nedb(input.options);\n  db.loadDatabase(function(err) {\n    if (err) {\n      output({error: err});\n    } else {\n      output({db: db});\n    }\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"insert":{"_id":"54bb1b39fa15e75e679fd1a5","name":"insert","ns":"nedb","description":"Insert a document into the database","async":true,"phrases":{"active":"Inserting document"},"ports":{"input":{"db":{"title":"Database","type":"Datastore"},"in":{"title":"Document","type":"object","async":true}},"output":{"out":{"title":"New Document","type":"object"},"error":{"title":"Error","type":"Error"}}},"fn":"on.input.in = function() {\n  input.db.insert(data, function(err, newDoc) {\n    if(err) {\n      output({error: err});\n    } else {\n      output({out: newDoc});\n    }\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"update":{"_id":"54bb2588fa15e75e679fd1a9","name":"update","ns":"nedb","description":"Update documents within the database","phrases":{"active":"Updating document(s)"},"ports":{"input":{"db":{"title":"Database","type":"Datastore"},"query":{"title":"Query","type":"object"},"update":{"title":"Query","description":"specifies how the documents should be modified. It is either a new document or a set of modifiers","type":"object"},"options":{"title":"Options","type":"object","properties":{"multi":{"title":"Multi","description":"allows the modification of several documents if set to true","type":"boolean","default":false},"upsert":{"title":"Upsert","description":"if you want to insert a new document corresponding to the update rules if your query doesn't match anything. If your update is a simple object with no modifiers, it is the inserted document. In the other case, the query is stripped from all operator recursively, and the update is applied to it.","type":"boolean","default":false}}}},"output":{"out":{"title":"New Document","type":"object"},"numReplaced":{"title":"Replaced","type":"number"},"error":{"title":"Error","type":"Error"}}},"fn":"output = function() {\n  input.db.update(input.query, input.update, input.options,\n    function(err, numReplaced, newDoc) {\n    if(err) {\n      output({error: err});\n    } else {\n      output({out: newDoc, numReplaced: numReplaced});\n    }\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"remove":{"_id":"54bb2588fa15e75e679fd1a7","name":"remove","ns":"nedb","description":"Remove documents from database","phrases":{"active":"Removing document(s)"},"ports":{"input":{"db":{"title":"Database","type":"Datastore"},"query":{"title":"Query","type":"object"},"options":{"title":"Options","type":"object","properties":{"multi":{"title":"Multi","description":"allows the removal of multiple documents if set to true","type":"boolean","default":false}}}},"output":{"out":{"title":"New Document","type":"object"},"numRemoved":{"title":"Removed","type":"number"},"error":{"title":"Error","type":"Error"}}},"fn":"output = function() {\n  input.db.remove(input.query, input.options,\n    function(err, numRemoved, newDoc) {\n    if(err) {\n      output({error: err});\n    } else {\n      output({out: newDoc, numRemoved: numRemoved});\n    }\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"find":{"_id":"54bb1b39fa15e75e679fd1a2","name":"find","ns":"nedb","description":"Find documents within the database","async":true,"phrases":{"active":"Finding document(s)"},"ports":{"input":{"db":{"title":"Database","type":"Datastore"},"in":{"title":"Document","type":"object","async":true}},"output":{"out":{"title":"New Document","type":"object"},"error":{"title":"Error","type":"Error"}}},"fn":"on.input.in = function() {\n  input.db.find(data, function(err, newDoc) {\n    if(err) {\n      output({error: err});\n    } else {\n      output({out: newDoc});\n    }\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"count":{"_id":"54bb1b39fa15e75e679fd1a1","name":"count","ns":"nedb","description":"Count documents within the database","async":true,"phrases":{"active":"Counting document(s)"},"ports":{"input":{"db":{"title":"Database","type":"Datastore"},"in":{"title":"Document","type":"object","async":true}},"output":{"out":{"title":"Count","type":"integer"},"error":{"title":"Error","type":"Error"}}},"fn":"on.input.in = function() {\n  input.db.count(data, function(err, newDoc) {\n    if(err) {\n      output({error: err});\n    } else {\n      output({out: newDoc});\n    }\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"console":{"log":{"_id":"52645993df5da0102500004e","name":"log","ns":"console","description":"Console log","async":true,"phrases":{"active":"Logging to console"},"ports":{"input":{"msg":{"type":"any","title":"Log message","description":"Logs a message to the console","async":true,"required":true}},"output":{"out":{"type":"any","title":"Log message"}}},"fn":"on.input.msg = function() {\n  console.log(data);\n  output( { out: data });\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}}};

};

Loader.prototype.hasNodeDefinition = function(nodeId) {

  return !!this.nodes[nodeId];

};

Loader.prototype.getNodeDefinition = function(node, map) {

  if (!this.nodeDefinitions[node.provider]) {

    // needed for subgraphs
    if (map.providers && map.providers[node.provider]) {
      node.provider = map.providers[node.provider].path ||
        map.providers[node.provider].url;
    } else if (map.providers && map.providers['@']) {
      node.provider = map.providers['@'].path ||
        map.providers['@'].url;
    } else {
      throw new Error('Node Provider not found for ' + node.name);
    }
  }

  return this.nodeDefinitions[node.provider][node.ns][node.name];

};

var Flow = require('chix-flow').Flow;
var loader = new Loader();

var map = {"type":"flow","nodes":[{"id":"Database","title":"Database","ns":"nedb","name":"datastore"},{"id":"Insert","title":"Insert","ns":"nedb","name":"insert"},{"id":"Update","title":"Update","ns":"nedb","name":"update"},{"id":"Remove","title":"Remove","ns":"nedb","name":"remove"},{"id":"Find","title":"Find","ns":"nedb","name":"find"},{"id":"Count","title":"Count","ns":"nedb","name":"count"},{"id":"Log","title":"Log","ns":"console","name":"log"},{"id":"Complete","title":"Complete","ns":"console","name":"log","context":{"msg":"complete!"}}],"links":[{"source":{"id":"Database","port":"db"},"target":{"id":"Insert","port":"db","setting":{"persist":true}},"metadata":{"title":"Database db -> db Insert"}},{"source":{"id":"Database","port":"db"},"target":{"id":"Find","port":"db","setting":{"persist":true}},"metadata":{"title":"Database db -> db Find"}},{"source":{"id":"Database","port":"db"},"target":{"id":"Count","port":"db","setting":{"persist":true}},"metadata":{"title":"Database db -> db Count"}},{"source":{"id":"Database","port":"error"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Database error -> msg Log"}},{"source":{"id":"Insert","port":"error"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Insert error -> msg Log"}},{"source":{"id":"Find","port":"error"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Find error -> msg Log"}},{"source":{"id":"Count","port":"error"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Count error -> msg Log"}},{"source":{"id":"Insert","port":"out"},"target":{"id":"Find","port":":start"},"metadata":{"title":"Insert out -> :start Find"}},{"source":{"id":"Find","port":"out"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Find out -> msg Log"}}],"title":"Test database","ns":"nedb","name":"app","id":"TestDataBase","providers":{"@":{"url":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}};

var actor;
window.Actor = actor = Flow.create(map, loader);

var monitor = require('chix-monitor-npmlog').Actor;
monitor(console, actor);

function onDeviceReady() {
actor.run();
actor.push();
actor.sendIIPs([{"source":{"id":"TestDataBase","port":":iip"},"target":{"id":"Insert","port":"in"},"metadata":{"title":"Test database :iip -> in Insert"},"data":{"uname":"rhalff","first":"Rob","last":"Halff"}},{"source":{"id":"TestDataBase","port":":iip"},"target":{"id":"Find","port":"in","setting":{"index":"uname"}},"metadata":{"title":"Test database :iip -> in Find"},"data":"rhalff"}]);

};

if (navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|IEMobile)/)) {
  document.addEventListener("deviceready", onDeviceReady, false);
} else {
  document.addEventListener("DOMContentLoaded" , onDeviceReady); //this is the browser
}

// for entry it doesn't really matter what is the module.
// as long as this module is loaded.
module.exports = actor;

},{"chix-flow":"/+Mzp9","chix-monitor-npmlog":"urJme/"}],"app":[function(require,module,exports){
module.exports=require('0qV9wd');
},{}]},{},["0qV9wd"])