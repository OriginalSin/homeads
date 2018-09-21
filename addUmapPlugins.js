var plugins = "test";
//console.log('testme');

/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   4.1.0+f046478d
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === GET_THEN_ERROR) {
      reject(promise, GET_THEN_ERROR.error);
      GET_THEN_ERROR.error = null;
    } else if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value.error = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      resolve(promise, value);
    } else if (failed) {
      reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator$1(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate(input);
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

Enumerator$1.prototype._enumerate = function (input) {
  for (var i = 0; this._state === PENDING && i < input.length; i++) {
    this._eachEntry(input[i], i);
  }
};

Enumerator$1.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$1 = c.resolve;

  if (resolve$$1 === resolve$1) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise$3) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$1) {
        return resolve$$1(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$1(entry), i);
  }
};

Enumerator$1.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator$1.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all$1(entries) {
  return new Enumerator$1(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race$1(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise$3(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise$3 ? initializePromise(this, resolver) : needsNew();
  }
}

Promise$3.all = all$1;
Promise$3.race = race$1;
Promise$3.resolve = resolve$1;
Promise$3.reject = reject$1;
Promise$3._setScheduler = setScheduler;
Promise$3._setAsap = setAsap;
Promise$3._asap = asap;

Promise$3.prototype = {
  constructor: Promise$3,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

/*global self*/
function polyfill$1() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise$3;
}

// Strange compat..
Promise$3.polyfill = polyfill$1;
Promise$3.Promise = Promise$3;

Promise$3.polyfill();

return Promise$3;

})));



(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ')
    preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status === undefined ? 200 : options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

/**
* @name L.gmxUtil
* @namespace
*/
var gmxAPIutils = {
    lastMapId: 0,
	debug: /\bdebug=1\b/.test(location.search),
	fromWebMercY: function(y) {
		return 90 * (4 * Math.atan(Math.exp(y / gmxAPIutils.rMajor)) / Math.PI - 1);
	},

    newId: function()
    {
        gmxAPIutils.lastMapId += 1;
        return '_' + gmxAPIutils.lastMapId;
    },

    uniqueGlobalName: function(thing) {
        var id = gmxAPIutils.newId();
        window[id] = thing;
        return id;
    },

    _apiLoadedFrom: null,
    apiLoadedFrom: function(scr) {
		if (gmxAPIutils._apiLoadedFrom === null) {
			var str = document.currentScript ? document.currentScript.src : gmxAPIutils._searchApiScriptUrl(scr);
			gmxAPIutils._apiLoadedFrom = str ? str.substring(0, str.lastIndexOf('/')) : '';
		}
		return gmxAPIutils._apiLoadedFrom;
	},
    _searchApiScriptUrl: function(scr) {
		var scriptRegexp = scr ? [
			new RegExp('\b'+ scr + '\b')
		] : [
			/\bleaflet-geomixer(-\w*)?\.js\b/,
			/\bgeomixer(-\w*)?\.js\b/
		];

        var scripts = document.getElementsByTagName('script');
        for (var i = 0, len = scripts.length; i < len; i++) {
            var src = scripts[i].getAttribute('src');
			for (var j = 0, len1 = scriptRegexp.length; j < len1; j++) {
				if (scriptRegexp[j].exec(src)) {
					gmxAPIutils._apiLoadedFrom = src.split('?')[0];
					break;
				}
            }
			if (gmxAPIutils._apiLoadedFrom) {
				break;
			}
        }
        return gmxAPIutils._apiLoadedFrom || '';
    },
    searchScriptAPIKey: function() {
		for (var i = 0, params = gmxAPIutils._searchApiScriptUrl(), len = params.length; i < len; i++) {
			var parsedParam = params[i].split('=');
			if (parsedParam[0] === 'key') {
				return parsedParam[1];
			}
		}
        return '';
    },

    createWorker: function(url)	{		// Создание Worker-а
        return new Promise(function(resolve, reject) {
			if ('createImageBitmap' in window && 'Worker' in window) {
				if (url.indexOf(location.origin) === 0) {
					resolve(new Worker(url));
				} else {
					fetch(url, {mode: 'cors'})
					.then(function(resp) { return resp.blob(); })
					.then(function(blob) {
						resolve(new Worker(window.URL.createObjectURL(blob, {type: 'application/javascript; charset=utf-8'})));
					});
				}
			} else {
				reject({error: 'Browser don`t support `createImageBitmap` or `Worker`'});
			}
		});
    },

    isPageHidden: function()	{		// Видимость окна браузера
        return document.hidden || document.msHidden || document.webkitHidden || document.mozHidden || false;
    },

    normalizeHostname: function(hostName) {
        var parsedHost = L.gmxUtil.parseUri((hostName.substr(0, 4) !== 'http' ? L.gmxUtil.protocol + '//' : '') + hostName); // Bug in gmxAPIutils.parseUri for 'localhost:8000'

        hostName = parsedHost.host + parsedHost.directory;

        if (hostName[hostName.length - 1] === '/') {
            hostName = hostName.substring(0, hostName.length - 1);
        }

        return hostName;
    },

	getLayerItemFromServer: function(options) {
        var query = options.query ? options.query : '[' + options.field + ']=' + options.value,
			kosmosnimkiURL = L.gmxUtil.protocol + '//maps.kosmosnimki.ru/',
            req = {
                WrapStyle: 'func',
                geometry: true,
                layer: options.layerID,
                query: query
            };
        if (options.border) { req.border = options.border; }
        return gmxAPIutils.requestJSONP(
            options.url || (window.serverBase || kosmosnimkiURL) + 'VectorLayer/Search.ashx',
            req,
            options
        );
    },

	getCadastreFeatures: function(options) {
		// example: L.gmxUtil.getCadastreFeatures({latlng: L.latLng(48.350039, 45.152757), callbackParamName: 'callback'});
        if (options.latlng) {
			var latlng = options.latlng,
				req = {
					WrapStyle: 'func',
					text: (latlng.lat + ' ' + latlng.lng).replace(/\./g, ','),
					tolerance: options.tolerance || 0
				};
			return gmxAPIutils.requestJSONP(
				options.url || 'http://pkk5.rosreestr.ru/api/features/',
				req,
				options
			);
		} else {
			return null;
		}
    },

	getFormData: function(json) {
		var arr = [];
		for (var key in json) {
			var val = json[key];
			arr.push(key + '=' + (typeof val === 'object' ? JSON.stringify(val) : val));
		}
		return arr.join('&');
    },

	requestLink: function(url, params, options) {
        options = options || {};
		return new Promise(function(resolve, reject) {
			var script = null;
			if (url.indexOf('.css') === -1) {
				script = document.createElement('script');
				script.setAttribute('charset', 'UTF-8');
				var urlParams = L.extend({}, params, L.gmx.gmxMapManager.syncParams),
					paramsStringItems = [];

				for (var p in urlParams) {
					paramsStringItems.push(p + '=' + encodeURIComponent(urlParams[p]));
				}
				var src = url + (url.indexOf('?') === -1 ? '?' : '&') + paramsStringItems.join('&'),
					clearTag = function(err) {
						L.gmxUtil.loaderStatus(src, true);
						script.parentNode.removeChild(script);
						if (err) {
							reject(url);
							console.warn('Not found script:', url);
						} else {
							resolve(url, params, options);
						}
					};

				script.onerror = clearTag;
				script.onload = function() {
					clearTag();
				};
				L.gmxUtil.loaderStatus(src, null, 'vector');
				script.setAttribute('src', src);
			} else {
				script = document.createElement('link');

				script.rel   = 'stylesheet';
				script.type  = 'text/css';
				//link.media = options.media || 'screen';
				script.href  = url;
				resolve(url, params, options);
			}
			document.getElementsByTagName('head').item(0).appendChild(script);
		});
    },

    /** Sends JSONP requests
     * @memberof L.gmxUtil
     * @param {String} url - request URL
     * @param {Object} params - request params
     * @param {Object} [options] - additional request options
     * @param {String} [options.callbackParamName=CallbackName] - Name of param, that will be used for callback id.
       If callbackParamName is set to null, no params will be added (StaticJSONP)
     * @return {Deferred} Promise with server JSON response or with error status
    */
	requestJSONP: function(url, params, options) {
        options = options || {};
        var def = new L.gmx.Deferred();

        var script = document.createElement('script');
        script.setAttribute('charset', 'UTF-8');
        var callbackParamName = 'callbackParamName' in options ? options.callbackParamName : 'CallbackName';
        var urlParams = L.extend({}, params, L.gmx.gmxMapManager.syncParams);

        if (callbackParamName) {
            var callbackName = gmxAPIutils.uniqueGlobalName(function(obj) {
                delete window[callbackName];
                def.resolve(obj, options);
            });

            urlParams[callbackParamName] = callbackName;
        }

        var paramsStringItems = [];

        for (var p in urlParams) {
            paramsStringItems.push(p + '=' + encodeURIComponent(urlParams[p]));
        }

        var src = url + (url.indexOf('?') === -1 ? '?' : '&') + paramsStringItems.join('&');

        script.onerror = function(e) {
            def.reject(e);
            L.gmxUtil.loaderStatus(src, true);
            script.parentNode.removeChild(script);
        };
        script.onload = function() {
            L.gmxUtil.loaderStatus(src, true);
            script.parentNode.removeChild(script);
        };
        L.gmxUtil.loaderStatus(src, null, 'vector');
        script.setAttribute('src', src);

        document.getElementsByTagName('head').item(0).appendChild(script);
        return def;
    },
    getXmlHttp: function() {
        var xmlhttp;
        if (typeof XMLHttpRequest !== 'undefined') {
            xmlhttp = new XMLHttpRequest();
        } else {
          try {
            xmlhttp = new ActiveXObject('Msxml2.XMLHTTP');
          } catch (e) {
            try {
              xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');
            } catch (E) {
              xmlhttp = false;
            }
          }
        }
        return xmlhttp;
    },
    request: function(ph) { // {'type': 'GET|POST', 'url': 'string', 'callback': 'func'}
        var xhr = gmxAPIutils.getXmlHttp();
        if (xhr) {
            xhr.open((ph.type ? ph.type : 'GET'), ph.url, ph.async || false);
            if (ph.headers) {
                for (var key in ph.headers) {
                    xhr.setRequestHeader(key, ph.headers[key]);
                }
            }
            var reqId = L.gmxUtil.loaderStatus(ph.url);
            if (ph.async) {
                if (ph.withCredentials) {
                    xhr.withCredentials = true;
                }
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        L.gmxUtil.loaderStatus(reqId, true);
                        if (xhr.status === 200) {
                            ph.callback(xhr.responseText);
                            xhr = null;
                        } else if (ph.onError) {
                            ph.onError(xhr);
                        }
                    }
                };
            }
			var params = null;
			if (ph.params) {
				params = ph.params;
				var syncParams = L.gmx.gmxMapManager.getSyncParams(true);
				if (syncParams) {
					params += '&' + syncParams;
				}
			}
            xhr.send(params);
            if (!ph.async && xhr.status === 200) {
                ph.callback(xhr.responseText);
                L.gmxUtil.loaderStatus(reqId, true);
                return xhr.status;
            }
            return true;
        }
        if (ph.onError) {
            ph.onError({Error: 'bad XMLHttpRequest!'});
        }
        return false;
    },

    tileSizes: [], // Размеры тайла по zoom
    getTileNumFromLeaflet: function (tilePoint, zoom) {
        if ('z' in tilePoint) {
            zoom = tilePoint.z;
        }
        var pz = Math.pow(2, zoom),
            tx = tilePoint.x % pz + (tilePoint.x < 0 ? pz : 0),
            ty = tilePoint.y % pz + (tilePoint.y < 0 ? pz : 0);
        return {
            z: zoom,
            x: tx % pz - pz / 2,
            y: pz / 2 - 1 - ty % pz
        };
    },

	getTilePosZoomDelta: function(tilePoint, zoomFrom, zoomTo) {		// получить смещение тайла на меньшем zoom
        var dz = Math.pow(2, zoomFrom - zoomTo),
            size = 256 / dz,
            dx = tilePoint.x % dz,
            dy = tilePoint.y % dz;
		return {
			size: size,
			zDelta: dz,
			x: size * dx,
			y: size * dy
		};
    },

    isItemIntersectBounds: function(geo, bounds) {
        var type = geo.type,
            coords = geo.coordinates;
        if (type === 'POLYGON' || type === 'Polygon') {
			coords = [coords];
		}

		for (var j = 0, len1 = coords.length; j < len1; j++) {
			for (var i = 0, len = coords[j].length; i < len; i++) {
				if (bounds.clipPolygon(coords[j][i]).length) {
					return true;
				}
			}
		}
		return false;
    },

    geoItemBounds: function(geo) {  // get item bounds array by geometry
        if (!geo) {
            return {
                bounds: null,
                boundsArr: []
            };
        }
        var type = geo.type,
            coords = geo.coordinates,
            b = null,
            i = 0,
            len = 0,
            bounds = null,
            boundsArr = [];
        if (type === 'MULTIPOLYGON' || type === 'MultiPolygon') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                var arr1 = [];
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    b = gmxAPIutils.bounds(coords[i][j]);
                    arr1.push(b);
                    if (j === 0) { bounds.extendBounds(b); }
                }
                boundsArr.push(arr1);
            }
        } else if (type === 'POLYGON' || type === 'Polygon') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds(coords[i]);
                boundsArr.push(b);
                if (i === 0) { bounds.extendBounds(b); }
            }
        } else if (type === 'POINT' || type === 'Point') {
            bounds = gmxAPIutils.bounds([coords]);
        } else if (type === 'MULTIPOINT' || type === 'MultiPoint') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds([coords[i]]);
                bounds.extendBounds(b);
            }
        } else if (type === 'LINESTRING' || type === 'LineString') {
            bounds = gmxAPIutils.bounds(coords);
            //boundsArr.push(bounds);
        } else if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds(coords[i]);
                bounds.extendBounds(b);
                //boundsArr.push(b);
            }
        }
        return {
            bounds: bounds,
            boundsArr: boundsArr
        };
    },

    getUnFlattenGeo: function(geo) {  // get unFlatten geometry
        var type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            coords = geo.coordinates,
            coordsOut = coords;

        if (isLikePolygon) {
            coordsOut = [];
            var isPolygon = type === 'POLYGON' || type === 'Polygon';
            if (isPolygon) { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                var ring = [];
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    ring[j] = gmxAPIutils.unFlattenRing(coords[i][j]);
                }
                coordsOut.push(ring);
            }
            if (isPolygon) { coordsOut = coordsOut[0]; }
        }
        return {type: type, coordinates: coordsOut};
    },

    unFlattenRing: function(arr) {
        if (typeof arr[0] !== 'number') {
            return arr;
        }
        var len = arr.length,
            cnt = 0,
            res = new Array(len / 2);

        for (var i = 0; i < len; i += 2) {
            res[cnt++] = [arr[i], arr[i + 1]];
        }
        return res;
    },

    geoFlatten: function(geo) {  // get flatten geometry
        var type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            isPolygon = type === 'POLYGON' || type === 'Polygon',
            coords = geo.coordinates;

        if (isLikePolygon) {
            if (isPolygon) { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    coords[i][j] = gmxAPIutils.flattenRing(coords[i][j]);
                }
            }
        }
    },

    flattenRing: function(arr) {
        var len = arr.length,
            cnt = 0,
            CurArray = typeof Float64Array === 'function' ? Float64Array : Array,
            res = new CurArray(2 * len);

        for (var i = 0; i < len; i++) {
            res[cnt++] = arr[i][0];
            res[cnt++] = arr[i][1];
        }
        return res;
    },

    /** Check rectangle type by coordinates
     * @memberof L.gmxUtil
     * @param {coordinates} coordinates - geoJSON coordinates data format
     * @return {Boolean}
    */
    isRectangle: function(coords) {
        return (coords && coords[0] && (coords[0].length === 5 || coords[0].length === 4)
            && ((coords[0][0][0] === coords[0][1][0]) || (coords[0][0][1] === coords[0][1][1]))
            && ((coords[0][1][0] === coords[0][2][0]) || (coords[0][1][1] === coords[0][2][1]))
            && ((coords[0][2][0] === coords[0][3][0]) || (coords[0][2][1] === coords[0][3][1]))
            && ((coords[0][3][0] === coords[0][0][0]) || (coords[0][3][1] === coords[0][0][1]))
        );
    },

    /** Get bounds from geometry
     * @memberof L.gmxUtil
     * @param {geometry} geometry - Geomixer or geoJSON data format
     * @return {Object} bounds
    */
    getGeometryBounds: function(geo) {
        var pt = gmxAPIutils.geoItemBounds(geo);
        return pt.bounds;
    },

    getMarkerPolygon: function(bounds, dx, dy) {
        var x = (bounds.min.x + bounds.max.x) / 2,
            y = (bounds.min.y + bounds.max.y) / 2;
        return [
            [x - dx, y - dy],
            [x - dx, y + dy],
            [x + dx, y + dy],
            [x + dx, y - dy],
            [x - dx, y - dy]
        ];
    },

    getQuicklookPointsFromProperties: function(pArr, gmx) {
        var indexes = gmx.tileAttributeIndexes;
        var points = {
                x1: gmxAPIutils.getPropItem(gmx.quicklookX1 || ('x1' in indexes ? 'x1' : 'X1'), pArr, indexes) || 0,
                y1: gmxAPIutils.getPropItem(gmx.quicklookY1 || ('y1' in indexes ? 'y1' : 'Y1'), pArr, indexes) || 0,
                x2: gmxAPIutils.getPropItem(gmx.quicklookX2 || ('x2' in indexes ? 'x2' : 'X2'), pArr, indexes) || 0,
                y2: gmxAPIutils.getPropItem(gmx.quicklookY2 || ('y2' in indexes ? 'y2' : 'Y2'), pArr, indexes) || 0,
                x3: gmxAPIutils.getPropItem(gmx.quicklookX3 || ('x3' in indexes ? 'x3' : 'X3'), pArr, indexes) || 0,
                y3: gmxAPIutils.getPropItem(gmx.quicklookY3 || ('y3' in indexes ? 'y3' : 'Y3'), pArr, indexes) || 0,
                x4: gmxAPIutils.getPropItem(gmx.quicklookX4 || ('x4' in indexes ? 'x4' : 'X4'), pArr, indexes) || 0,
                y4: gmxAPIutils.getPropItem(gmx.quicklookY4 || ('y4' in indexes ? 'y4' : 'Y4'), pArr, indexes) || 0
            },
            bounds = gmxAPIutils.bounds([
                [points.x1, points.y1],
                [points.x2, points.y2],
                [points.x3, points.y3],
                [points.x4, points.y4]
            ]);

        if (bounds.max.x === bounds.min.x || bounds.max.y === bounds.min.y) {
            return null;
        }

        if (!gmx.quicklookPlatform) {
			var crs = gmx.srs == 3857 ? L.CRS.EPSG3857 : L.Projection.Mercator;
            var merc = crs.project(L.latLng(points.y1, points.x1));
            points.x1 = merc.x; points.y1 = merc.y;
            merc = crs.project(L.latLng(points.y2, points.x2));
            points.x2 = merc.x; points.y2 = merc.y;
            merc = crs.project(L.latLng(points.y3, points.x3));
            points.x3 = merc.x; points.y3 = merc.y;
            merc = crs.project(L.latLng(points.y4, points.x4));
            points.x4 = merc.x; points.y4 = merc.y;
        }

        return points;
    },

    /** Get hash properties from array properties
     * @memberof L.gmxUtil
     * @param {Array} properties in Array format
     * @param {Object} keys indexes
     * @return {Object} properties in Hash format
    */
    getPropertiesHash: function(arr, indexes) {
        var properties = {};
        for (var key in indexes) {
            properties[key] = arr[indexes[key]];
        }
        return properties;
    },

    getPropItem: function(key, arr, indexes) {
        return key in indexes ? arr[indexes[key]] : '';
    },

    dec2rgba: function(i, a)	{				// convert decimal to rgb
        var r = (i >> 16) & 255,
            g = (i >> 8) & 255,
            b = i & 255;
		return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
	},

    dec2hex: function(i) {					// convert decimal to hex
        return (i + 0x1000000).toString(16).substr(-6);
    },

    dec2color: function(i, a)   {   // convert decimal to canvas color
        return a < 1 ? this.dec2rgba(i, a) : '#' + this.dec2hex(i);
    },

    oneDay: 60 * 60 * 24,			// один день

    isTileKeysIntersects: function(tk1, tk2) { // пересечение по номерам двух тайлов
        if (tk1.z < tk2.z) {
            var t = tk1; tk1 = tk2; tk2 = t;
        }

        var dz = tk1.z - tk2.z;
        return tk1.x >> dz === tk2.x && tk1.y >> dz === tk2.y;
	},

    rotatePoints: function(arr, angle, iconScale, center) {			// rotate - массива точек
        var out = [];
        angle *= Math.PI / 180.0;
        var sin = Math.sin(angle);
        var cos = Math.cos(angle);
        if (!iconScale) { iconScale = 1; }
        for (var i = 0; i < arr.length; i++) {
            var x = iconScale * arr[i].x - center.x;
            var y = iconScale * arr[i].y - center.y;
            out.push({
                'x': cos * x - sin * y + center.x,
                'y': sin * x + cos * y + center.y
            });
        }
        return out;
    },
    getPatternIcon: function(item, style, indexes) { // получить bitmap стиля pattern
        if (!style.fillPattern) { return null; }

        var notFunc = true,
            pattern = style.fillPattern,
            prop = item ? item.properties : null,
            step = pattern.step > 0 ? pattern.step : 0,
            patternDefaults = {
                minWidth: 1,
                maxWidth: 1000,
                minStep: 0,
                maxStep: 1000
            };
        if (pattern.patternStepFunction && prop !== null) {
            step = pattern.patternStepFunction(prop, indexes);
            notFunc = false;
        }
        if (step > patternDefaults.maxStep) {
            step = patternDefaults.maxStep;
        }
        else if (step < patternDefaults.minStep) {
            step = patternDefaults.minStep;
        }

        var size = pattern.width > 0 ? pattern.width : 8;
        if (pattern.patternWidthFunction && prop !== null) {
            size = pattern.patternWidthFunction(prop, indexes);
            notFunc = false;
        }
        if (size > patternDefaults.maxWidth) {
            size = patternDefaults.maxWidth;
        } else if (size < patternDefaults.minWidth) {
            size = patternDefaults.minWidth;
        }

        var op = style.fillOpacity;
        if (style.opacityFunction && prop !== null) {
            op = style.opacityFunction(prop, indexes) / 100;
            notFunc = false;
        }

        var rgb = [0xff0000, 0x00ff00, 0x0000ff],
            arr = (pattern.colors != null ? pattern.colors : rgb),
            count = arr.length,
            resColors = [],
            i = 0;

        for (i = 0; i < count; i++) {
            var col = arr[i];
            if (pattern.patternColorsFunction && pattern.patternColorsFunction[i] !== null) {
                col = (prop !== null ? pattern.patternColorsFunction[i](prop, indexes) : rgb[i % 3]);
                notFunc = false;
            }
            resColors.push(col);
        }
        if (count === 0) { resColors = [0]; op = 0; count = 1; }   // pattern without colors

        var delta = size + step,
            allSize = delta * count,
            center = 0,
            //radius,
            rad = 0,
            hh = allSize,				// высота битмапа
            ww = allSize,				// ширина битмапа
            type = pattern.style || 'horizontal',
            flagRotate = false;

        if (type === 'diagonal1' || type === 'diagonal2' || type === 'cross' || type === 'cross1') {
            flagRotate = true;
        } else if (type === 'circle') {
            ww = hh = 2 * delta;
            center = Math.floor(ww / 2);	// центр круга
            //radius = Math.floor(size / 2);	// радиус
            rad = 2 * Math.PI / count;		// угол в рад.
        } else if (type === 'vertical') {
            hh = 1;
        } else if (type === 'horizontal') {
            ww = 1;
        }
        if (ww * hh > patternDefaults.maxWidth) {
            console.log({'func': 'getPatternIcon', 'Error': 'MAX_PATTERN_SIZE', 'alert': 'Bitmap from pattern is too big'});
            return null;
        }

        var canvas = document.createElement('canvas');
        canvas.width = ww; canvas.height = hh;
        var ptx = canvas.getContext('2d');
        ptx.clearRect(0, 0, canvas.width, canvas.height);
        if (type === 'diagonal2' || type === 'vertical') {
            ptx.translate(ww, 0);
            ptx.rotate(Math.PI / 2);
        }

        for (i = 0; i < count; i++) {
            ptx.beginPath();
            var fillStyle = gmxAPIutils.dec2color(resColors[i], op);
            ptx.fillStyle = fillStyle;

            if (flagRotate) {
                var x1 = i * delta; var xx1 = x1 + size;
                ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);

                x1 += allSize; xx1 = x1 + size;
                ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);
                if (type === 'cross' || type === 'cross1') {
                    x1 = i * delta; xx1 = x1 + size;
                    ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);

                    x1 += allSize; xx1 = x1 + size;
                    ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);
                }
            } else if (type === 'circle') {
                ptx.arc(center, center, size, i * rad, (i + 1) * rad);
                ptx.lineTo(center, center);
            } else {
                ptx.fillRect(0, i * delta, ww, size);
            }
            ptx.closePath();
            ptx.fill();
        }
        var canvas1 = document.createElement('canvas');
        canvas1.width = ww;
        canvas1.height = hh;
        var ptx1 = canvas1.getContext('2d');
        ptx1.drawImage(canvas, 0, 0, ww, hh);
        return {'notFunc': notFunc, 'canvas': canvas1};
    },
    setSVGIcon: function(id) {
		return '<svg role="img" class="svgIcon"><use xlink:href="#' + id + '" href="#' + id + '"></use></svg>';
    },

    getSVGIcon: function (options) {
        var svg = '<svg xmlns="' + L.Path.SVG_NS + '" xmlns:xlink="http://www.w3.org/1999/xlink"',
            type = options.type,
            fill = options.fillStyle || 'rgba(255, 255, 255, 0.5)',
            stroke = options.strokeStyle || '#0000ff',
            strokeWidth = options.lineWidth || 2,
            iconOptions = {
                className: 'gmx-svg-icon'
            };

        if (options.className) {
            iconOptions.className = options.className;
        }
        var size = options.iconSize;
        iconOptions.iconSize = [size, size];
        svg += ' height = "' + size + 'px"  width = "' + size + 'px">';

        if (type === 'circle') {
            if (options.fillRadialGradient) {
                svg += '<defs><radialGradient id="myRadialGradient4" spreadMethod="pad">';
                var stopColor = options.fillRadialGradient.colorStop || options.fillRadialGradient.addColorStop
                    || [     // [%, color, opacity]
                        [0, '#ffff00', 0.8],
                        [1, '#ff0000', 0.8]
                    ];

                for (var i = 0, len = stopColor.length; i < len; i++) {
                    var it = stopColor[i];
                    svg += '<stop offset="' + (100 * it[0]) + '%"   stop-color="' + it[1] + '" stop-opacity="' + it[2] + '"/>';
                }
                svg += '</radialGradient></defs>';
                fill = 'url(#myRadialGradient4)';
                stroke = strokeWidth = null;
            }
            size /= 2;
            svg += '<g><circle cx="' + size + '" cy="' + size + '" r="' + size + '" style="';
            if (fill) { svg += ' fill:' + fill + ';'; }
            if (stroke) { svg += ' stroke:"' + stroke + ';'; }
            if (strokeWidth) { svg += ' stroke-width:"' + strokeWidth + ';'; }
            svg += ';" />';
        } else if (type === 'square') {
            svg += '<g><rect width="' + size + '" height="' + size + '" style="';
            if (fill) { svg += ' fill:' + fill + ';'; }
            if (stroke) { svg += ' stroke:' + stroke + ';'; }
            if (strokeWidth) { svg += ' stroke-width:' + 2 * strokeWidth + ';'; }
            svg += '" />';
        }
        if (options.text) {
            var text = options.text;
            svg += '<text x="50%" y="50%" dy="0.4em"';
            for (var key in text) {
                if (key !== 'count') { svg += ' ' + key + '="' + text[key] + '"'; }
            }
            svg += '>' + text.count + '</text>';
        }
        svg += '</g></svg>';
        iconOptions.html = svg;

        return new L.DivIcon(iconOptions);
    },

    toPixels: function(p, tpx, tpy, mInPixel) { // get pixel point	, topLeft
        var px1 = p[0] * mInPixel; 	px1 = (0.5 + px1) << 0;
        var py1 = p[1] * mInPixel;	py1 = (0.5 + py1) << 0;
        return [px1 - tpx, tpy - py1].concat(p.slice(2));
    },

    getPixelPoint: function(attr, coords) {
        var topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys || {},
            style = attr.style || {},
            iconScale = currentStyle.iconScale || 1,
            iconCenter = currentStyle.iconCenter || false,
            sx = currentStyle.sx || style.sx || 4,
            sy = currentStyle.sy || style.sy || 4,
            weight = currentStyle.weight || style.weight || 0,
            iconAnchor = currentStyle.iconAnchor || style.iconAnchor || null,
			px = attr.tpx,
            py = attr.tpy;

        if (!iconCenter && iconAnchor) {
            px1 -= iconAnchor[0];
            py1 -= iconAnchor[1];
        }
        sx *= iconScale;
        sy *= iconScale;
        sx += weight;
        sy += weight;

        var py1 = py - coords[1] * mInPixel,
			px1 = coords[0] * mInPixel - px;

		if (px1 - sx > 256) {
			px1 = (coords[0] - 2 * gmxAPIutils.worldWidthMerc) * mInPixel - px;
		} else if (px1 < -sx) {
			px1 = (coords[0] + 2 * gmxAPIutils.worldWidthMerc) * mInPixel - px;
		}

        return py1 - sy > 256 || px1 - sx > 256 || px1 + sx < 0 || py1 + sy < 0
			? null :
            {
                sx: sx,
                sy: sy,
                px1: (0.5 + px1) << 0,
                py1: (0.5 + py1) << 0
            }
        ;
    },
    getImageData: function(img) {
        if (L.gmxUtil.isIE9 || L.gmxUtil.isIE10) { return null; }
        var canvas = document.createElement('canvas'),
            ww = img.width,
            hh = img.height;

        canvas.width = ww; canvas.height = hh;
        var ptx = canvas.getContext('2d');
        ptx.drawImage(img, 0, 0);
        return ptx.getImageData(0, 0, ww, hh).data;
    },
    DEFAULT_REPLACEMENT_COLOR: 0xff00ff,
    isIE: function(v) {
        return v === gmxAPIutils.getIEversion();
    },
    gtIE: function(v) {
        return v < gmxAPIutils.getIEversion();
    },

    getIEversion: function() {
        var ua = navigator.userAgent || '',
            msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return -1;
    },

    replaceColor: function(img, color, fromData) {
        if (L.gmxUtil.isIE9 || L.gmxUtil.isIE10) { return img; }
        var canvas = document.createElement('canvas'),
            ww = img.width,
            hh = img.height;

        canvas.width = ww; canvas.height = hh;
        var flag = false,
            imageData,
            ptx = canvas.getContext('2d');

        if (typeof color === 'string') {
            color = parseInt('0x' + color.replace(/#/, ''));
        }
        if (color !== this.DEFAULT_REPLACEMENT_COLOR) {
            var r = (color >> 16) & 255,
                g = (color >> 8) & 255,
                b = color & 255;

            if (fromData) {
                imageData = ptx.createImageData(ww, hh);
            } else {
                ptx.drawImage(img, 0, 0);
                imageData = ptx.getImageData(0, 0, ww, hh);
                fromData = imageData.data;
            }
            var toData = imageData.data;
            for (var i = 0, len = fromData.length; i < len; i += 4) {
                if ((fromData[i] === 0xff || fromData[i] === 238)
                    && fromData[i + 1] === 0
                    && fromData[i + 2] === 0xff
                    ) {
                    toData[i] = r;
                    toData[i + 1] = g;
                    toData[i + 2] = b;
                    toData[i + 3] = fromData[i + 3];
                    flag = true;
                }
            }
        }
        if (flag) {
            ptx.putImageData(imageData, 0, 0);
        } else {
            ptx.drawImage(img, 0, 0);
        }
        return canvas;
    },

    drawIconPath: function(path, attr) { // draw iconPath in canvas
        if (!L.Util.isArray(path) || path.length < 3 || !attr.ctx) { return; }
        var trFlag = false,
            ctx = attr.ctx,
            rad = attr.radian;

        if (attr.px || attr.py) { ctx.translate(attr.px || 0, attr.py || 0); trFlag = true; }
        if (!rad && attr.rotateRes) { rad = Math.PI + gmxAPIutils.degRad(attr.rotateRes); }
        if (rad) { ctx.rotate(rad); trFlag = true; }
        ctx.moveTo(path[0], path[1]);
        for (var i = 2, len = path.length; i < len; i += 2) {
            ctx.lineTo(path[i], path[i + 1]);
        }
        if (trFlag) { ctx.setTransform(1, 0, 0, 1, 0, 0); }
    },

    pointToCanvas: function(attr) { // Точку в canvas
        var gmx = attr.gmx,
			topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            pointAttr = attr.pointAttr,
            style = attr.style || {},
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            iconScale = currentStyle.iconScale || 1,
            image = currentStyle.image,
            sx = pointAttr.sx,
            sy = pointAttr.sy,
            px1 = pointAttr.px1,
            py1 = pointAttr.py1,
            px1sx = px1,
            py1sy = py1,
            ctx = attr.ctx;

        if (currentStyle.type === 'image') {
            sx = style.sx;
            sy = style.sy;
            image = style.image;
        }
        if (currentStyle.iconCenter) {
            px1sx -= sx / 2;
            py1sy -= sy / 2;
        } else if (style.type === 'circle') {
            px1 += sx / 2;
            py1 += sy / 2;
        }
        if (currentStyle.iconPath) {
            attr.px = px1;
            attr.py = py1;
            attr.rotateRes = currentStyle.rotate || 0;
        }
        if (image) {
            if ('iconColor' in currentStyle && !L.gmxUtil.isIE11) {
                image = this.replaceColor(image, currentStyle.iconColor, attr.imageData);
            }
            style.rotateRes = currentStyle.rotate || 0;
            if ('opacity' in style) { ctx.globalAlpha = currentStyle.opacity || style.opacity; }
            if (gmx.transformFlag) {
//						topLeft = attr.topLeft,
				ctx.setTransform(mInPixel, 0, 0, mInPixel, -attr.tpx, attr.tpy);
                ctx.drawImage(image, px1, -py1, sx, sy);
                ctx.setTransform(mInPixel, 0, 0, -mInPixel, -attr.tpx, attr.tpy);
            } else {
				if (iconScale !== 1) {
					sx *= iconScale;
					sy *= iconScale;
					px1 = pointAttr.px1;
					py1 = pointAttr.py1;
					px1sx = px1;
					py1sy = py1;
					if (currentStyle.iconCenter) {
						px1sx -= sx / 2;
						py1sy -= sy / 2;
					}
				}
				if (style.rotateRes) {
					ctx.translate(px1, py1);
					ctx.rotate(gmxAPIutils.degRad(style.rotateRes));
					ctx.translate(-px1, -py1);
					ctx.drawImage(image, px1sx, py1sy, sx, sy);
					ctx.setTransform(1, 0, 0, 1, 0, 0);
				} else {
					ctx.drawImage(image, px1sx, py1sy, sx, sy);
				}
            }
            if ('opacity' in style) { ctx.globalAlpha = 1; }
        } else if (style.fillColor || currentStyle.fillRadialGradient) {
            ctx.beginPath();
            if (currentStyle.iconPath) {
                gmxAPIutils.drawIconPath(currentStyle.iconPath, attr);
            } else if (style.type === 'circle' || currentStyle.fillRadialGradient) {
                var circle = style.iconSize / 2;
                if (currentStyle.fillRadialGradient) {
                    var rgr = currentStyle.fillRadialGradient;
                    circle = rgr.r2 * iconScale;
                    var radgrad = ctx.createRadialGradient(px1 + rgr.x1, py1 + rgr.y1, rgr.r1 * iconScale, px1 + rgr.x2, py1 + rgr.y2, circle);
                    for (var i = 0, len = rgr.addColorStop.length; i < len; i++) {
                        var arr = rgr.addColorStop[i];
                        radgrad.addColorStop(arr[0], arr[1]);
                    }
                    ctx.fillStyle = radgrad;
                }
                ctx.arc(px1, py1, circle, 0, 2 * Math.PI);
            } else {
                ctx.fillRect(px1sx, py1sy, sx, sy);
            }
            ctx.fill();
        }
        if (currentStyle.strokeStyle) {
            ctx.beginPath();
            if (currentStyle.iconPath) {
                gmxAPIutils.drawIconPath(currentStyle.iconPath, attr);
            } else if (style.type === 'circle') {
                ctx.arc(px1, py1, style.iconSize / 2, 0, 2 * Math.PI);
            } else {
                ctx.strokeRect(px1sx, py1sy, sx, sy);
            }
            ctx.stroke();
        }
    },
    lineToCanvasAsIcon: function(pixels, attr) {  // add line(as icon) to canvas
        var len = pixels.length,
            ctx = attr.ctx,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            iconPath = currentStyle.iconPath;

        if (len > 0) {
            if ('getLineDash' in ctx && ctx.getLineDash().length > 0) {
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            for (var i = 0, p; i < len; i++) {
                p = pixels[i];
                gmxAPIutils.drawIconPath(iconPath, {ctx: ctx, px: p.x, py: p.y, radian: p.radian});
            }
            if (currentStyle.strokeStyle) {
                ctx.stroke();
            }
            if (currentStyle.fillStyle) {
                ctx.fill();
            }
        }
    },
    lineToCanvas: function(attr) {  // Lines in canvas
        var topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            coords = attr.coords,
            ctx = attr.ctx,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            pixels = currentStyle.iconPath ? [] : null;

        var lastX = null, lastY = null;
        ctx.beginPath();
        for (var i = 0, len = coords.length; i < len; i++) {
            var p = gmxAPIutils.toPixels(coords[i], attr.tpx, attr.tpy, mInPixel, attr.topLeft),
                x = p[0],
                y = p[1];
            if (lastX !== x || lastY !== y) {
                if (pixels) { pixels.push({x: x, y: y, radian: p[2]}); }
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                lastX = x; lastY = y;
            }
        }
        ctx.stroke();
        return pixels;
    },

    getCoordsPixels: function(attr) {
        var gmx = attr.gmx,
            coords = attr.coords,
            hiddenLines = attr.hiddenLines || [],
            pixels = [],
            hidden = [],
            hiddenFlag = false,
            hash = {
                gmx: gmx,
				topLeft: attr.topLeft,
                tpx: attr.tpx,
                tpy: attr.tpy,
                coords: null,
                hiddenLines: null
            };
        for (var j = 0, len = coords.length; j < len; j++) {
            var coords1 = coords[j],
                hiddenLines1 = hiddenLines[j] || [],
                pixels1 = [], hidden1 = [];
            for (var j1 = 0, len1 = coords1.length; j1 < len1; j1++) {
                hash.coords = coords1[j1];
                hash.hiddenLines = hiddenLines1[j1] || [];
                var res = gmxAPIutils.getRingPixels(hash);
                pixels1.push(res.coords);
                hidden1.push(res.hidden);
                if (res.hidden) {
                    hiddenFlag = true;
                }
            }
            pixels.push(pixels1);
            hidden.push(hidden1);
        }
        return {coords: pixels, hidden: hiddenFlag ? hidden : null, z: attr.topLeft.tilePoint.z};
    },

    getRingPixels: function(attr) {
        if (attr.coords.length === 0) { return null; }
        var topLeft = attr.topLeft,
            mInPixel = topLeft.mInPixel,
            coords = attr.coords,
            hiddenLines = attr.hiddenLines || null,
			// topLeft = attr.topLeft,
            px = attr.tpx,
            py = attr.tpy,
            cnt = 0, cntHide = 0,
            lastX = null, lastY = null,
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            pixels = [], hidden = [];
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var lineIsOnEdge = false;
            if (hiddenLines && i === hiddenLines[cntHide]) {
                lineIsOnEdge = true;
                cntHide++;
            }
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                x1 = Math.round(c[0] * mInPixel), y1 = Math.round(c[1] * mInPixel),
                x2 = Math.round(x1 - px), y2 = Math.round(py - y1);

            if (lastX !== x2 || lastY !== y2) {
                lastX = x2; lastY = y2;
                if (lineIsOnEdge) {
                    hidden.push(cnt);
                }
                pixels[cnt++] = x1;
                pixels[cnt++] = y1;
            }
        }
        return {coords: pixels, hidden: hidden.length ? hidden : null};
    },

    polygonToCanvas: function(attr) {       // Polygons in canvas
        if (attr.coords.length === 0) { return null; }
        var hiddenLines = attr.hiddenLines || null,
            coords = attr.coords,
            ctx = attr.ctx,
			// topLeft = attr.topLeft,
            px = attr.tpx,
            py = attr.tpy,
            cnt = 0, cntHide = 0,
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            lastX = null, lastY = null;

        ctx.beginPath();
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                x = Math.round(c[0] - px),
                y = Math.round(py - c[1]),
                lineIsOnEdge = false,
				lineCap = 'round';
// console.log('px', x, y, px, py, attr);
            if (hiddenLines && i === hiddenLines[cntHide]) {
                lineIsOnEdge = true;
				lineCap = 'butt';
                cntHide++;
            }
			if (ctx.lineCap !== lineCap) { ctx.lineCap = lineCap; }

            if (lastX !== x || lastY !== y) {
                ctx[(lineIsOnEdge ? 'moveTo' : 'lineTo')](x, y);
                lastX = x; lastY = y;
                cnt++;
            }
        }
        if (cnt === 1) { ctx.lineTo(lastX + 1, lastY); }
        ctx.stroke();
    },

    polygonToCanvasFill: function(attr) {     // Polygon fill
        if (attr.coords.length < 3) { return; }
        var coords = attr.coords,
			// topLeft = attr.topLeft,
            px = attr.tpx,
            py = attr.tpy,
            vectorSize = 1,
            ctx = attr.ctx;

        ctx.lineWidth = 0;
        if (typeof coords[0] === 'number') {
            vectorSize = 2;
            ctx.moveTo(Math.round(coords[0] - px), Math.round(py - coords[1]));
        } else {
            ctx.moveTo(Math.round(coords[0][0] - px), Math.round(py - coords[0][1]));
        }
        for (var i = vectorSize, len = coords.length; i < len; i += vectorSize) {
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]];
            ctx.lineTo(Math.round(c[0] - px), Math.round(py - c[1]));
        }
    },

    isPatternNode: function(it) {
        return it instanceof HTMLCanvasElement || it instanceof HTMLImageElement;
    },
    labelCanvasContext: null,    // 2dContext canvas for Label size
    getLabelWidth: function(txt, style) {   // Get label size Label
        if (style) {
            if (!gmxAPIutils.labelCanvasContext) {
                var canvas = document.createElement('canvas');
                canvas.width = canvas.height = 512;
                gmxAPIutils.labelCanvasContext = canvas.getContext('2d');
            }
            var ptx = gmxAPIutils.labelCanvasContext;
            ptx.clearRect(0, 0, 512, 512);

            if (ptx.font !== style.font) { ptx.font = style.font; }
            //if (ptx.strokeStyle !== style.strokeStyle) { ptx.strokeStyle = style.strokeStyle; }
            if (ptx.fillStyle !== style.fillStyle) { ptx.fillStyle = style.fillStyle; }
			var arr = txt.split('\n');
            return arr.map(function(it) {
				ptx.fillText(it, 0, 0);
				return [it, ptx.measureText(it).width];
			});
        }
        return 0;
    },
    setLabel: function(ctx, txt, coord, style) {
        var x = coord[0],
            y = coord[1];

        if (ctx.shadowColor !== style.strokeStyle) { ctx.shadowColor = style.strokeStyle; }
        if (ctx.shadowBlur !== style.shadowBlur) { ctx.shadowBlur = style.shadowBlur; }
        if (ctx.font !== style.font) { ctx.font = style.font; }
		if (L.Browser.gecko) {	// Bug with perfomance in FireFox
			if (ctx.strokeStyle !== style.fillStyle) { ctx.strokeStyle = style.fillStyle; }
		} else {
			if (ctx.strokeStyle !== style.strokeStyle) { ctx.strokeStyle = style.strokeStyle; }
			if (ctx.fillStyle !== style.fillStyle) { ctx.fillStyle = style.fillStyle; }
		}
        ctx.strokeText(txt, x, y);
		if (!L.Browser.gecko) {
			ctx.fillText(txt, x, y);
		}
    },
    worldWidthFull: 40075016.685578496,
    // worldWidthMerc: gmxAPIutils.worldWidthFull / 2,
    rMajor: 6378137.000,
    degRad: function(ang) {
        return ang * (Math.PI / 180.0);
    },

    distVincenty: function(lon1, lat1, lon2, lat2) {
        var p1 = {
            lon: gmxAPIutils.degRad(lon1),
            lat: gmxAPIutils.degRad(lat1)
        },
            p2 = {
            lon: gmxAPIutils.degRad(lon2),
            lat: gmxAPIutils.degRad(lat2)
        },
            a = gmxAPIutils.rMajor,
            b = 6356752.3142,
            f = 1 / 298.257223563;  // WGS-84 ellipsiod

        var L1 = p2.lon - p1.lon,
            U1 = Math.atan((1 - f) * Math.tan(p1.lat)),
            U2 = Math.atan((1 - f) * Math.tan(p2.lat)),
            sinU1 = Math.sin(U1), cosU1 = Math.cos(U1),
            sinU2 = Math.sin(U2), cosU2 = Math.cos(U2),
            lambda = L1,
            lambdaP = 2 * Math.PI,
            iterLimit = 20;
        while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
                var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda),
                    sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
                    (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
                if (sinSigma === 0) { return 0; }
                var cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda,
                    sigma = Math.atan2(sinSigma, cosSigma),
                    sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma,
                    cosSqAlpha = 1 - sinAlpha * sinAlpha,
                    cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
                if (isNaN(cos2SigmaM)) { cos2SigmaM = 0; }
                var C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
                lambdaP = lambda;
                lambda = L1 + (1 - C) * f * sinAlpha *
                    (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
        }
        if (iterLimit === 0) { return NaN; }

        var uSq = cosSqAlpha * ((a * a) / (b * b) - 1),
        //var uSq = cosSqAlpha * (a * a - b * b) / (b*b),
            A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq))),
            B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq))),
            deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
                B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM))),
            s = b * A * (sigma - deltaSigma);

        //s = s.toFixed(3);
        return s;
    },

    _vfi: function(fi, a, b) {
        return [
            -Math.cos(fi) * Math.sin(a) + Math.sin(fi) * Math.sin(b) * Math.cos(a),
            Math.cos(fi) * Math.cos(a) + Math.sin(fi) * Math.sin(b) * Math.sin(a),
            -Math.sin(fi) * Math.cos(b)
        ];
    },

    getCircleLatLngs: function(latlng, r) {   // Get latlngs for circle
        var x = 0, y = 0;
        if (latlng instanceof L.LatLng) {
            x = latlng.lng;
            y = latlng.lat;
        } else if (L.Util.isArray(latlng)) {
            x = latlng[1];
            y = latlng[0];
        } else {
            return null;
        }

        var rad = Math.PI / 180,
            a = x * rad,  //долгота центра окружности в радианах
            b = y * rad,  //широта центра окружности в радианах
            R = gmxAPIutils.rMajor,
            d = R * Math.sin(r / R),
            Rd = R * Math.cos(r / R),
            VR = [
                Rd * Math.cos(b) * Math.cos(a),
                Rd * Math.cos(b) * Math.sin(a),
                Rd * Math.sin(b)
            ],
            latlngs = [];

        for (var fi = 0, limit = 2 * Math.PI + 0.000001; fi < limit; fi += rad) {
            var v = gmxAPIutils._vfi(fi, a, b),
                circle = [];
            for (var i = 0; i < 3; i++) { circle[i] = VR[i] + d * v[i]; }

            var t2 = Math.acos(circle[0] / Math.sqrt(circle[0] * circle[0] + circle[1] * circle[1])) / rad;
            if (circle[1] < 0) { t2 = -t2; }

            if (t2 < x - 180) {
                t2 += 360;
            } else if (t2 > x + 180) {
                t2 -= 360;
            }
            latlngs.push([Math.asin(circle[2] / R) / rad, t2]);
        }
        return latlngs;
    },

    /** Get point coordinates from string
     * @memberof L.gmxUtil
     * @param {String} text - point coordinates in following formats:
         <br/><i>55.74312, 37.61558</i>
         <br/><i>55°44'35" N, 37°36'56" E</i>
         <br/><i>4187347, 7472103</i>
         <br/><i>4219783, 7407468 (EPSG:3395)</i>
         <br/><i>4219783, 7442673 (EPSG:3857)</i>
     * @return {Array} [lat, lng] or null
    */
    parseCoordinates: function(text) {
        var crs = null,
            regex = /\(EPSG:(\d+)\)/g,
            t = regex.exec(text);

        if (t) {
            crs = t[1];
            text = text.replace(regex, '');
        }

        if (text.match(/[йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮqrtyuiopadfghjklzxcvbmQRTYUIOPADFGHJKLZXCVBM_:]/)) {
            return null;
        }

        //there should be a separator in the string (exclude strings like "11E11")
        if (text.indexOf(' ') === -1 && text.indexOf(',') === -1) {
            return null;
        }

        if (text.indexOf(' ') !== -1) {
            text = text.replace(/,/g, '.');
        }
        var results = [];
/*eslint-disable no-useless-escape */
        regex = /(-?\d+(\.\d+)?)([^\d\-]*)/g;
/*eslint-enable */
        t = regex.exec(text);
        while (t) {
            results.push(t[1]);
            t = regex.exec(text);
        }
        if (results.length < 2) {
            return null;
        }
        var ii = Math.floor(results.length / 2),
            y = 0,
            mul = 1,
            i;
        for (i = 0; i < ii; i++) {
            y += parseFloat(results[i]) * mul;
            mul /= 60;
        }
        var x = 0;
        mul = 1;
        for (i = ii; i < results.length; i++) {
            x += parseFloat(results[i]) * mul;
            mul /= 60;
        }

        if (Math.max(text.indexOf('N'), text.indexOf('S')) > Math.max(text.indexOf('E'), text.indexOf('W'))) {
            t = x;
            x = y;
            y = t;
        }

        var pos;
        if (crs == 3857) {
            pos = L.Projection.SphericalMercator.unproject(new L.Point(y, x));
            x = pos.lng;
            y = pos.lat;
        }
        if (Math.abs(x) > 180 || Math.abs(y) > 180) {
            pos = L.Projection.Mercator.unproject(new L.Point(y, x));
            x = pos.lng;
            y = pos.lat;
        }

        if (text.indexOf('W') !== -1) {
            x = -x;
        }

        if (text.indexOf('S') !== -1) {
            y = -y;
        }
        return [y, x];
    },

	pad2: function(t) {
		return (t >= 0 && t < 10) ? ('0' + t) : ('' + t);
	},

	trunc: function(x) {
		return ('' + (Math.round(10000000 * x) / 10000000 + 0.00000001)).substring(0, 9);
	},

	formatDegrees: function(angle, format) {
		angle = Math.round(10000000 * angle) / 10000000 + 0.00000001;
		var a1 = Math.floor(angle),
			a2 = Math.floor(60 * (angle - a1)),
			a3 = gmxAPIutils.toPrecision(3600 * (angle - a1 - a2 / 60), 2),
			st = gmxAPIutils.pad2(a1) + '°';

		if (format ===  undefined ) { format = 2; }
		if (format > 0) {
			st += gmxAPIutils.pad2(a2) + '\'';
		}
		if (format > 1) {
			st += gmxAPIutils.pad2(a3) + '"';
		}
		return st;
	},

    /** Get point coordinates in string format with degrees
     * @memberof L.gmxUtil
     * @param {Number} lng - point longitude
     * @param {Number} lat - point latitude
     * @return {String} point coordinates in string format with degrees
    */
	latLonFormatCoordinates: function(x, y) {
        x %= 360;
        if (x > 180) { x -= 360; }
        else if (x < -180) { x += 360; }
		return  gmxAPIutils.formatDegrees(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
			gmxAPIutils.formatDegrees(Math.abs(x)) + (x > 0 ? ' E' : ' W');
	},
	latLonToString: function(x, y, prec) {
        x %= 360;
        if (x > 180) { x -= 360; }
        else if (x < -180) { x += 360; }
		if (prec) {
			x = gmxAPIutils.toPrecision(x, prec);
			y = gmxAPIutils.toPrecision(y, prec);
		}
		return  y + (y > 0 ? ' N, ' : ' S, ') +
			x + (x > 0 ? ' E' : ' W');
	},

	formatCoordinates: function(x, y) {
		return  gmxAPIutils.latLonFormatCoordinates(x, y);
	},

    /** Get point coordinates in string format
     * @memberof L.gmxUtil
     * @param {Number} lng - point longitude
     * @param {Number} lat - point latitude
     * @return {String} point coordinates in string format
    */
	latLonFormatCoordinates2: function(x, y) {
		return  gmxAPIutils.trunc(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
			gmxAPIutils.trunc(Math.abs(x)) + (x > 0 ? ' E' : ' W');
	},
	formatCoordinates2: function(x, y) {
		return  gmxAPIutils.latLonFormatCoordinates2(x, y);
	},

    getPixelScale: function(zoom) {
        return 256 / gmxAPIutils.tileSizes[zoom];
    },

    forEachPoint: function(coords, callback) {
        if (!coords || coords.length === 0) { return []; }
        var i, len, ret = [];
        if (!coords[0].length) {
            if (coords.length === 2) {
                return callback(coords);
            } else {
                for (i = 0, len = coords.length / 2; i < len; i++) {
                    ret.push(callback([coords[i * 2], coords[i * 2 + 1]]));
                }
            }
        } else {
            for (i = 0, len = coords.length; i < len; i++) {
                if (typeof coords[i] !== 'string') {
                    ret.push(gmxAPIutils.forEachPoint(coords[i], callback));
                }
            }
        }
        return ret;
    },
/*
	getQuicklookPoints: function(coord) { // получить 4 точки привязки снимка
		var d1 = Number.MAX_VALUE;
		var d2 = Number.MAX_VALUE;
		var d3 = Number.MAX_VALUE;
		var d4 = Number.MAX_VALUE;
		var x1, y1, x2, y2, x3, y3, x4, y4;
		this.forEachPoint(coord, function(p) {
			var x = p[0];
			var y = p[1];
			if ((x - y) < d1) {
				d1 = x - y;
				x1 = p[0];
				y1 = p[1];
			}
			if ((-x - y) < d2) {
				d2 = -x - y;
				x2 = p[0];
				y2 = p[1];
			}
			if ((-x + y) < d3) {
				d3 = -x + y;
				x3 = p[0];
				y3 = p[1];
			}
			if ((x + y) < d4) {
				d4 = x + y;
				x4 = p[0];
				y4 = p[1];
			}
		});
		return {x1: x1, y1: y1, x2: x2, y2: y2, x3: x3, y3: y3, x4: x4, y4: y4};
	},
*/
    getItemCenter: function(item, geoItems) {
        var bounds = item.bounds,
            min = bounds.min, max = bounds.max,
            type = item.type,
            isPoint = type === 'POINT' || type === 'MULTIPOINT',
            center = isPoint ? [min.x, min.y] : [(min.x + max.x) / 2, (min.y + max.y) / 2];

        if (type === 'MULTIPOLYGON') {
			return center;
		} else if (type === 'POLYGON') {
            for (var i = 0, len = geoItems.length; i < len; i++) {
                var it = geoItems[i],
                    geom = it.geo,
                    coords = geom.coordinates,
                    dataOption = it.dataOption,
                    bbox = dataOption.bounds;

                if (bbox.contains(center)) {
                    if (geom.type === 'POLYGON') { coords = [coords]; }
                    for (var j = 0, len1 = coords.length; j < len1; j++) {
                        for (var j1 = 0, coords1 = coords[j], len2 = coords1.length; j1 < len2; j1++) {
                            var pt = gmxAPIutils.getHSegmentsInPolygon(center[1], coords1[j1]);
                            if (pt) {
                                return pt.max.center;
                            }
                        }
                    }
                }
            }
        } else if (type === 'POINT' || type === 'MULTIPOINT') {
            return center;
        } else if (type === 'LINESTRING' || type === 'MULTILINESTRING') {
            return center;
        }
        return null;
    },

    getHSegmentsInPolygon: function(y, poly) {
        var s = [], i, len, out,
            vectorSize = 1,
            p1 = poly[0];

        if (typeof poly[0] === 'number') {
            vectorSize = 2;
            p1 = [poly[0], poly[1]];
        }
        var isGt1 = y > p1[1];
        for (i = vectorSize, len = poly.length; i < len; i += vectorSize) {
            var p2 = vectorSize === 1 ? poly[i] : [poly[i], poly[i + 1]],
                isGt2 = y > p2[1];
            if (isGt1 !== isGt2) {
                s.push(p1[0] - (p1[0] - p2[0]) * (p1[1] - y) / (p1[1] - p2[1]));
            }
            p1 = p2;
            isGt1 = isGt2;
        }
        len = s.length;
        if (len) {
            s = s.sort();
            var max = 0,
                index = -1;
            for (i = 1; i < len; i += 2) {
                var j = i - 1,
                    d = Math.abs(s[i] - s[j]);
                if (d > max) {
                    max = d;
                    index = j;
                }
            }
            out = {
                y: y,
                segArr: s,
                max: {
                    width: max,
                    center: [(s[index] + s[index + 1]) / 2, y]
                }
            };
        }
        return out;
    },

    isPointInPolygonArr: function(chkPoint, coords) { // Проверка точки на принадлежность полигону в виде массива
        var isIn = false,
            x = chkPoint[0],
            y = chkPoint[1],
            vectorSize = 1,
            p1 = coords[0];

        if (typeof coords[0] === 'number') {
            vectorSize = 2;
            p1 = [coords[0], coords[1]];
        }

        for (var i = vectorSize, len = coords.length; i < len; i += vectorSize) {
            var p2 = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                xmin = Math.min(p1[0], p2[0]),
                xmax = Math.max(p1[0], p2[0]),
                ymax = Math.max(p1[1], p2[1]);
            if (x > xmin && x <= xmax && y <= ymax && p1[0] !== p2[0]) {
                var xinters = (x - p1[0]) * (p2[1] - p1[1]) / (p2[0] - p1[0]) + p1[1];
                if (p1[1] === p2[1] || y <= xinters) { isIn = !isIn; }
            }
            p1 = p2;
        }
        return isIn;
    },

    /** Is point in polygon with holes
     * @memberof L.gmxUtil
     * @param {chkPoint} chkPoint - point in [x, y] format
     * @param {coords} coords - polygon from geoJSON coordinates data format
     * @return {Boolean} true if polygon contain chkPoint
    */
    isPointInPolygonWithHoles: function(chkPoint, coords) {
        if (!gmxAPIutils.isPointInPolygonArr(chkPoint, coords[0])) { return false; }
        for (var j = 1, len = coords.length; j < len; j++) {
            if (gmxAPIutils.isPointInPolygonArr(chkPoint, coords[j])) { return false; }
        }
        return true;
    },

    /** Is polygon clockwise
     * @memberof L.gmxUtil
     * @param {ring} ring - ring from geoJSON coordinates data format
     * @return {Boolean} true if ring is clockwise
    */
    isClockwise: function(ring) {
        var area = 0;
        for (var i = 0, j, len = ring.length; i < len; i++) {
            j = (i + 1) % len;
            area += ring[i][0] * ring[j][1];
            area -= ring[j][0] * ring[i][1];
        }
        return (area < 0);
    },

    isPointInPolyLine: function(chkPoint, lineHeight, coords, hiddenLines) {
        // Проверка точки(с учетом размеров) на принадлежность линии
        var dx = chkPoint[0], dy = chkPoint[1],
            nullPoint = {x: dx, y: dy},
            minx = dx - lineHeight, maxx = dx + lineHeight,
            miny = dy - lineHeight, maxy = dy + lineHeight,
            cntHide = 0;

        lineHeight *= lineHeight;
        for (var i = 1, len = coords.length; i < len; i++) {
            if (hiddenLines && i === hiddenLines[cntHide]) {
                cntHide++;
            } else {
                var p1 = coords[i - 1], p2 = coords[i],
                    x1 = p1[0], y1 = p1[1],
                    x2 = p2[0], y2 = p2[1];

                if (!(Math.max(x1, x2) < minx
                    || Math.min(x1, x2) > maxx
                    || Math.max(y1, y2) < miny
                    || Math.min(y1, y2) > maxy)) {
                    var sqDist = L.LineUtil._sqClosestPointOnSegment(nullPoint, {x: x1, y: y1}, {x: x2, y: y2}, true);
                    if (sqDist < lineHeight) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    isPointInLines: function (attr) {
        var arr = attr.coords,
            point = attr.point,
            delta = attr.delta,
            boundsArr = attr.boundsArr,
            hidden = attr.hidden;
        for (var j = 0, len = arr.length, flag = false; j < len; j++) {
            flag = boundsArr[j] ? boundsArr[j].contains(point) : true;
            if (flag
                && gmxAPIutils.isPointInPolyLine(point, delta, arr[j], hidden ? hidden[j] : null)
            ) {
               return true;
            }
        }
        return false;
    },

    /** Get length
     * @memberof L.gmxUtil
     * @param {Array} latlngs array
     * @param {Boolean} isMerc - true if coordinates in Mercator
     * @param {Boolean} isWebMerc - true if coordinates in WebMercator	- TODO
     * @return {Number} length
    */
    getLength: function(latlngs, isMerc) {
        var length = 0;
        if (latlngs && latlngs.length) {
            var lng = false,
                lat = false;

            isMerc = isMerc === undefined || isMerc;
            latlngs.forEach(function(latlng) {
                if (L.Util.isArray(latlng)) {
                    if (L.Util.isArray(latlng[0])) {
                        length += gmxAPIutils.getLength(latlng, isMerc);
                        return length;
                    } else if (isMerc) {   // From Mercator array
                        latlng = L.Projection.Mercator.unproject({x: latlng[0], y: latlng[1]});
                    }
                }
                if (lng !== false && lat !== false) {
                    length += parseFloat(gmxAPIutils.distVincenty(lng, lat, latlng.lng, latlng.lat));
                }
                lng = latlng.lng;
                lat = latlng.lat;
            });
        }
        return length;
    },
    getText: function(str) {
		str = str || '';
        if (L.gmxLocale) { return L.gmxLocale.getText(str); }
		return str.split('.').pop();
	},

    /** Get prettify length
     * @memberof L.gmxUtil
     * @param {Number} area
     * @param {String} type: ('km', 'm', 'nm')
     * @return {String} prettify length
    */
    prettifyDistance: function(length, type) {
        var km = ' ' + gmxAPIutils.getText('units.km');
        if (type === 'nm') {
            return (Math.round(0.539956803 * length) / 1000) + ' ' + gmxAPIutils.getText('units.nm');
        } else if (type === 'km') {
            return (Math.round(length) / 1000) + km;
        } else if (length < 2000 || type === 'm') {
            return Math.round(length) + ' ' + gmxAPIutils.getText('units.m');
        } else if (length < 200000) {
            return (Math.round(length / 10) / 100) + km;
        }
        return Math.round(length / 1000) + km;
    },

    /** Get geoJSON length
     * @memberof L.gmxUtil
     * @param {Object} geoJSON - object in <a href="http://geojson.org/geojson-spec.html">GeoJSON format</a>
     * @return {Number} length
    */
    geoJSONGetLength: function(geoJSON) {
        var out = 0,
            i, j, len, len1, coords;

        if (geoJSON.type === 'GeometryCollection') {
            out += geoJSON.geometries.forEach(gmxAPIutils.geoJSONGetLength);
        } else if (geoJSON.type === 'Feature') {
            out += gmxAPIutils.geoJSONGetLength(geoJSON.geometry);
        } else if (geoJSON.type === 'FeatureCollection') {
            out += geoJSON.features.forEach(gmxAPIutils.geoJSONGetLength);
        } if (geoJSON.type === 'LineString' || geoJSON.type === 'MultiLineString') {
            coords = geoJSON.coordinates;
            if (geoJSON.type === 'LineString') { coords = [coords]; }
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.getRingLength(coords[i]);
            }
        } if (geoJSON.type === 'Polygon' || geoJSON.type === 'MultiPolygon') {
            coords = geoJSON.coordinates;
            if (geoJSON.type === 'Polygon') { coords = [coords]; }
            for (i = 0, len = coords.length; i < len; i++) {
                for (j = 0, len1 = coords[i].length; j < len1; j++) {
                    out += gmxAPIutils.getRingLength(coords[i][j]);
                }
            }
        }
        return out;
    },

    getRingLength: function(coords) {
        var length = 0;
        if (coords && coords.length) {
            var lng = false, lat = false;
            coords.forEach(function(lnglat) {
                if (L.Util.isArray(lnglat)) {
                    if (lnglat.length > 2) {
                        length += gmxAPIutils.getRingLength(lnglat);
                        return length;
                    }
                }
                if (lng !== false && lat !== false) {
                    length += parseFloat(gmxAPIutils.distVincenty(lng, lat, lnglat[0], lnglat[1]));
                }
                lng = lnglat[0];
                lat = lnglat[1];
            });
        }
        return length;
    },

    /** Get geoJSON area
     * @memberof L.gmxUtil
     * @param {Object} geojson - object in <a href="http://geojson.org/geojson-spec.html">GeoJSON format</a>
     * @return {Number} area in square meters
    */
    geoJSONGetArea: function(geoJSON) {
        var out = 0;

        if (geoJSON.type === 'GeometryCollection') {
            out += geoJSON.geometries.forEach(gmxAPIutils.geoJSONGetArea);
        } else if (geoJSON.type === 'Feature') {
            out += gmxAPIutils.geoJSONGetArea(geoJSON.geometry);
        } else if (geoJSON.type === 'FeatureCollection') {
            out += geoJSON.features.forEach(gmxAPIutils.geoJSONGetArea);
        } if (geoJSON.type === 'Polygon' || geoJSON.type === 'MultiPolygon') {
            var coords = geoJSON.coordinates;
            if (geoJSON.type === 'Polygon') { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.getRingArea(coords[i][0]);
                for (var j = 1, len1 = coords[i].length; j < len1; j++) {
                    out -= gmxAPIutils.getRingArea(coords[i][j]);
                }
            }
        }
        return out;
    },

    geoJSONGetLatLng: function(geoJSON) {
        if (geoJSON.type === 'Feature') {
            return gmxAPIutils.geoJSONGetLatLng(geoJSON.geometry);
        } else if (geoJSON.type === 'Point') {
            return L.latLng(geoJSON.coordinates[1], geoJSON.coordinates[0]);
        } else {
            throw new Error('cannot get ' + geoJSON.type + ' latLng');
        }
    },

    getRingArea: function(coords) {
        var area = 0;
        for (var i = 0, len = coords.length; i < len; i++) {
            var ipp = (i === (len - 1) ? 0 : i + 1),
                p1 = coords[i], p2 = coords[ipp];
            area += p1[0] * Math.sin(gmxAPIutils.degRad(p2[1])) - p2[0] * Math.sin(gmxAPIutils.degRad(p1[1]));
        }
        var out = Math.abs(area * gmxAPIutils.lambertCoefX * gmxAPIutils.lambertCoefY / 2);
        return out;
    },

    /** Get area
     * @memberof L.gmxUtil
     * @param {Array} L.latLng array
     * @return {Number} area in square meters
    */
    getArea: function(arr) {
        var area = 0;
        for (var i = 0, len = arr.length; i < len; i++) {
            var ipp = (i === (len - 1) ? 0 : i + 1),
                p1 = arr[i], p2 = arr[ipp];
            area += p1.lng * Math.sin(gmxAPIutils.degRad(p2.lat)) - p2.lng * Math.sin(gmxAPIutils.degRad(p1.lat));
        }
        return Math.abs(area * gmxAPIutils.lambertCoefX * gmxAPIutils.lambertCoefY / 2);
    },

    /** Get prettified size of area
     * @memberof L.gmxUtil
     * @param {Number} area in square meters
     * @param {String} type: ('km2', 'ha', 'm2')
     * @return {String} prettified area
    */
    prettifyArea: function(area, type) {
        var km2 = ' ' + gmxAPIutils.getText('units.km2');

        if (type === 'km2') {
            return ('' + (Math.round(area / 100) / 10000)) + km2;
        } else if (type === 'ha') {
            return ('' + (Math.round(area / 100) / 100)) + ' ' + gmxAPIutils.getText('units.ha');
        } else if (area < 100000 || type === 'm2') {
            return Math.round(area) + ' ' + gmxAPIutils.getText('units.m2');
        } else if (area < 3000000) {
            return ('' + (Math.round(area / 1000) / 1000)).replace('.', ',') + km2;
        } else if (area < 30000000) {
            return ('' + (Math.round(area / 10000) / 100)).replace('.', ',') + km2;
        } else if (area < 300000000) {
            return ('' + (Math.round(area / 100000) / 10)).replace('.', ',') + km2;
        }
        return (Math.round(area / 1000000)) + km2;
    },

    geoLength: function(geom) {
        var ret = 0,
            type = geom.type;
        if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            for (var i = 0, len = geom.coordinates.length; i < len; i++) {
                ret += gmxAPIutils.geoLength({type: 'LINESTRING', coordinates: geom.coordinates[i]});
            }
            return ret;
        } else if (type === 'LINESTRING' || type === 'LineString') {
            ret = gmxAPIutils.getLength(geom.coordinates);
        }
        return ret;
    },

    /** Converts Geomixer geometry to geoJSON geometry
     * @memberof L.gmxUtil
     * @param {Object} geometry - Geomixer geometry
     * @param {Boolean} mercFlag - true if coordinates in Mercator
     * @param {Boolean} webmercFlag - true if coordinates in WebMercator
     * @return {Object} geoJSON geometry
    */
    geometryToGeoJSON: function (geom, mercFlag, webmercFlag) {
        if (!geom) {
            return null;
        }

        var type = geom.type === 'MULTIPOLYGON' ? 'MultiPolygon'
                : geom.type === 'POLYGON' ? 'Polygon'
                : geom.type === 'MULTILINESTRING' ? 'MultiLineString'
                : geom.type === 'LINESTRING' ? 'LineString'
                : geom.type === 'MULTIPOINT' ? 'MultiPoint'
                : geom.type === 'POINT' ? 'Point'
                : geom.type,
            coords = geom.coordinates;
        if (mercFlag) {
            coords = gmxAPIutils.coordsFromMercator(type, coords, webmercFlag);
        }
        return {
            type: type,
            coordinates: coords
        };
    },

    convertGeometry: function (geom, fromMerc, webmercFlag) {
        var type = geom.type === 'MULTIPOLYGON' ? 'MultiPolygon'
                : geom.type === 'POLYGON' ? 'Polygon'
                : geom.type === 'MULTILINESTRING' ? 'MultiLineString'
                : geom.type === 'LINESTRING' ? 'LineString'
                : geom.type === 'MULTIPOINT' ? 'MultiPoint'
                : geom.type === 'POINT' ? 'Point'
                : geom.type,
            coords = geom.coordinates;
        if (fromMerc) {
            coords = gmxAPIutils.coordsFromMercator(type, coords, webmercFlag);
        } else {
            coords = gmxAPIutils.coordsToMercator(type, coords, webmercFlag);
        }
        return {
            type: geom.type,
            coordinates: coords
        };
    },

    /** Converts GeoJSON object into GeoMixer format
     * @memberof L.gmxUtil
     * @param {Object} geometry - GeoJSON object
     * @param {Boolean} mercFlag - true if resulting Geomixer object should has coordinates in Mercator projection
     * @return {Object} Geometry in GeoMixer format
    */
    geoJSONtoGeometry: function (geoJSON, mercFlag) {
        if (geoJSON.type === 'FeatureCollection') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.features[0], mercFlag);
        } else if (geoJSON.type === 'Feature') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.geometry, mercFlag);
        } else if (geoJSON.type === 'FeatureCollection') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.features[0], mercFlag);
        }

        var type = geoJSON.type === 'MultiPolygon' ? 'MULTIPOLYGON'
                : geoJSON.type === 'Polygon' ? 'POLYGON'
                : geoJSON.type === 'MultiLineString' ? 'MULTILINESTRING'
                : geoJSON.type === 'LineString' ? 'LINESTRING'
                : geoJSON.type === 'MultiPoint' ? 'MULTIPOINT'
                : geoJSON.type === 'Point' ? 'POINT'
                : geoJSON.type,
            coords = geoJSON.coordinates;
        if (mercFlag) {
            coords = gmxAPIutils.coordsToMercator(geoJSON.type, coords);
        }
        return {
            type: type,
            coordinates: coords
        };
    },

    _coordsConvert: function(type, coords, toMerc, webmercFlag) {
        var i, len, p,
            resCoords = [];
        if (type === 'Point') {
            if (toMerc) {
                p = (webmercFlag ? L.CRS.EPSG3857 : L.Projection.Mercator).project({lat: coords[1], lng: coords[0]});
                resCoords = [p.x, p.y];
            } else {
                p = L.Projection.Mercator.unproject({y: coords[1], x: coords[0]});
                resCoords = [p.lng, p.lat];
				if (webmercFlag) {
					resCoords[1] = gmxAPIutils.fromWebMercY(coords[1]);
				}
            }
        } else if (type === 'LineString' || type === 'MultiPoint') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('Point', coords[i], toMerc, webmercFlag));
            }
        } else if (type === 'Polygon' || type === 'MultiLineString') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('MultiPoint', coords[i], toMerc, webmercFlag));
            }
        } else if (type === 'MultiPolygon') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('Polygon', coords[i], toMerc, webmercFlag));
            }
        }
        return resCoords;
    },

    coordsFromMercator: function(type, coords, webmercFlag) {
        return gmxAPIutils._coordsConvert(type, coords, false, webmercFlag);
    },

    coordsToMercator: function(type, coords, webmercFlag) {
        return gmxAPIutils._coordsConvert(type, coords, true, webmercFlag);
    },

    transformGeometry: function(geom, callback) {
        return !geom ? geom : {
            type: geom.type,
            coordinates: gmxAPIutils.forEachPoint(geom.coordinates, function(p) {
                return callback(p);
            })
        };
    },

    /** Get area for geometry
     * @memberof L.gmxUtil
     * @param {Object} geometry
     * @param {Boolean} [isMerc=true] - true if coordinates in Mercator
     * @param {Boolean} isWebMerc - true if coordinates in WebMercator	- TODO
     * @return {Number} area in square meters
    */
    geoArea: function(geom, isMerc) {
        var i, len, ret = 0,
            type = geom.type || '';
        isMerc = isMerc === undefined || isMerc;
        if (type === 'MULTIPOLYGON' || type === 'MultiPolygon') {
            for (i = 0, len = geom.coordinates.length; i < len; i++) {
                ret += gmxAPIutils.geoArea({type: 'POLYGON', coordinates: geom.coordinates[i]}, isMerc);
            }
            return ret;
        } else if (type === 'POLYGON' || type === 'Polygon') {
            ret = gmxAPIutils.geoArea(geom.coordinates[0], isMerc);
            for (i = 1, len = geom.coordinates.length; i < len; i++) {
                ret -= gmxAPIutils.geoArea(geom.coordinates[i], isMerc);
            }
            return ret;
        } else if (geom.length) {
            var latlngs = [],
                vectorSize = typeof geom[0] === 'number' ? 2 : 1;

            for (i = 0, len = geom.length; i < len; i += vectorSize) {
                var p = vectorSize === 1 ? geom[i] : [geom[i], geom[i + 1]];
                latlngs.push(
                    isMerc ?
                    L.Projection.Mercator.unproject({y: p[1], x: p[0]}) :
                    {lat: p[1], lng: p[0]}
                );
            }
            return gmxAPIutils.getArea(latlngs);
        }
        return 0;
    },

    /** Get summary for geoJSON geometry
     * @memberof L.gmxUtil
     * @param {Object} geoJSON geometry
     * @param {Object} unitOptions {
     *                  distanceUnit: '',   // m - meters, km - kilometers, nm - nautilus miles, auto - default
     *                  squareUnit: ''      // m2 - square meters, km2 - square kilometers, ha - hectares, auto - default
     *               }
     * @return {String} Summary string for geometry
    */
    getGeoJSONSummary: function(geom, unitOptions) {
        var type = geom.type,
            units = unitOptions || {},
            out = 0,
            i, len, coords;
        if (type === 'Point') {
            coords = geom.coordinates;
            out = gmxAPIutils.formatCoordinates(coords[0], coords[1]);
        } else if (type === 'Polygon') {
            out = gmxAPIutils.prettifyArea(gmxAPIutils.geoArea(geom, false), units.squareUnit);
        } else if (type === 'MultiPolygon') {
            coords = geom.coordinates;
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.geoArea({type: 'Polygon', coordinates: coords[i]}, false);
            }
            out = gmxAPIutils.prettifyArea(out, units.squareUnit);
        } else if (type === 'LineString') {
            out = gmxAPIutils.prettifyDistance(gmxAPIutils.geoJSONGetLength(geom), units.distanceUnit);
        } else if (type === 'MultiLineString') {
            coords = geom.coordinates;
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.geoJSONGetLength({type: 'LineString', coordinates: coords[i]});
            }
            out = gmxAPIutils.prettifyDistance(out, units.distanceUnit);
        }
        return out;
    },

    /** Get summary for point
     * @memberof L.gmxUtil
     * @param {latlng} point
     * @param {num} format number:
     *         0: 62°52'30.68" N, 22°48'27.42" E
     *         1: 62.875188 N, 22.807617 E
     *         2: 2538932, 9031643 (EPSG:3395)
     *         3: 2538932, 9069712 (EPSG:3857)
     * @return {String} Summary string for LatLng point
    */
    getCoordinatesString: function(latlng, num) {
        var x = latlng.lng,
            y = latlng.lat,
            formats = [
                '',
                '',
                ' (EPSG:3395)',
                ' (EPSG:3857)'
            ],
            len = formats.length,
            merc,
            out = '';
        num = num || 0;
        if (x > 180) { x -= 360; }
        if (x < -180) { x += 360; }
        if (num % len === 0) {
            out = gmxAPIutils.formatCoordinates2(x, y);
        } else if (num % len === 1) {
            out = gmxAPIutils.formatCoordinates(x, y);
        } else if (num % len === 2) {
            merc = L.Projection.Mercator.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[2];
        } else {
            merc = L.CRS.EPSG3857.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[3];
        }
        return out;
    },

    /** Get summary for geometries array
     * @memberof L.gmxUtil
     * @param {Array} geometries array in Geomixer format
     * @param {Object} units Options for length and area
     * @return {String} Summary string for geometries array
    */
    getGeometriesSummary: function(arr, unitOptions) {
        var out = '',
            type = '',
            res = 0;
        if (!unitOptions) { unitOptions = {}; }
        if (arr) {
            arr.forEach(function(geom) {
                if (geom) {
                    type = geom.type.toUpperCase();
					var latLngGeometry = L.gmxUtil.geometryToGeoJSON(geom, true, unitOptions.srs == 3857);
                    if (type.indexOf('POINT') !== -1) {
                        var latlng = L.latLng(latLngGeometry.coordinates.reverse());
                        out = '<b>' + gmxAPIutils.getText('Coordinates') + '</b>: '
                            + gmxAPIutils.getCoordinatesString(latlng, unitOptions.coordinatesFormat);
                    } else if (type.indexOf('LINESTRING') !== -1) {
                        res += gmxAPIutils.geoJSONGetLength(latLngGeometry);
                    } else if (type.indexOf('POLYGON') !== -1) {
                        res += gmxAPIutils.geoJSONGetArea(latLngGeometry);
                    }
                }
            });
        }
        if (!out) {
            if (type.indexOf('LINESTRING') !== -1) {
                out = '<b>' + gmxAPIutils.getText('Length') + '</b>: '
                    + gmxAPIutils.prettifyDistance(res, unitOptions.distanceUnit);
            } else if (type.indexOf('POLYGON') !== -1) {
                out = '<b>' + gmxAPIutils.getText('Area') + '</b>: '
                    + gmxAPIutils.prettifyArea(res, unitOptions.squareUnit);
            }
        }
        return out;
    },

    getGeometrySummary: function(geom, unitOptions) {
        return gmxAPIutils.getGeometriesSummary([geom], unitOptions || {});
    },

    chkOnEdge: function(p1, p2, ext) { // отрезок на границе
        if ((p1[0] < ext.min.x && p2[0] < ext.min.x) || (p1[0] > ext.max.x && p2[0] > ext.max.x)) { return true; }
        if ((p1[1] < ext.min.y && p2[1] < ext.min.y) || (p1[1] > ext.max.y && p2[1] > ext.max.y)) { return true; }
        return false;
    },

    getHidden: function(coords, tb) {  // массив точек на границах тайлов
        var hiddenLines = [],
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            prev = null;
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var p = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]];
            if (prev && gmxAPIutils.chkOnEdge(p, prev, tb)) {
                hiddenLines.push(i);
            }
            prev = p;
        }
        return hiddenLines;
    },

    getNormalizeBounds: function (screenBounds, mercDeltaY) { // get bounds array from -180 180 lng
        var northWest = screenBounds.getNorthWest(),
            southEast = screenBounds.getSouthEast(),
            minX = northWest.lng,
            maxX = southEast.lng,
            w = (maxX - minX) / 2,
            minX1 = null,
            maxX1 = null,
            out = [];

        if (w >= 180) {
            minX = -180; maxX = 180;
        } else if (maxX > 180 || minX < -180) {
            var center = ((maxX + minX) / 2) % 360;
            if (center > 180) { center -= 360; }
            else if (center < -180) { center += 360; }
            minX = center - w; maxX = center + w;
            if (minX < -180) {
                minX1 = minX + 360; maxX1 = 180; minX = -180;
            } else if (maxX > 180) {
                minX1 = -180; maxX1 = maxX - 360; maxX = 180;
            }
        }
        var m1 = {x: minX, y: southEast.lat},
            m2 = {x: maxX, y: northWest.lat};

        if (mercDeltaY !== undefined) {
            m1 = L.Projection.Mercator.project(new L.LatLng([southEast.lat, minX]));
            m2 = L.Projection.Mercator.project(new L.LatLng([northWest.lat, maxX]));
            m1.y -= mercDeltaY;
            m2.y -= mercDeltaY;
        }
        out.push(gmxAPIutils.bounds([[m1.x, m1.y], [m2.x, m2.y]]));

        if (minX1) {
            var m11 = {x: minX1, y: southEast.lat},
                m12 = {x: maxX1, y: northWest.lat};
            if (mercDeltaY !== undefined) {
                m11 = L.Projection.Mercator.project(new L.LatLng([southEast.lat, minX1]));
                m12 = L.Projection.Mercator.project(new L.LatLng([northWest.lat, maxX1]));
                m11.y -= mercDeltaY;
                m12.y -= mercDeltaY;
            }
            out.push(gmxAPIutils.bounds([[m11.x, m11.y], [m12.x, m12.y]]));
        }
        return out;
    },

    toPrecision: function(x, prec) {
        var zn = Math.pow(10, prec ? prec : 4);
        return Math.round(zn * x) / zn;
    },
	getBoundsByTilePoint: function(tPoint) {  //tPoint - OSM tile point
		var gmt = gmxAPIutils.getTileNumFromLeaflet(tPoint);
		return gmxAPIutils.getTileBounds(gmt.x, gmt.y, gmt.z);
	},
    getTileBounds: function(x, y, z) {  //x, y, z - GeoMixer tile coordinates
        var tileSize = gmxAPIutils.tileSizes[z],
            minx = x * tileSize,
            miny = y * tileSize;
        return gmxAPIutils.bounds([[minx, miny], [minx + tileSize, miny + tileSize]]);
    },

    parseTemplate: function(str, properties) {
        var matches = str.match(/\[([^\]]+)\]/ig);
        if (matches) {
            for (var i = 0, len = matches.length; i < len; i++) {
                var key1 = matches[i],
                    key = key1.substr(1, key1.length - 2),
                    res = key in properties ? properties[key] : '';

                str = str.replace(key1, res);
            }
        }
        return str;
    },

    getDefaultBalloonTemplate: function(properties, tileAttributeTypes) {
        var str = '';
        for (var key in properties) {
            if (!tileAttributeTypes || (key in tileAttributeTypes)) {
				str += '<b>' + key + ':</b> [' +  key + ']<br />';
			}
        }
        str += '<br />[SUMMARY]<br />';
        return str;
    },

    parseBalloonTemplate: function(str, options) {
        var properties = options.properties;

        if (!str) {
            str = gmxAPIutils.getDefaultBalloonTemplate(properties, options.tileAttributeTypes);
        }
        var matches = str.match(/\[([^\]]+)\]/ig);
        if (matches) {
            var tileAttributeTypes = options.tileAttributeTypes,
                unitOptions = options.unitOptions,
                geometries = options.geometries;
            for (var i = 0, len = matches.length; i < len; i++) {
                var key1 = matches[i],
                    key = key1.substr(1, key1.length - 2),
                    res = '';

                if (key in properties) {
                    res = L.gmxUtil.attrToString(tileAttributeTypes[key], properties[key]);
                } else if (key === 'SUMMARY') {
                    res = options.summary || L.gmxUtil.getGeometriesSummary(geometries, unitOptions);
                }
                str = str.replace(key1, res);
            }
        }
        return str;
    },

    styleKeys: {
        marker: {
            server: ['image',   'angle',     'scale',     'minScale',     'maxScale',     'size',         'circle',     'center',     'color'],
            client: ['iconUrl', 'iconAngle', 'iconScale', 'iconMinScale', 'iconMaxScale', 'iconSize', 'iconCircle', 'iconCenter', 'iconColor']
        },
        outline: {
            server: ['color',  'opacity',   'thickness', 'dashes'],
            client: ['color',  'opacity',   'weight',    'dashArray']
        },
        fill: {
            server: ['color',     'opacity',   'image',       'pattern',     'radialGradient',     'linearGradient'],
            client: ['fillColor', 'fillOpacity', 'fillIconUrl', 'fillPattern', 'fillRadialGradient', 'fillLinearGradient']
        },
        label: {
            server: ['text',      'field',      'template',      'color',      'haloColor',      'size',          'spacing',      'align'],
            client: ['labelText', 'labelField', 'labelTemplate', 'labelColor', 'labelHaloColor', 'labelFontSize', 'labelSpacing', 'labelAlign']
        }
    },
    styleFuncKeys: {
        iconSize: 'iconSizeFunction',
        iconAngle: 'rotateFunction',
        iconScale: 'scaleFunction',
        iconColor: 'iconColorFunction',
        opacity: 'opacityFunction',
        fillOpacity: 'fillOpacityFunction',
        color: 'colorFunction',
        fillColor: 'fillColorFunction'
    },
    styleFuncError: {
        iconSize: function() { return 8; },
        iconAngle: function() { return 0; },
        iconScale: function() { return 1; },
        iconColor: function() { return 0xFF; },
        opacity: function() { return 1; },
        fillOpacity: function() { return 0.5; },
        color: function() { return 0xFF; },
        fillColor: function() { return 0xFF; }
    },
    defaultStyles: {
       MinZoom: 1,
       MaxZoom: 21,
       Filter: '',
       Balloon: '',
       DisableBalloonOnMouseMove: true,
       DisableBalloonOnClick: false,
       RenderStyle: {
            point: {    // old = {outline: {color: 255, thickness: 1}, marker:{size: 8}},
                color: 0xFF,
                weight: 1,
                iconSize: 8
            },
            linestring: {    // old = {outline: {color: 255, thickness: 1}},
                color: 0xFF,
                weight: 1
            },
            polygon: {    // old = {outline: {color: 255, thickness: 1}},
                color: 0xFF,
                weight: 1
            }
        }
    },

    getDefaultStyle: function(type) {
        var from = gmxAPIutils.defaultStyles,
            out = L.extend({}, from);
        out.RenderStyle = from.RenderStyle[type];
        return out;
    },

    toServerStyle: function(style) {   // Style leaflet->Scanex
        var out = {};

        for (var key in gmxAPIutils.styleKeys) {
            var keys = gmxAPIutils.styleKeys[key];
            for (var i = 0, len = keys.client.length; i < len; i++) {
                var key1 = keys.client[i];
                if (key1 in style) {
                    if (!out[key]) { out[key] = {}; }
                    var zn = style[key1];
                    if (key1 === 'opacity' || key1 === 'fillOpacity') {
                        zn *= 100;
                    }
                    out[key][keys.server[i]] = zn;
                }
            }
        }
        if ('iconAnchor' in style) {
            if (!out.marker) { out.marker = {}; }
            out.marker.dx = -style.iconAnchor[0];
            out.marker.dy = -style.iconAnchor[1];
        }
        return out;
    },

    fromServerStyle: function(style) {   // Style Scanex->leaflet
        var st, i, len, key, key1,
            out = {
                type: ''    // 'polygon', 'line', 'circle', 'square', 'image'
            };

        for (key in gmxAPIutils.styleKeys) {
            var keys = gmxAPIutils.styleKeys[key];
            for (i = 0, len = keys.client.length; i < len; i++) {
                key1 = keys.client[i];
                if (key1 in style) {
                    out[key1] = style[key1];
                }
            }
            st = style[key];
            if (st && typeof (st) === 'object') {
                for (i = 0, len = keys.server.length; i < len; i++) {
                    key1 = keys.server[i];
                    if (key1 in st) {
                        var newKey = keys.client[i],
                            zn = st[key1];
                        if (typeof (zn) === 'string') {
                            if (gmxAPIutils.styleFuncKeys[newKey]) {
/*eslint-disable no-useless-escape */
                                if (zn.match(/[^\d\.]/) === null) {
/*eslint-enable */
                                    zn = Number(zn);
                                } else {
                                    var func = L.gmx.Parsers.parseExpression(zn);
                                    if (func === null) {
                                        zn = gmxAPIutils.styleFuncError[newKey]();
                                    } else {
                                        out[gmxAPIutils.styleFuncKeys[newKey]] = func;
                                    }
                                }
                            }
                        } else if (key1 === 'opacity') {
                            zn /= 100;
                        }
                        out[newKey] = zn;
                    }
                }
            }
        }
        if (style.marker) {
            st = style.marker;
            if ('dx' in st || 'dy' in st) {
                var dx = st.dx || 0,
                    dy = st.dy || 0;
                out.iconAnchor = [-dx, -dy];    // For leaflet type iconAnchor
            }
        }
        for (key in style) {
			if (!gmxAPIutils.styleKeys[key]) {
				out[key] = style[key];
			}
        }
        return out;
    },

    getUnixTimeFromStr: function(st) {
		var arr1 = L.Util.trim(st).split(' '),
			arr = arr1[0].split('.'),
			tm = arr1[1] ? arr1[1].split(':') : [0, 0, 0];

        if (arr[2].length === 4) {
			arr = arr.reverse();
		}
		return Date.UTC(arr[0], arr[1] - 1, arr[2], tm[0] || 0, tm[1] || 0, tm[2] || 0) / 1000;
    },

    getDateFromStr: function(st) {
		var arr = L.Util.trim(st).split(' ');
		arr = arr[0].split('.');

        if (arr[2].length === 4) {
			arr = arr.reverse();
		}
		var dt = new Date(arr[0], arr[1] - 1, arr[2]);
        return dt;
    },

    getUTCdate: function(utime) {
        var dt = new Date(utime * 1000);

        return [
            dt.getUTCFullYear(),
            gmxAPIutils.pad2(dt.getUTCMonth() + 1),
            gmxAPIutils.pad2(dt.getUTCDate())
        ].join('.');
    },

    getUTCtime: function(utime) {
        var h = Math.floor(utime / 3600),
            m = Math.floor((utime - h * 3600) / 60),
            s = Math.floor(utime - h * 3600 - m * 60);

        return [
            //gmxAPIutils.pad2(h - new Date().getTimezoneOffset() / 60),
            gmxAPIutils.pad2(h),
            gmxAPIutils.pad2(m),
            gmxAPIutils.pad2(s)
        ].join(':');
    },

    getUTCdateTime: function(utime) {
        var time = utime % (3600 * 24);

        if (time) {
            return [
                gmxAPIutils.getUTCdate(utime),
                gmxAPIutils.getUTCtime(utime % (3600 * 24))
            ].join(' ');
        } else {
            return gmxAPIutils.getUTCdate(utime);
        }
    },

    attrToString: function(type, value) {
        if (type === 'date') {
            return value ? L.gmxUtil.getUTCdate(value) : value;
        } else if (type === 'time') {
            return value ? L.gmxUtil.getUTCtime(value) : value;
        } else if (type === 'datetime') {
            return value ? L.gmxUtil.getUTCdateTime(value) : value;
        } else {
            return value;
        }
    },

    getTileAttributes: function(prop) {
        var tileAttributeIndexes = {},
            tileAttributeTypes = {};
        if (prop.attributes) {
            var attrs = prop.attributes,
                attrTypes = prop.attrTypes || null;
            if (prop.identityField) { tileAttributeIndexes[prop.identityField] = 0; }
            for (var a = 0; a < attrs.length; a++) {
                var key = attrs[a];
                tileAttributeIndexes[key] = a + 1;
                tileAttributeTypes[key] = attrTypes ? attrTypes[a] : 'string';
            }
        }
        return {
            tileAttributeTypes: tileAttributeTypes,
            tileAttributeIndexes: tileAttributeIndexes
        };
    }
};

gmxAPIutils.lambertCoefX = 100 * gmxAPIutils.distVincenty(0, 0, 0.01, 0);				// 111319.5;
gmxAPIutils.lambertCoefY = 100 * gmxAPIutils.distVincenty(0, 0, 0, 0.01) * 180 / Math.PI;	// 6335440.712613423;

(function() {
    //pre-calculate tile sizes
    for (var z = 0; z < 30; z++) {
        gmxAPIutils.tileSizes[z] = gmxAPIutils.worldWidthFull / Math.pow(2, z);
    }
})();
gmxAPIutils.worldWidthMerc = gmxAPIutils.worldWidthFull / 2;

gmxAPIutils.Bounds = function(arr) {
    this.min = {
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE
    };
    this.max = {
        x: -Number.MAX_VALUE,
        y: -Number.MAX_VALUE
    };
    this.extendArray(arr);
};
gmxAPIutils.Bounds.prototype = {
    extend: function(x, y) {
        if (x < this.min.x) { this.min.x = x; }
        if (x > this.max.x) { this.max.x = x; }
        if (y < this.min.y) { this.min.y = y; }
        if (y > this.max.y) { this.max.y = y; }
        return this;
    },
    extendBounds: function(bounds) {
        return this.extendArray([[bounds.min.x, bounds.min.y], [bounds.max.x, bounds.max.y]]);
    },
    extendArray: function(arr) {
        if (!arr || !arr.length) { return this; }
        var i, len;
        if (typeof arr[0] === 'number') {
            for (i = 0, len = arr.length; i < len; i += 2) {
                this.extend(arr[i], arr[i + 1]);
            }
        } else {
            for (i = 0, len = arr.length; i < len; i++) {
                this.extend(arr[i][0], arr[i][1]);
            }
        }
        return this;
    },
    addBuffer: function(dxmin, dymin, dxmax, dymax) {
        this.min.x -= dxmin;
        this.min.y -= dymin || dxmin;
        this.max.x += dxmax || dxmin;
        this.max.y += dymax || dymin || dxmin;
        return this;
    },
    contains: function (point) { // ([x, y]) -> Boolean
        var min = this.min, max = this.max,
            x = point[0], y = point[1];
        return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
    },
    getCenter: function () {
        var min = this.min, max = this.max;
        return [(min.x + max.x) / 2, (min.y + max.y) / 2];
    },
    addOffset: function (offset) {
        this.min.x += offset[0]; this.max.x += offset[0];
        this.min.y += offset[1]; this.max.y += offset[1];
        return this;
    },
    intersects: function (bounds) { // (Bounds) -> Boolean
        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x > min.x && min2.x < max.x && max2.y > min.y && min2.y < max.y;
    },
    intersectsWithDelta: function (bounds, dx, dy) { // (Bounds, dx, dy) -> Boolean
        var min = this.min,
            max = this.max,
            x = dx || 0,
            y = dy || 0,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x + x > min.x && min2.x - x < max.x && max2.y + y > min.y && min2.y - y < max.y;
    },
    isEqual: function (bounds) { // (Bounds) -> Boolean
        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x === max.x && min2.x === min.x && max2.y === max.y && min2.y === min.y;
    },
    isNodeIntersect: function (coords) {
        for (var i = 0, len = coords.length; i < len; i++) {
            if (this.contains(coords[i])) {
                return {
                    num: i,
                    point: coords[i]
                };
            }
        }
        return null;
    },

	clipPolygon: function (points, round) {
		if (points.length) {
			var clippedPoints,
				edges = [1, 4, 2, 8],
				i, j, k,
				a, b,
				len, edge, p;

			if (L.LineUtil.isFlat(points)) {
				var coords = points;
				points = coords.map(function(it) {
					return new L.Point(it[0], it[1], round);
				});
			}
			for (i = 0, len = points.length; i < len; i++) {
				points[i]._code = this._getBitCode(points[i]);
			}

			// for each edge (left, bottom, right, top)
			for (k = 0; k < 4; k++) {
				edge = edges[k];
				clippedPoints = [];

				for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
					a = points[i];
					b = points[j];

					// if a is inside the clip window
					if (!(a._code & edge)) {
						// if b is outside the clip window (a->b goes out of screen)
						if (b._code & edge) {
							p = this._getEdgeIntersection(b, a, edge, round);
							p._code = this._getBitCode(p);
							clippedPoints.push(p);
						}
						clippedPoints.push(a);

					// else if b is inside the clip window (a->b enters the screen)
					} else if (!(b._code & edge)) {
						p = this._getEdgeIntersection(b, a, edge, round);
						p._code = this._getBitCode(p);
						clippedPoints.push(p);
					}
				}
				points = clippedPoints;
			}
		}

		return points.map(function(it) {
			return [it.x, it.y];
		});
	},

	_getBitCode: function (p) {
		var code = 0;

		if (p.x < this.min.x) { // left
			code |= 1;
		} else if (p.x > this.max.x) { // right
			code |= 2;
		}

		if (p.y < this.min.y) { // bottom
			code |= 4;
		} else if (p.y > this.max.y) { // top
			code |= 8;
		}

		return code;
	},

	_getEdgeIntersection: function (a, b, code, round) {
		var dx = b.x - a.x,
			dy = b.y - a.y,
			min = this.min,
			max = this.max,
			x, y;

		if (code & 8) { // top
			x = a.x + dx * (max.y - a.y) / dy;
			y = max.y;

		} else if (code & 4) { // bottom
			x = a.x + dx * (min.y - a.y) / dy;
			y = min.y;

		} else if (code & 2) { // right
			x = max.x;
			y = a.y + dy * (max.x - a.x) / dx;

		} else if (code & 1) { // left
			x = min.x;
			y = a.y + dy * (min.x - a.x) / dx;
		}

		return new L.Point(x, y, round);
	},

    clipPolyLine: function (coords, angleFlag, delta) { // (coords) -> clip coords
        delta = delta || 0;
        var min = this.min,
            max = this.max,
            bbox = [min.x - delta, min.y - delta, max.x + delta, max.y + delta],
            bitCode = function (p) {
                var code = 0;

                if (p[0] < bbox[0]) code |= 1; // left
                else if (p[0] > bbox[2]) code |= 2; // right

                if (p[1] < bbox[1]) code |= 4; // bottom
                else if (p[1] > bbox[3]) code |= 8; // top

                return code;
            },
            getAngle = function (a, b) {
                return Math.PI / 2 + Math.atan2(b[1] - a[1], a[0] - b[0]);
            },
            intersect = function (a, b, edge) {
                return edge & 8 ? [a[0] + (b[0] - a[0]) * (bbox[3] - a[1]) / (b[1] - a[1]), bbox[3]] : // top
                       edge & 4 ? [a[0] + (b[0] - a[0]) * (bbox[1] - a[1]) / (b[1] - a[1]), bbox[1]] : // bottom
                       edge & 2 ? [bbox[2], a[1] + (b[1] - a[1]) * (bbox[2] - a[0]) / (b[0] - a[0])] : // right
                       edge & 1 ? [bbox[0], a[1] + (b[1] - a[1]) * (bbox[0] - a[0]) / (b[0] - a[0])] : // left
                       null;
            },
            result = [],
            len = coords.length,
            codeA = bitCode(coords[0], bbox),
            part = [],
            i, a, b, c, codeB, lastCode;

        for (i = 1; i < len; i++) {
            a = coords[i - 1];
            b = coords[i];
            if (a[0] === b[0] && a[1] === b[1]) { continue; }
            codeB = lastCode = bitCode(b, bbox);

            while (true) {

                if (!(codeA | codeB)) { // accept
                    if (angleFlag) {
                        a[2] = getAngle(a, b);
                        c = coords[i + 1];
                        b[2] = c ? getAngle(b, c) : a[2];
                    }
                    part.push(a);

                    if (codeB !== lastCode) { // segment went outside
                        part.push(b);

                        if (i < len - 1) { // start a new line
                            result.push(part);
                            part = [];
                        }
                    } else if (i === len - 1) {
                        part.push(b);
                    }
                    break;

                } else if (codeA & codeB) { // trivial reject
                    break;

                } else if (codeA) { // a outside, intersect with clip edge
                    a = intersect(a, b, codeA, bbox);
                    codeA = bitCode(a, bbox);

                } else { // b outside
                    b = intersect(a, b, codeB, bbox);
                    codeB = bitCode(b, bbox);
                }
            }

            codeA = lastCode;
        }

        if (part.length) result.push(part);

        return result;
    },
    toLatLngBounds: function(isWebMerc) {
		var proj = L.Projection.Mercator,
			min = proj.unproject(this.min),
			max = proj.unproject(this.max),
			arr = [[min.lat, min.lng], [max.lat, max.lng]];

		if (isWebMerc) {
			arr[0][0] = gmxAPIutils.fromWebMercY(this.min.y);
			arr[1][0] = gmxAPIutils.fromWebMercY(this.max.y);
		}
		return L.latLngBounds(arr);
    }
};

gmxAPIutils.bounds = function(arr) {
    return new gmxAPIutils.Bounds(arr);
};

//скопирована из API для обеспечения независимости от него
gmxAPIutils.parseUri = function (str) {
    var	o   = gmxAPIutils.parseUri.options,
        m   = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str),
        uri = {},
        i   = 14;

    while (i--) {
        uri[o.key[i]] = m[i] || '';
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) { uri[o.q.name][$1] = $2; }
    });

    uri.hostOnly = uri.host;
    uri.host = uri.authority; // HACK

    return uri;
};

gmxAPIutils.parseUri.options = {
    strictMode: false,
    key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
    q:   {
        name:   'queryKey',
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
/*eslint-disable no-useless-escape */
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
/*eslint-enable */
};

if (!L.gmxUtil) { L.gmxUtil = {}; }

//public interface
L.extend(L.gmxUtil, {
	debug: gmxAPIutils.debug,
	createWorker: gmxAPIutils.createWorker,
	apiLoadedFrom: gmxAPIutils.apiLoadedFrom,
    newId: gmxAPIutils.newId,
	isPageHidden: gmxAPIutils.isPageHidden,
    protocol: location.protocol !== 'https:' ? 'http:' : location.protocol,
	prefixURL: location.href.substr(0, location.href.lastIndexOf('/') + 1),
    loaderStatus: function () {},
    isIE9: gmxAPIutils.isIE(9),
    isIE10: gmxAPIutils.isIE(10),
    isIE11: gmxAPIutils.isIE(11),
    gtIE11: gmxAPIutils.gtIE(11),
	getText: gmxAPIutils.getText,
    getFormData: gmxAPIutils.getFormData,
    requestJSONP: gmxAPIutils.requestJSONP,
    requestLink: gmxAPIutils.requestLink,
    getCadastreFeatures: gmxAPIutils.getCadastreFeatures,
    request: gmxAPIutils.request,
    getLayerItemFromServer: gmxAPIutils.getLayerItemFromServer,
    fromServerStyle: gmxAPIutils.fromServerStyle,
    toServerStyle: gmxAPIutils.toServerStyle,
    getDefaultStyle: gmxAPIutils.getDefaultStyle,
    bounds: gmxAPIutils.bounds,
    getNormalizeBounds: gmxAPIutils.getNormalizeBounds,
    getGeometryBounds: gmxAPIutils.getGeometryBounds,
    tileSizes: gmxAPIutils.tileSizes,
    getDateFromStr: gmxAPIutils.getDateFromStr,
    getUnixTimeFromStr: gmxAPIutils.getUnixTimeFromStr,
    getUTCdate: gmxAPIutils.getUTCdate,
    getUTCtime: gmxAPIutils.getUTCtime,
    getUTCdateTime: gmxAPIutils.getUTCdateTime,
    attrToString: gmxAPIutils.attrToString,
    getTileAttributes: gmxAPIutils.getTileAttributes,
    formatCoordinates: function (latlng, type) {
        return gmxAPIutils['formatCoordinates' + (type ? '2' : '')](latlng.lng, latlng.lat);
    },
    formatDegrees: gmxAPIutils.formatDegrees,
    pad2: gmxAPIutils.pad2,
    dec2hex: gmxAPIutils.dec2hex,
	dec2rgba: gmxAPIutils.dec2rgba,
    trunc: gmxAPIutils.trunc,
    latLonFormatCoordinates: gmxAPIutils.latLonFormatCoordinates,
    latLonFormatCoordinates2: gmxAPIutils.latLonFormatCoordinates2,
    latLonToString: gmxAPIutils.latLonToString,
    toPrecision: gmxAPIutils.toPrecision,
    getLength: gmxAPIutils.getLength,
    geoLength: gmxAPIutils.geoLength,
    prettifyDistance: gmxAPIutils.prettifyDistance,
    getArea: gmxAPIutils.getArea,
    prettifyArea: gmxAPIutils.prettifyArea,
    geoArea: gmxAPIutils.geoArea,
    parseBalloonTemplate: gmxAPIutils.parseBalloonTemplate,
    setSVGIcon: gmxAPIutils.setSVGIcon,
    getSVGIcon: gmxAPIutils.getSVGIcon,
    getCoordinatesString: gmxAPIutils.getCoordinatesString,
    getGeometriesSummary: gmxAPIutils.getGeometriesSummary,
    getGeometrySummary: gmxAPIutils.getGeometrySummary,
    getGeoJSONSummary: gmxAPIutils.getGeoJSONSummary,
    getPropertiesHash: gmxAPIutils.getPropertiesHash,
    distVincenty: gmxAPIutils.distVincenty,
    parseCoordinates: gmxAPIutils.parseCoordinates,
    geometryToGeoJSON: gmxAPIutils.geometryToGeoJSON,
    coordsFromMercator: gmxAPIutils.coordsFromMercator,
    convertGeometry: gmxAPIutils.convertGeometry,
    transformGeometry: gmxAPIutils.transformGeometry,
    geoJSONtoGeometry: gmxAPIutils.geoJSONtoGeometry,
    geoJSONGetArea: gmxAPIutils.geoJSONGetArea,
    geoJSONGetLength: gmxAPIutils.geoJSONGetLength,
    geoJSONGetLatLng: gmxAPIutils.geoJSONGetLatLng,
	fromWebMercY: gmxAPIutils.fromWebMercY,
    parseUri: gmxAPIutils.parseUri,
    isRectangle: gmxAPIutils.isRectangle,
    isClockwise: gmxAPIutils.isClockwise,
    isPointInPolygonWithHoles: gmxAPIutils.isPointInPolygonWithHoles,
    getPatternIcon: gmxAPIutils.getPatternIcon,
    getCircleLatLngs: gmxAPIutils.getCircleLatLngs,
    normalizeHostname: gmxAPIutils.normalizeHostname,
    getTileBounds: gmxAPIutils.getTileBounds,
	getBoundsByTilePoint: gmxAPIutils.getBoundsByTilePoint,
    parseTemplate: gmxAPIutils.parseTemplate
});

L.gmxUtil.isOldVersion = L.version.substr(0, 3) === '0.7';
L.gmxUtil.isIEOrEdge = L.gmxUtil.gtIE11 || L.gmxUtil.isIE11 || L.gmxUtil.isIE10 || L.gmxUtil.isIE9;
if (!('requestIdleCallback' in window)) {
	window.requestIdleCallback = function(func, opt) {
		var timeout = opt ? opt.timeout : 0;
		return window.setTimeout(func, timeout);
	}
	window.cancelIdleCallback = window.clearTimeout;
}
L.gmx = L.gmx || {};
L.gmx.gmxProxy = '//maps.kosmosnimki.ru/ApiSave.ashx';

(function() {
    var requests = {};
    var lastRequestId = 0;

    var processMessage = function(e) {

        if (!(e.origin in requests)) {
            return;
        }

        var dataStr = decodeURIComponent(e.data.replace(/\n/g, '\n\\'));
        try {
            var dataObj = JSON.parse(dataStr);
        } catch (ev) {
            console.log({Status:'error', ErrorInfo: {ErrorMessage: 'JSON.parse exeption', ExceptionType: 'JSON.parse', StackTrace: dataStr}});
        }
        var request = requests[e.origin][dataObj.CallbackName];
        if (!request) {
            return;    // message от других запросов
        }

        delete requests[e.origin][dataObj.CallbackName];
        delete dataObj.CallbackName;

        if (request.iframe.parentNode) {
            request.iframe.parentNode.removeChild(request.iframe);
        }
        if ('callback' in request) { request.callback(dataObj); }
    };

    L.DomEvent.on(window, 'message', processMessage);

    function createPostIframe2(id, callback, url) {
        var uniqueId = 'gmxAPIutils_id' + (lastRequestId++),
            iframe = L.DomUtil.create('iframe');

        iframe.style.display = 'none';
        iframe.setAttribute('id', id);
        iframe.setAttribute('name', id);    /*eslint-disable no-script-url */
        iframe.src = 'javascript:true';     /*eslint-enable */
        iframe.callbackName = uniqueId;

        var parsedURL = gmxAPIutils.parseUri(url);
        var origin = (parsedURL.protocol ? (parsedURL.protocol + ':') : L.gmxUtil.protocol) + '//' + (parsedURL.host || window.location.host);

        requests[origin] = requests[origin] || {};
        requests[origin][uniqueId] = {callback: callback, iframe: iframe};

        return iframe;
    }

	//расширяем namespace
    gmxAPIutils.createPostIframe2 = createPostIframe2;

})();

// кроссдоменный POST запрос
(function()
{
	/** Посылает кроссдоменный POST запрос
	* @namespace L.gmxUtil
    * @ignore
	* @function
	*
	* @param url {string} - URL запроса
	* @param params {object} - хэш параметров-запросов
	* @param callback {function} - callback, который вызывается при приходе ответа с сервера. Единственный параметр ф-ции - собственно данные
	* @param baseForm {DOMElement} - базовая форма запроса. Используется, когда нужно отправить на сервер файл.
	*                                В функции эта форма будет модифицироваться, но после отправления запроса будет приведена к исходному виду.
	*/
	function sendCrossDomainPostRequest(url, params, callback, baseForm) {
        var form,
            id = '$$iframe_' + gmxAPIutils.newId();

        var iframe = gmxAPIutils.createPostIframe2(id, callback, url),
            originalFormAction;

        if (baseForm) {
            form = baseForm;
            originalFormAction = form.getAttribute('action');
            form.setAttribute('action', url);
            form.target = id;
        } else if (L.Browser.ielt9) {
            var str = '<form id=' + id + '" enctype="multipart/form-data" style="display:none" target="' + id + '" action="' + url + '" method="post"></form>';
            form = document.createElement(str);
        } else {
            form = document.createElement('form');
            form.style.display = 'none';
            form.setAttribute('enctype', 'multipart/form-data');
            form.target = id;
            form.setAttribute('method', 'POST');
            form.setAttribute('action', url);
            form.id = id;
        }

        var hiddenParamsDiv = document.createElement('div');
        hiddenParamsDiv.style.display = 'none';

        if (params.WrapStyle === 'window') {
            params.WrapStyle = 'message';
        }

        if (params.WrapStyle === 'message') {
            params.CallbackName = iframe.callbackName;
        }

        for (var paramName in params) {
            var input = document.createElement('input');
            var value = typeof params[paramName] !== 'undefined' ? params[paramName] : '';
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', paramName);
            input.setAttribute('value', value);
            hiddenParamsDiv.appendChild(input);
        }

        form.appendChild(hiddenParamsDiv);

        if (!baseForm) {
            document.body.appendChild(form);
        }
        document.body.appendChild(iframe);

        form.submit();

        if (baseForm) {
            form.removeChild(hiddenParamsDiv);
            if (originalFormAction !== null) {
                form.setAttribute('action', originalFormAction);
            } else {
                form.removeAttribute('action');
            }
        } else {
            form.parentNode.removeChild(form);
        }
    }
    //расширяем namespace
    L.gmxUtil.sendCrossDomainPostRequest = gmxAPIutils.sendCrossDomainPostRequest = sendCrossDomainPostRequest;
})();

L.Control.GmxIcon = L.Control.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
    options: {
        position: 'topleft',
        id: 'defaultIcon',
        isActive: false
    },

    setActive: function (active, skipEvent) {
        var options = this.options,
			container = this._container,
            togglable = options.togglable || options.toggle;
        if (togglable) {
            var prev = options.isActive,
                prefix = this._prefix,
                className = prefix + '-' + options.id;

            options.isActive = active;

            if (this._img) {
                if (active && options.activeImageUrl) { this._img.src = options.activeImageUrl; }
                else if (!active && options.regularImageUrl) { this._img.src = options.regularImageUrl; }
            }
            if (active) {
                L.DomUtil.addClass(container, prefix + '-active');
                L.DomUtil.addClass(container, className + '-active');
                if (container.children.length) {
                    L.DomUtil.addClass(container, prefix + '-externalImage-active');
                }
                if (options.styleActive) { this.setStyle(options.styleActive); }
            } else {
                L.DomUtil.removeClass(container, prefix + '-active');
                L.DomUtil.removeClass(container, className + '-active');
                if (container.children.length) {
                    L.DomUtil.removeClass(container, prefix + '-externalImage-active');
                }
                if (options.style) { this.setStyle(options.style); }
            }
            if (!skipEvent && prev !== active) { this.fire('statechange'); }
        }
		if (L.gmxUtil && L.gmxUtil.isIEOrEdge) {
			var uses = container.getElementsByTagName('use');
			if (uses.length) {
				var use = uses[0],
					href = use.getAttribute('href') || use.getAttribute('xlink:href');
				use.setAttribute('href', href);
				//use.setAttribute('xlink:href', href);
			}
		}
    },

    onAdd: function (map) {
        var img = null,
            span = null,
            options = this.options,
			svgSprite = options.svgSprite || map.options.svgSprite,
			prefix = 'leaflet-gmx-icon' + (svgSprite && !options.regularImageUrl && !options.text ? 'Svg' : ''),
            className = prefix + '-' + options.id;

		this._prefix = prefix;
        var container = L.DomUtil.create('div', prefix + ' ' + className);
        container._id = options.id;

        this._container = container;
        if (options.title) { container.title = options.title; }
        this.setStyle = function (style) {
            for (var key in style) {
                container.style[key] = style[key];
            }
        };
        if (options.className) {
            L.DomUtil.addClass(container, options.className);
        }
        if (options.regularImageUrl) {
            img = L.DomUtil.create('img', '', container);
            img.src = options.regularImageUrl;
            this._img = img;
            L.DomUtil.addClass(container, prefix + '-img');
            L.DomUtil.addClass(container, prefix + '-externalImage');
        } else if (options.text) {
            L.DomUtil.addClass(container, prefix + '-text');
            span = L.DomUtil.create('span', '', container);
            span.innerHTML = options.text;
        } else if (svgSprite) {
          L.DomUtil.addClass(container, 'svgIcon');
          var useHref = '#' + options.id.toLowerCase();
          container.innerHTML = '<svg role="img" class="svgIcon">\
              <use xlink:href="' + useHref + '" href="' + useHref + '"></use>\
            </svg>';
        } else {
            L.DomUtil.addClass(container, prefix + '-img ' +  prefix + '-sprite');
        }
        // if (container.children.length) {
            // L.DomUtil.addClass(container, prefix + '-externalImage');
        // }
        if (options.style) {
            this.setStyle(options.style);
        }

        this._iconClick = function () {
            if (container.parentNode) {
                this.setActive(!this.options.isActive);
                this.fire('click');
                if (this.options.stateChange) { this.options.stateChange(this); }
            }
        };
        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .on(container, 'mousemove', stop)
            .on(container, 'touchstart', stop)
            .on(container, 'mousedown', stop)
            .on(container, 'dblclick', stop)
            .on(container, 'click', stop)
            .on(container, 'click', this._iconClick, this);
        if (options.onAdd) {
            options.onAdd(this);
        }
        this.fire('controladd');
        map.fire('controladd', this);

        if (options.notHide) {
            container._notHide = true;
        }
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return container;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        this.fire('controlremove');
        map.fire('controlremove', this);

        var container = this._container,
            stop = L.DomEvent.stopPropagation;

        L.DomEvent
            .off(container, 'mousemove', stop)
            .off(container, 'touchstart', stop)
            .off(container, 'mousedown', stop)
            .off(container, 'dblclick', stop)
            .off(container, 'click', stop)
            .off(container, 'click', this._iconClick, this);
    },

    addTo: function (map) {
        L.Control.prototype.addTo.call(this, map);
        if (this.options.addBefore) {
            this.addBefore(this.options.addBefore);
        }
        return this;
    },

    addBefore: function (id) {
        var parentNode = this._parent && this._parent._container;
        if (!parentNode) {
            parentNode = this._map && this._map._controlCorners[this.getPosition()];
        }
        if (!parentNode) {
            this.options.addBefore = id;
        } else {
            for (var i = 0, len = parentNode.childNodes.length; i < len; i++) {
                var it = parentNode.childNodes[i];
                if (id === it._id) {
                    parentNode.insertBefore(this._container, it);
                    break;
                }
            }
        }

        return this;
    }
});

L.Control.gmxIcon = L.Control.GmxIcon;
L.control.gmxIcon = function (options) {
  return new L.Control.GmxIcon(options);
};
(function() {
function isIE(v) {
  return RegExp('msie' + (!isNaN(v) ? ('\\s' + v) : ''), 'i').test(navigator.userAgent);
}
var ICONSIZE = 32;
L.Control.GmxIconGroup = L.Control.GmxIcon.extend({
    options: {
        position: 'topleft',
        id: 'defaultIconGroup',
        isVertical: true,
        isCollapsible: true,
        isSortable: false,
        singleSelection: false
    },
    addIcon: function (gmxIcon) {
        this.items.push(gmxIcon);
        gmxIcon._parent = this;
        if (this._map) {
            this._container.appendChild(gmxIcon.onAdd(this._map));
            if (gmxIcon.options.addBefore) {
                gmxIcon.addBefore(gmxIcon.options.addBefore);
            }
        }

        gmxIcon.on('click', function () {
            this.setActiveIcon(gmxIcon);
        }, this);

        if (this.options.isCollapsible && !gmxIcon.options.skipCollapse) {
            gmxIcon.on('click', this._minimize, this);
        }
        return this;
    },
    removeIcon: function (gmxIcon) {
        for (var i = 0, len = this.items.length; i < len; i++) {
            if (gmxIcon === this.items[i]) {
                var cont = gmxIcon._container;
                if (cont.parentNode) {
                    cont.parentNode.removeChild(cont);
                }
                this.items.splice(i, 1);
                break;
            }
        }
        return this;
    },
    getIconById: function (id) {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it.options.id === id) { return it; }
        }
        return null;
    },
    setActiveIcon: function (gmxIcon, isActive) {
        this.activeIcon = '';
        var len = this.items.length;
        if (len) {
            if (this.options.singleSelection) {
                for (var i = 0; i < len; i++) {
                    var it = this.items[i],
                        flag = gmxIcon === it && (isActive || it.options.isActive);
                    it.setActive(flag);
                    if (flag) { this.activeIcon = it.options.id; }
                }
            }
            var cont = this._container;
            if (this.options.isSortable && gmxIcon && cont.firstChild) {
                cont.insertBefore(gmxIcon._container, cont.firstChild);
                if (gmxIcon.options.text) {
                    this._chkTriangleStyle(gmxIcon._container);
                }
            }
            if (this.triangle) {
                var icon = this.options.isSortable ? gmxIcon : this.items[0];
                if (icon && icon.options.isActive) {
                    L.DomUtil.addClass(this.triangle, 'triangle-active');
                } else {
                    L.DomUtil.removeClass(this.triangle, 'triangle-active');
                }
            }
            this.fire('activechange', this);
        }
        return this;
    },

    _chkTriangleStyle: function (first) {
        var cont = this._container;
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it._container === first) {
                if (it.options.text) {
                    this.triangle.style.right = (cont.clientWidth - first.clientWidth - 5) + 'px';
                    this.triangle.style.left = 'inherit';
                }
                break;
            }
        }
    },

    _minimize: function () {
        var style = this._container.style;

        style.height = ICONSIZE + 'px';
        if (this.options.width !== 'auto') { style.width = (ICONSIZE + 4) + 'px'; }
        style.overflow = 'hidden';
        if (this.bg) { this.bg.height = ICONSIZE + 2; }

		L.DomUtil.removeClass(this._container, 'leaflet-gmx-icon-group-maximum');
        this.fire('collapse', this);
    },

    _maximize: function () {
        var style = this._container.style,
            options = this.options;

        var size = this.items.length === 1 ? ICONSIZE : (ICONSIZE + 4) * this.items.length;
        if (options.isVertical) {
            if (this.bg) { this.bg.height = size; }
            style.height = size + 'px';
            if (options.width !== 'auto') { style.width = (ICONSIZE + 4) + 'px'; }
        } else {
            style.height = ICONSIZE + 'px';
            style.width = size + 'px';
        }
        style.overflow = 'unset';
		L.DomUtil.addClass(this._container, 'leaflet-gmx-icon-group-maximum');
        this.fire('expand', this);
    },

    onAdd: function (map) {
        var options = this.options,
			svgSprite = options.svgSprite || map.options.svgSprite,
			prefix = 'leaflet-gmx-icon-group',
            className = prefix + '-' + options.id + (svgSprite ? ' ' + prefix + 'Svg' : '') + ' ' + prefix + (options.isVertical ? '-vertical' : '-horizontal'),
            container = L.DomUtil.create('div', prefix + ' ' + className);

		if (options.isVertical) {
            if (isIE(10) || isIE(9)) {
                var vertical = L.DomUtil.create('span', 'icons-vertical',  container);
                var bg = L.DomUtil.create('img', '',  vertical);
                bg.width = bg.height = ICONSIZE;
                bg.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABBJREFUeNpi+P//PwNAgAEACPwC/tuiTRYAAAAASUVORK5CYII=';
                this.bg = bg;
                setTimeout(function() { bg.width = container.clientWidth; }, 0);
            }
            if (options.isCollapsible) {
				if (svgSprite) {
					this.triangle = L.DomUtil.create('div', 'triangleSvg',  container);
					this.triangle.innerHTML = '<svg role="img" class="svgIcon">\
						<use xlink:href="#arrow-down"></use>\
						</svg>';
				} else {
					this.triangle = L.DomUtil.create('div', 'triangle leaflet-gmx-icon-sprite',  container);
					this.triangle.width = this.triangle.height = ICONSIZE;
				}
            }
        }

        this._map = map;
        this._container = container;
        container._id = options.id;
        if (options.isCollapsible) {
            L.DomEvent
                .on(container, 'mousemove', L.DomEvent.stopPropagation)
                .on(container, 'mouseout', function(event) {
                    var parent = event.toElement;
                    while (parent) {
                        if (parent === container) { return; }
                        parent = parent.parentNode;
                    }
                    this._minimize();
                }, this)
                .on(container, 'mouseover', function(event) {
                    var parent = event.fromElement;
                    while (parent) {
                        if (parent === container) { return; }
                        parent = parent.parentNode;
                    }
                    this._maximize();
                }, this);

            this._minimize();
        }

        this.items = [];
        options.items.map(this.addIcon, this);
        if (options.onAdd) { options.onAdd(this); }
        this.fire('controladd');
        map.fire('controladd', this);

        if (options.isVertical) { container.style.marginLeft = 0; }
        if (options.notHide) {
            container._notHide = true;
        }
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        if (this.items.length) {
            var first = this.items[0],
                _this = this;
            if (first.options.text) {
                setTimeout(function() { _this._chkTriangleStyle(first._container); }, 0);
            }
        }
        return container;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        this.fire('controlremove');
        map.fire('controlremove', this);
    }
});
L.Control.gmxIconGroup = L.Control.GmxIconGroup;
L.control.gmxIconGroup = function (options) {
  return new L.Control.GmxIconGroup(options);
};

})();
(function () {
var drawingIcons = ['Point', 'Polygon', 'Polyline', 'Rectangle'];
L.Control.GmxDrawing = L.Control.GmxIconGroup.extend({
    options: {
        position: 'topleft',
        singleSelection: true,
        isSortable: true,
        id: 'drawing',
        items: null
    },

    onAdd: function (map) {
        var _this = this;
        this.setActive = function (key) {
            if (map.gmxDrawing) {
                map.gmxDrawing.bringToFront();
                map.gmxDrawing.create(key, _this.options.drawOptions);
            }
        };
        this.on('activechange', function (ev) {
            var activeIcon = ev.activeIcon;
            for (var i = 0, len = drawingIcons.length; i < len; i++) {
                if (activeIcon === drawingIcons[i]) {
                    return;
                }
            }
            _this.setActive();
        });

        if (map.gmxDrawing) {
            map.gmxDrawing.on('drawstop', function (ev) {
                var opt = ev.object._obj.options || {};
                if (!opt.ctrlKey && !opt.shiftKey) {
                    _this.setActiveIcon();
                } else {
                    _this.setActive(ev.object.options.type);
                }
            }, this);
        }
        var addIcon = function (key) {
            return L.control.gmxIcon({
                id: key,
                //className: 'leaflet-gmx-icon-sprite',
                title: _this._locale && 'getText' in _this._locale ? _this._locale.getText(key) : key,
                togglable: true
              })
              .on('statechange', function (ev) {
                var opt = ev.target.options,
                    id = opt.id;

                if (id === _this.activeIcon) {
                    _this.setActive();
                } else if (opt.isActive) {
                    _this.setActive(id);
                }
            });
        };
        var defaultIcons = this.options.items || drawingIcons;
        this.options.items = [];
        defaultIcons.forEach(function (it) {
            _this.options.items.push(it instanceof L.Control.GmxIcon ? it : addIcon(it));
        });
        return L.Control.GmxIconGroup.prototype.onAdd.call(this, map);
    }
});

L.Control.gmxDrawing = L.Control.GmxDrawing;
L.control.gmxDrawing = function (options) {
  return new L.Control.GmxDrawing(options);
};

L.Control.GmxDrawing.locale = {};
L.Control.GmxDrawing.addInitHook(function () {
    this._locale = L.Control.GmxDrawing.locale;
    L.extend(this._locale, L.gmxLocaleMixin);
});
})();
(function () {

var rectDelta = 0.0000001;
var stateVersion = '1.0.0';

L.GmxDrawing = L.Class.extend({
    options: {
        type: ''
    },
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    initialize: function (map) {
        this._map = map;
        this.items = [];
        this.current = null;
        this.contextmenu = new L.GmxDrawingContextMenu({
			points: [], // [{text: 'Remove point'}, {text: 'Delete feature'}],
			lines: []
		});

        if (L.gmxUtil && L.gmxUtil.prettifyDistance) {
			var svgNS = 'http://www.w3.org/2000/svg';
			var tooltip = document.createElementNS(svgNS, 'g');
            L.DomUtil.addClass(tooltip, 'gmxTooltip');
            var bg = document.createElementNS(svgNS, 'rect');
            bg.setAttributeNS(null, 'rx', 4);
            bg.setAttributeNS(null, 'ry', 4);
            bg.setAttributeNS(null, 'height', 16);
            L.DomUtil.addClass(bg, 'gmxTooltipBG');

            var text = document.createElementNS(svgNS, 'text');
            var userSelectProperty = L.DomUtil.testProp(
                ['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);
            text.style[userSelectProperty] = 'none';
            tooltip.appendChild(bg);
            tooltip.appendChild(text);

            this.hideTooltip = function() {
                tooltip.setAttributeNS(null, 'visibility', 'hidden');
            };
            this.showTooltip = function(point, mouseovertext) {
                var x = point.x + 11,
                    y = point.y - 14;
                text.setAttributeNS(null, 'x', x);
                text.setAttributeNS(null, 'y', y);
                text.textContent = mouseovertext;
                if (tooltip.getAttributeNS(null, 'visibility') !== 'visible') {
                    (this._map._pathRoot || this._map._renderer._container).appendChild(tooltip);
                    tooltip.setAttributeNS(null, 'visibility', 'visible');
                }
                var length = text.getComputedTextLength();
                bg.setAttributeNS(null, 'width', length + 8);
                bg.setAttributeNS(null, 'x', x - 4);
                bg.setAttributeNS(null, 'y', y - 12);
            };
        }
        this.on('drawstop drawstart', function (ev) {
            this.drawMode = this._drawMode = ev.mode;
			this._map.doubleClickZoom[this.drawMode === 'edit' ? 'disable' : 'enable']();
        }, this);
    },

    bringToFront: function () {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var item = this.items[i];
            if (item._map && 'bringToFront' in item) { item.bringToFront(); }
        }
    },

    addGeoJSON: function (obj, options) {
        var arr = [],
            isLGeoJSON = obj instanceof L.GeoJSON;
        if (!isLGeoJSON) {
            obj = L.geoJson(obj, options);
        }
        if (obj instanceof L.GeoJSON) {
            var layers = obj.getLayers();
            if (layers) {
                var parseLayer = function (it) {
                    var _originalStyle = null;
                    if (it.setStyle && options && options.lineStyle) {
                        _originalStyle = {};
                        for (var key in options.lineStyle) {
                            _originalStyle[key] = options.lineStyle[key];
                        }
                        it.setStyle(options.lineStyle);
                    }
                    var f = this.add(it, options);
                    f._originalStyle = _originalStyle;
                    arr.push(f);
                };
                for (var i = 0, len = layers.length; i < len; i++) {
                    var layer = layers[i];

                    if (layer.feature.geometry.type !== 'GeometryCollection') {
                        layer = L.layerGroup([layer]);
                    }
                    layer.eachLayer(parseLayer, this);
                }
            }
        }
        return arr;
    },

    add: function (obj, options) {
        var item = null;
		options = options || {};
        if (obj) {
            if (obj instanceof L.GmxDrawing.Feature) {
                item = obj;
            } else {
                var calcOptions = {};
				if (obj.feature && obj.feature.geometry) {
					var type = obj.feature.geometry.type;
					if (type === 'Point') {
						obj = new L.Marker(obj._latlng);
					} else if (type === 'MultiPolygon') {
						calcOptions.type = type;
					}
				}
                // if (!L.MultiPolygon) { L.MultiPolygon = L.Polygon; }
                // if (!L.MultiPolyline) { L.MultiPolyline = L.Polyline; }
                if (!options || !('editable' in options)) { calcOptions.editable = true; }
                if (obj.geometry)     { calcOptions.type = obj.geometry.type; }
                else if (obj instanceof L.Rectangle)     { calcOptions.type = 'Rectangle'; }
                else if (obj instanceof L.Polygon)  { calcOptions.type = calcOptions.type || 'Polygon'; }
                else if (L.MultiPolygon && obj instanceof L.MultiPolygon)  { calcOptions.type = 'MultiPolygon'; }
                else if (obj instanceof L.Polyline) { calcOptions.type = 'Polyline'; }
                else if (L.MultiPolyline && obj instanceof L.MultiPolyline) { calcOptions.type = 'MultiPolyline'; }
                else if (obj.setIcon || obj instanceof L.Marker) {
                    calcOptions.type = 'Point'; calcOptions.editable = false;
                    obj.options.draggable = true;
                }
                options = this._chkDrawOptions(calcOptions.type, options);
                L.extend(options, calcOptions);
                if (obj.geometry) {
                    var iconStyle = options.markerStyle && options.markerStyle.iconStyle;
                    if (options.type === 'Point' &&
                        !options.pointToLayer &&
                        iconStyle
                    ) {
                        options.icon = L.icon(iconStyle);
                        options.pointToLayer = function (geojson, latlng) {
                             return new L.Marker(latlng, options);
                        };
                    }
                    return this.addGeoJSON(obj, options);
                }
                item = new L.GmxDrawing.Feature(this, obj, options);
            }
            if (!('map' in options)) { options.map = true; }
            if (options.map && !item._map && this._map) { this._map.addLayer(item); }
            else { this._addItem(item); }
            //if (!item._map) this._map.addLayer(item);
            //if (item.points) item.points._path.setAttribute('fill-rule', 'inherit');
            if ('setEditMode' in item) { item.setEditMode(); }
        }
        return item;
    },

    _disableDrag: function () {
		if (this._map) {
			this._map.dragging.disable();
			L.DomUtil.disableTextSelection();
			L.DomUtil.disableImageDrag();
			this._map.doubleClickZoom.removeHooks();
		}
    },

    _enableDrag: function () {
		if (this._map) {
			this._map.dragging.enable();
			L.DomUtil.enableTextSelection();
			L.DomUtil.enableImageDrag();
			this._map.doubleClickZoom.addHooks();
		}
    },

    clearCreate: function () {
		this._clearCreate();
    },

    _clearCreate: function () {
        if (this._createKey && this._map) {
            if (this._createKey.type === 'Rectangle' && L.Browser.mobile) {
                L.DomEvent.off(this._map._container, 'touchstart', this._createKey.fn, this);
            } else {
                this._map.off(this._createKey.eventName, this._createKey.fn, this);
            }
            this._enableDrag();
        }
        this._createKey = null;
    },

    _chkDrawOptions: function (type, drawOptions) {
        var defaultStyles = L.GmxDrawing.utils.defaultStyles,
            resultStyles = {};
        if (!drawOptions) {
            drawOptions = L.extend({}, defaultStyles);
        }
        if (type === 'Point') {
            L.extend(resultStyles, defaultStyles.markerStyle.options.icon, drawOptions);
        } else {
            L.extend(resultStyles, drawOptions);
            resultStyles.lineStyle = L.extend({}, defaultStyles.lineStyle, drawOptions.lineStyle);
            resultStyles.pointStyle = L.extend({}, defaultStyles.pointStyle, drawOptions.pointStyle);
            resultStyles.holeStyle = L.extend({}, defaultStyles.holeStyle, drawOptions.holeStyle);
        }

        if (resultStyles.iconUrl) {
            var iconStyle = {
                iconUrl: resultStyles.iconUrl
            };
            delete resultStyles.iconUrl;
            if (resultStyles.iconAnchor) {
                iconStyle.iconAnchor = resultStyles.iconAnchor;
                delete resultStyles.iconAnchor;
            }
            if (resultStyles.iconSize) {
                iconStyle.iconSize = resultStyles.iconSize;
                delete resultStyles.iconSize;
            }
            if (resultStyles.popupAnchor) {
                iconStyle.popupAnchor = resultStyles.popupAnchor;
                delete resultStyles.popupAnchor;
            }
            if (resultStyles.shadowSize) {
                iconStyle.shadowSize = resultStyles.shadowSize;
                delete resultStyles.shadowSize;
            }
            resultStyles.markerStyle = {
                iconStyle: iconStyle
            };
        }
        return resultStyles;
    },

    create: function (type, options) {
        this._clearCreate(null);
        if (type && this._map) {
            var map = this._map,
                drawOptions = this._chkDrawOptions(type, options),
                my = this;

            if (type === 'Rectangle') {
                //map._initPathRoot();
                map.dragging.disable();
            }

            this._createKey = {
                type: type,
                eventName: type === 'Rectangle' ? (L.Browser.mobile ? 'touchstart' : 'mousedown') : 'click',
                fn: function (ev) {
					var originalEvent = ev && ev.originalEvent;
					if (originalEvent) {
						var clickOnTag = originalEvent.target.tagName;
						if (clickOnTag === 'g' || clickOnTag === 'path') { return; }
					}
                    my._createType = '';
                    var obj, key,
                        opt = {},
                        latlng = ev.latlng;

                    for (key in drawOptions) {
                        if (!(key in L.GmxDrawing.utils.defaultStyles)) {
                            opt[key] = drawOptions[key];
                        }
                    }
                    if (type === 'Point') {
                        var markerStyle = drawOptions.markerStyle || {},
                            markerOpt = {
                                draggable: true
                            };
                        if (originalEvent) {
                            markerOpt.ctrlKey = originalEvent.ctrlKey;
                            markerOpt.shiftKey = originalEvent.shiftKey;
                            markerOpt.altKey = originalEvent.altKey;
                        }
                        if (markerStyle.iconStyle) {
                            markerOpt.icon = L.icon(markerStyle.iconStyle);
                        }
                        obj = my.add(new L.Marker(latlng, markerOpt), opt);
                    } else {
                        if (drawOptions.pointStyle) { opt.pointStyle = drawOptions.pointStyle; }
                        if (drawOptions.lineStyle) { opt.lineStyle = drawOptions.lineStyle; }
                        if (type === 'Rectangle') {
                            // if (L.Browser.mobile) {
                                // var downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map);
                                // latlng = downAttr.latlng;
                            // }
                            opt.mode = 'edit';
                            obj = my.add(
                                L.rectangle(L.latLngBounds(L.latLng(latlng.lat + rectDelta, latlng.lng - rectDelta), latlng))
                            , opt);
                            if (L.Browser.mobile) { obj._startTouchMove(ev, true); }
                            else { obj._pointDown(ev); }

                            obj.rings[0].ring._drawstop = true;
                        } else if (type === 'Polygon') {
                            opt.mode = 'add';
                            obj = my.add(L.polygon([latlng]), opt);
                            obj.setAddMode();
                        } else if (type === 'Polyline') {
                            opt.mode = 'add';
                            obj = my.add(L.polyline([latlng]), opt).setAddMode();
                        }
                    }
                    my._clearCreate();
                }
            };
            if (type === 'Rectangle' && L.Browser.mobile) {
                L.DomEvent.on(map._container, 'touchstart', this._createKey.fn, this);
            } else {
                map.on(this._createKey.eventName, this._createKey.fn, this);
            }
            this._createType = type;
            L.DomUtil.addClass(map._mapPane, 'leaflet-clickable');
            this.fire('drawstart', {mode: type});
        }
        this.options.type = type;
    },

    extendDefaultStyles: function (drawOptions) {
        var defaultStyles = L.GmxDrawing.utils.defaultStyles;
        drawOptions = drawOptions || {};
        if (drawOptions.iconUrl) {
            var iconStyle = defaultStyles.markerStyle.options.icon;
            iconStyle.iconUrl = drawOptions.iconUrl;
            delete drawOptions.iconUrl;
            if (drawOptions.iconAnchor) {
                iconStyle.iconAnchor = drawOptions.iconAnchor;
                delete drawOptions.iconAnchor;
            }
            if (drawOptions.iconSize) {
                iconStyle.iconSize = drawOptions.iconSize;
                delete drawOptions.iconSize;
            }
            if (drawOptions.popupAnchor) {
                iconStyle.popupAnchor = drawOptions.popupAnchor;
                delete drawOptions.popupAnchor;
            }
            if (drawOptions.shadowSize) {
                iconStyle.shadowSize = drawOptions.shadowSize;
                delete drawOptions.shadowSize;
            }
        }
        if (drawOptions.lineStyle) {
            L.extend(defaultStyles.lineStyle, drawOptions.lineStyle);
            delete drawOptions.lineStyle;
        }
        if (drawOptions.pointStyle) {
            L.extend(defaultStyles.pointStyle, drawOptions.pointStyle);
            delete drawOptions.pointStyle;
        }
        if (drawOptions.holeStyle) {
            L.extend(defaultStyles.holeStyle, drawOptions.holeStyle);
            delete drawOptions.holeStyle;
        }
        L.extend(defaultStyles, drawOptions);
        return this;
    },

    getFeatures: function () {
        var out = [];
        for (var i = 0, len = this.items.length; i < len; i++) {
            out.push(this.items[i]);
        }
        return out;
    },

    loadState: function (data) {
        //if (data.version !== stateVersion) return;

        var _this = this,
            featureCollection = data.featureCollection;
        L.geoJson(featureCollection, {
            onEachFeature: function (feature, layer) {
                var options = feature.properties,
                    popupOpened = options.popupOpened;
                if (options.type === 'Rectangle') {
                    layer = L.rectangle(layer.getBounds());
                } else if (options.type === 'Point') {
                    options = options.options;
                    var icon = options.icon;
                    if (icon) {
                        delete options.icon;
                        if (icon.iconUrl) { options.icon = L.icon(icon); }
                    }
                    layer = L.marker(layer.getLatLng(), options);
                }
                if (layer.setStyle && options && options.lineStyle) {
                    layer.setStyle(options.lineStyle);
                }
                _this.add(layer, options);
                if (popupOpened) {
                    layer.openPopup();
                }
            }
        });
    },

    saveState: function () {
        var featureGroup = L.featureGroup();
        var points = [];
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it.options.type === 'Point') {
                var geojson = it.toGeoJSON();
                geojson.properties = L.GmxDrawing.utils.getNotDefaults(it.options, L.GmxDrawing.utils.defaultStyles.markerStyle);
                if (!it._map) { geojson.properties.map = false; }
                else if (it._map.hasLayer(it.getPopup())) {
                    geojson.properties.popupOpened = true;
                }
                var res = L.GmxDrawing.utils.getNotDefaults(it._obj.options, L.GmxDrawing.utils.defaultStyles.markerStyle.options);
                if (Object.keys(res).length) { geojson.properties.options = res; }
                res = L.GmxDrawing.utils.getNotDefaults(it._obj.options.icon.options, L.GmxDrawing.utils.defaultStyles.markerStyle.options.icon);
                if (Object.keys(res).length) {
                    if (!geojson.properties.options) { geojson.properties.options = {}; }
                    geojson.properties.options.icon = res;
                }
                points.push(geojson);
            } else {
                featureGroup.addLayer(it);
            }
        }
        var featureCollection = featureGroup.toGeoJSON();
        featureCollection.features = featureCollection.features.concat(points);
        return {
            version: stateVersion,
            featureCollection: featureCollection
        };
    },

    _addItem: function (item) {
        var addFlag = true;
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it === item) {
                addFlag = false;
                break;
            }
        }
        if (addFlag) { this.items.push(item); }
        this.fire('add', {mode: item.mode, object: item});
    },

    _removeItem: function (obj, remove) {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var item = this.items[i];
            if (item === obj) {
                if (remove) {
                    this.items.splice(i, 1);
                    var ev = {type: item.options.type, mode: item.mode, object: item};
                    this.fire('remove', ev);
                    item.fire('remove', ev);
                }
                return item;
            }
        }
        return null;
    },

    clear: function () {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var item = this.items[i];
            if (item && item._map) {
                item._map.removeLayer(item);
            }
            var ev = {type: item.options.type, mode: item.mode, object: item};
            this.fire('remove', ev);
            item.fire('remove', ev);
        }
        this.items = [];
        return this;
    },

    remove: function (obj) {
        var item = this._removeItem(obj, true);
        if (item && item._map) {
            item._map.removeLayer(item);
        }
        return item;
    }
});

L.Map.addInitHook(function () {
    this.gmxDrawing = new L.GmxDrawing(this);
});
})();


L.GmxDrawing.Feature = L.LayerGroup.extend({
    options: {
        endTooltip: '',
        smoothFactor: 0,
        mode: '' // add, edit
    },
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    simplify: function () {
        var i, j, len, len1, hole;
        for (i = 0, len = this.rings.length; i < len; i++) {
            var it = this.rings[i],
                ring = it.ring;
            ring.setLatLngs(ring.points.getPathLatLngs());
            for (j = 0, len1 = it.holes.length; j < len1; j++) {
                hole = it.holes[j];
                hole.setLatLngs(hole.points.getPathLatLngs());
            }
        }
        return this;
    },

    bringToFront: function () {
        return this.invoke('bringToFront');
    },

    bringToBack: function () {
        return this.invoke('bringToBack');
    },

    onAdd: function (map) {
        L.LayerGroup.prototype.onAdd.call(this, map);
        this._parent._addItem(this);
        if (this.options.type === 'Point') {
            map.addLayer(this._obj);
            requestIdleCallback(function () {
                this._fireEvent('drawstop', this._obj.options);
            }.bind(this), {timeout: 0});
        } else {
			var svgContainer = this._map._pathRoot || (this._map._renderer && this._map._renderer._container);
			if (svgContainer && svgContainer.getAttribute('pointer-events') !== 'visible') {
				svgContainer.setAttribute('pointer-events', 'visible');
			}
        }
        this._fireEvent('addtomap');
    },

    onRemove: function (map) {
        if ('hideTooltip' in this) { this.hideTooltip(); }
		this._removeStaticTooltip();

        L.LayerGroup.prototype.onRemove.call(this, map);

        if (this.options.type === 'Point') {
            map.removeLayer(this._obj);
        }
        this._fireEvent('removefrommap');
    },

    remove: function (ring) {
        if (ring) {
            var i, j, len, len1, hole;
            for (i = 0, len = this.rings.length; i < len; i++) {
                if (ring.options.hole) {
                    for (j = 0, len1 = this.rings[i].holes.length; j < len1; j++) {
                        hole = this.rings[i].holes[j];
                        if (ring === hole) {
                            this.rings[i].holes.splice(j, 1);
                            if (hole._map) {
                                hole._map.removeLayer(hole);
                            }
                            break;
                        }
                    }
                    if (!ring._map) {
                        break;
                    }
                } else if (ring === this.rings[i].ring) {
                    for (j = 0, len1 = this.rings[i].holes.length; j < len1; j++) {
                        hole = this.rings[i].holes[j];
                        if (hole._map) {
                            hole._map.removeLayer(hole);
                        }
                    }
                    this.rings.splice(i, 1);
                    if (ring._map) {
                        ring._map.removeLayer(ring);
                    }
                    break;
                }
            }
        } else {
            this.rings = [];
        }
        if (this.rings.length < 1) {
            if (this._originalStyle) {
                this._obj.setStyle(this._originalStyle);
            }
            this._parent.remove(this);
        }
        return this;
    },

    _fireEvent: function (name, options) {
        //console.log('_fireEvent', name);
        if (name === 'removefrommap' && this.rings.length > 1) {
            return;
        }
        var event = L.extend({}, {mode: this.mode || '', object: this}, options);
        this.fire(name, event);
        this._parent.fire(name, event);
        if (name === 'drawstop' && this._map) {
            L.DomUtil.removeClass(this._map._mapPane, 'leaflet-clickable');
        }
    },

    getStyle: function () {
        var resultStyles = L.extend({}, this._drawOptions);
        delete resultStyles.holeStyle;
        if (resultStyles.type === 'Point') {
            L.extend(resultStyles, resultStyles.markerStyle.iconStyle);
            delete resultStyles.markerStyle;
        }
        return resultStyles;
    },

    setOptions: function (options) {
        if (options.lineStyle) {
            this._setStyleOptions(options.lineStyle, 'lines');
        }
        if (options.pointStyle) {
            this._setStyleOptions(options.pointStyle, 'points');
        }
        if ('editable' in options) {
            if (options.editable) { this.enableEdit(); }
            else { this.disableEdit(); }
        }
        L.setOptions(this, options);

        this._fireEvent('optionschange');
        return this;
    },

    _setStyleOptions: function (options, type) {
        for (var i = 0, len = this.rings.length; i < len; i++) {
            var it = this.rings[i].ring[type];
            it.setStyle(options);
            it.redraw();
            for (var j = 0, len1 = this.rings[i].holes.length; j < len1; j++) {
                it = this.rings[i].holes[j][type];
                it.setStyle(options);
                it.redraw();
            }
        }
        this._fireEvent('stylechange');
    },

    _setLinesStyle: function (options) {
        this._setStyleOptions(options, 'lines');
    },

    _setPointsStyle: function (options) {
        this._setStyleOptions(options, 'points');
    },

    getOptions: function () {
        var options = this.options,
            data = L.extend({}, options);

        data.lineStyle = options.lineStyle;
        data.pointStyle = options.pointStyle;

        var res = L.GmxDrawing.utils.getNotDefaults(data, L.GmxDrawing.utils.defaultStyles);
        if (!Object.keys(res.lineStyle).length) { delete res.lineStyle; }
        if (!Object.keys(res.pointStyle).length) { delete res.pointStyle; }
        if (!this._map) { res.map = false; }

        if (options.type === 'Point') {
            var opt = L.GmxDrawing.utils.getNotDefaults(this._obj.options, L.GmxDrawing.utils.defaultStyles.markerStyle.options);
            if (Object.keys(opt).length) { res.options = opt; }
            opt = L.GmxDrawing.utils.getNotDefaults(this._obj.options.icon.options, L.GmxDrawing.utils.defaultStyles.markerStyle.options.icon);
            if (Object.keys(opt).length) {
                res.options.icon = opt;
            }
        }

        return res;
    },

    _latLngsToCoords: function (latlngs, closed) {
        var coords = L.GeoJSON.latLngsToCoords(L.GmxDrawing.utils.isOldVersion ? latlngs : latlngs[0]);
        if (closed) {
            var lastCoord = coords[coords.length - 1];
            if (lastCoord[0] !== coords[0][0] || lastCoord[1] !== coords[0][1]) {
                coords.push(coords[0]);
            }
        }
        return coords;
    },

    _latlngsAddShift: function (latlngs, shiftPixel) {
        var arr = [];
        for (var i = 0, len = latlngs.length; i < len; i++) {
            arr.push(L.GmxDrawing.utils.getShiftLatlng(latlngs[i], this._map, shiftPixel));
        }
        return arr;
    },

    getPixelOffset: function () {
        var p = this.shiftPixel;
        if (!p && this._map) {
            var mInPixel = 256 / L.gmxUtil.tileSizes[this._map._zoom];
            p = this.shiftPixel = new L.Point(Math.floor(mInPixel * this._dx), -Math.floor(mInPixel * this._dy));
        }
        return p || new L.Point(0, 0);
    },

    setOffsetToGeometry: function (dx, dy) {
        var i, len, j, len1, ring, latlngs,
            mInPixel = 256 / L.gmxUtil.tileSizes[this._map._zoom],
            shiftPixel = new L.Point(mInPixel * (this._dx || dx || 0), -mInPixel * (this._dy || dy || 0));

        for (i = 0, len = this.rings.length; i < len; i++) {
            var it = this.rings[i];
            ring = it.ring;
            latlngs = ring.points.getLatLngs();
            ring.setLatLngs(this._latlngsAddShift(latlngs, shiftPixel));

            if (it.holes && it.holes.length) {
                for (j = 0, len1 = it.holes.length; j < len1; j++) {
                    ring = it.holes[j].ring;
                    latlngs = ring.points.getLatLngs();
                    ring.setLatLngs(this._latlngsAddShift(latlngs, shiftPixel));
                }
            }
        }
        this.setPositionOffset();
        return this;
    },

    setPositionOffset: function (mercX, mercY) {
        this._dx = mercX || 0;
        this._dy = mercY || 0;
        if (this._map) {
            this.shiftPixel = null;
            var p = this.getPixelOffset();
            for (var i = 0, len = this.rings.length; i < len; i++) {
                this.rings[i].ring.setPositionOffset(p);
                for (var j = 0, len1 = this.rings[i].holes.length; j < len1; j++) {
                    this.rings[i].holes[j].setPositionOffset(p);
                }
            }
        }
    },

    _getCoords: function (withoutShift) {
        var type = this.options.type,
            closed = (type === 'Polygon' || type === 'Rectangle' || type === 'MultiPolygon'),
            shiftPixel = withoutShift ? null : this.shiftPixel,
            coords = [];
        for (var i = 0, len = this.rings.length; i < len; i++) {
            var it = this.rings[i],
                arr = this._latLngsToCoords(it.ring.points.getLatLngs(), closed, shiftPixel);

            if (closed) { arr = [arr]; }
            if (it.holes && it.holes.length) {
                for (var j = 0, len1 = it.holes.length; j < len1; j++) {
                    arr.push(this._latLngsToCoords(it.holes[j].points.getLatLngs(), closed, shiftPixel));
                }
            }
            coords.push(arr);
        }
        if (type === 'Polyline' || (closed && type !== 'MultiPolygon')) { coords = coords[0]; }
        return coords;
    },

    _geoJsonToLayer: function (geoJson) {
		return L.geoJson(geoJson).getLayers()[0];
    },

    setGeoJSON: function (geoJson) {
		this._initialize(this._parent, geoJson);
        return this;
    },

    toGeoJSON: function () {
        return this._toGeoJSON(true);
    },

    _toGeoJSON: function (withoutShift) {
        var type = this.options.type,
            properties = this.getOptions(),
            coords;

        delete properties.mode;

        if (!this.options.editable || type === 'Point') {
            var obj = this._obj;
            if (obj instanceof L.GeoJSON) {
                obj = L.GmxDrawing.utils._getLastObject(obj).getLayers()[0];
            }
            var geojson = obj.toGeoJSON();
            geojson.properties = properties;
            return geojson;
        } else if (this.rings) {
            coords = this._getCoords(withoutShift);
            if (type === 'Rectangle') { type = 'Polygon'; }
            else if (type === 'Polyline') { type = 'LineString'; }
            else if (type === 'MultiPolyline') { type = 'MultiLineString'; }
        }

        return L.GeoJSON.getFeature({
            feature: {
                type: 'Feature',
                properties: properties
            }
        }, {
            type: type,
            coordinates: coords
        });
    },

    getType: function () {
        return this.options.type;
    },

    hideFill: function () {
        if (this._fill._map) {
             this._map.removeLayer(this._fill);
        }
    },

    showFill: function () {
        var geoJSON = this.toGeoJSON(),
            obj = L.GeoJSON.geometryToLayer(geoJSON, null, null, {weight: 0});

        this._fill.clearLayers();
        if (obj instanceof L.LayerGroup) {
            obj.eachLayer(function (layer) {
                this._fill.addLayer(layer);
            }, this);
        } else {
            obj.setStyle({smoothFactor: 0, weight: 0, fill: true, fillColor: '#0033ff'});
            this._fill.addLayer(obj);
        }
        if (!this._fill._map) {
            this._map.addLayer(this._fill);
            this._fill.bringToBack();
        }
        return this;
    },

    getBounds: function() {
        var bounds = new L.LatLngBounds();
        if (this.options.type === 'Point') {
            var latLng = this._obj.getLatLng();
            bounds.extend(latLng);
        } else {
            bounds = this._getBounds();
        }
        return bounds;
    },

    _getBounds: function(item) {
        var layer = item || this,
            bounds = new L.LatLngBounds(),
            latLng;
        if (layer instanceof L.LayerGroup) {
            layer.eachLayer(function (it) {
                latLng = this._getBounds(it);
                bounds.extend(latLng);
            }, this);
            return bounds;
        } else if (layer instanceof L.Marker) {
            latLng = layer.getLatLng();
        } else {
            latLng = layer.getBounds();
        }
        bounds.extend(latLng);
        return bounds;
    },

    initialize: function (parent, obj, options) {
        options = options || {};

        this.contextmenu = new L.GmxDrawingContextMenu();
        options.mode = '';
        this._drawOptions = L.extend({}, options);
        var type = options.type;
        if (type === 'Point') {
            delete options.pointStyle;
            delete options.lineStyle;
        } else {
            delete options.iconUrl;
            delete options.iconAnchor;
            delete options.iconSize;
            delete options.popupAnchor;
            delete options.shadowSize;
            delete options.markerStyle;
        }
        delete options.holeStyle;

        L.setOptions(this, options);

        this._layers = {};
        this._obj = obj;
        this._parent = parent;
        this._dx = 0;
        this._dy = 0;

        this._initialize(parent, obj);
    },

    enableEdit: function() {
        this.options.mode = 'edit';
        var type = this.options.type;
        if (type !== 'Point') {
            // for (var i = 0, len = this.rings.length; i < len; i++) {
                // var it = this.rings[i];
                // it.ring.options.editable = this.options.editable;
                // it.ring.setEditMode();
                // for (var j = 0, len1 = it.holes.length; j < len1; j++) {
                    // var hole = it.holes[j];
                    // hole.options.editable = this.options.editable;
                    // hole.setEditMode();
                // }
            // }
            var geojson = L.geoJson(this.toGeoJSON()),
				items = geojson.getLayers();
            this.options.editable = true;
			if (items.length) {
				this._initialize(this._parent, items[0]);
			}
        }
        return this;
    },

    disableEdit: function() {
        var type = this.options.type;
        if (type !== 'Point') {
			this._originalStyle = this.options.lineStyle;
            var geojson = L.geoJson(this.toGeoJSON().geometry, this._originalStyle).getLayers()[0];
            for (var i = 0, len = this.rings.length; i < len; i++) {
                var it = this.rings[i];
                it.ring.removeEditMode();
                it.ring.options.editable = false;
                for (var j = 0, len1 = it.holes.length; j < len1; j++) {
                    var hole = it.holes[j];
                    hole.removeEditMode();
                    hole.options.editable = false;
                }
            }
            this._obj = geojson;
            this.options.editable = false;
            this._initialize(this._parent, this._obj);
        }
        return this;
    },

    getArea: function () {
        var out = 0;
        if (L.gmxUtil.geoJSONGetArea) {
            out = L.gmxUtil.geoJSONGetArea(this.toGeoJSON());
        }
        return out;
    },

    getLength: function () {
        var out = 0;
        if (L.gmxUtil.geoJSONGetLength) {
            out = L.gmxUtil.geoJSONGetLength(this.toGeoJSON());
        }
        return out;
    },

    getLatLng: function () {
		return this.lastAddLatLng;
    },

    _getTooltipAnchor: function () {
		return this.lastAddLatLng;
    },

    getSummary: function () {
        var str = '',
            mapOpt = this._map ? this._map.options : {},
            type = this.options.type;

        if (type === 'Polyline' || type === 'MultiPolyline') {
            str = L.gmxUtil.prettifyDistance(this.getLength(), mapOpt.distanceUnit);
        } else if (type === 'Polygon' || type === 'MultiPolygon' || type === 'Rectangle') {
            str = L.gmxUtil.prettifyArea(this.getArea(), mapOpt.squareUnit);
        } else if (type === 'Point') {
            var latLng = this._obj.getLatLng();
            str = L.gmxUtil.formatCoordinates(latLng);
        }
        return str;
    },

    _initialize: function (parent, obj) {
        this.clearLayers();
        this.rings = [];
        this.mode = '';
        this.lastAddLatLng = L.latLng(0, 0);		// последняя из добавленных точек

        this._fill = L.featureGroup();
		if (this._fill.options) {
			this._fill.options.smoothFactor = 0;
		}

        if (this.options.editable) {
            var arr = [];
			if (L.GmxDrawing.utils.isOldVersion) {
				arr = obj.getLayers ? L.GmxDrawing.utils._getLastObject(obj).getLayers() : [obj];
			} else {
				arr = obj.getLayers ? L.GmxDrawing.utils._getLastObject(obj) : [obj];
				if (obj.type && obj.coordinates) {
					var type = obj.type;
					obj = this._geoJsonToLayer(obj);
					if (type === 'Polygon') {
						var it1 = obj.getLatLngs();
						arr = [{_latlngs: it1.shift(), _holes: it1}];
					} else if (type === 'MultiPolygon') {
						arr = obj.getLatLngs().map(function(it) { return {_latlngs: it.shift(), _holes: it}; });
					} else if (type === 'LineString') {
						arr = [{_latlngs: obj.getLatLngs()}];
					} else if (type === 'MultiLineString') {
						arr = obj.getLatLngs().map(function(it) { return {_latlngs: it}; });
					} else if (type === 'Point') {
						this._obj = new L.Marker(obj.getLatLng(), {draggable: true});
						this._setMarker(this._obj);
						return;
					} else if (type === 'MultiPoint') {
						obj.getLayers()
							.forEach(function(it) {
								this._setMarker(new L.Marker(it.getLatLng(), {draggable: true}));
							}.bind(this));
						return;
					}

				} else if (this.options.type === 'MultiPolygon') {
					arr = (obj.getLayers ? obj.getLayers()[0] : obj)
						.getLatLngs()
						.map(function(it) { return {_latlngs: it.shift(), _holes: it}; });
				}
			}
            for (var i = 0, len = arr.length; i < len; i++) {
                var it = arr[i],
                    holes = [],
                    ring = new L.GmxDrawing.Ring(this, it._latlngs, {ring: true, editable: this.options.editable});

                this.addLayer(ring);
                if (it._holes) {
                    for (var j = 0, len1 = it._holes.length; j < len1; j++) {
                        var hole = new L.GmxDrawing.Ring(this, it._holes[j], {hole: true, editable: this.options.editable});
                        this.addLayer(hole);
                        holes.push(hole);
                    }
                }
                this.rings.push({ring: ring, holes: holes});
            }

			if (this.options.endTooltip && L.tooltip) {
				this._initStaticTooltip();
			}

            if (L.gmxUtil && L.gmxUtil.prettifyDistance && !this._showTooltip) {
                var _gtxt = L.GmxDrawing.utils.getLocale;
                var my = this;
                this._showTooltip = function (type, ev) {
                    var ring = ev.ring,
                        originalEvent = ev.originalEvent,
                        down = originalEvent.buttons || originalEvent.button;

					if (ring && (ring.downObject || !down)) {
                       var mapOpt = my._map ? my._map.options : {},
                            distanceUnit = mapOpt.distanceUnit,
                            squareUnit = mapOpt.squareUnit,
                            str = '';

                        if (type === 'Area') {
                            if (!L.gmxUtil.getArea) { return; }
                            if (ev.originalEvent.ctrlKey) {
                                str = _gtxt('Perimeter') + ': ' + L.gmxUtil.prettifyDistance(my.getLength(), distanceUnit);
                            } else {
                                str = _gtxt(type) + ': ' + L.gmxUtil.prettifyArea(my.getArea(), squareUnit);
                            }
                            my._parent.showTooltip(ev.layerPoint, str);
                        } else if (type === 'Length') {
                            var downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map, my),
                                length = ring.getLength(downAttr),
                                titleName = (downAttr.mode === 'edit' || downAttr.num > 1 ? downAttr.type : '') + type,
                                title = _gtxt(titleName);
                            str = (title === titleName ? _gtxt(type) : title) + ': ' + L.gmxUtil.prettifyDistance(length, distanceUnit);
                            my._parent.showTooltip(ev.layerPoint, str);
                        }
                        my._fireEvent('onMouseOver');
					}
                };
                this.hideTooltip = function() {
                    this._parent.hideTooltip();
                    this._fireEvent('onMouseOut');
                };
                this.getTitle = _gtxt;
            }
        } else if (this.options.type === 'Point') {
            this._setMarker(obj);
        } else {
            this.addLayer(obj);
        }
    },

    _initStaticTooltip: function () {
		this.on('drawstop editstop', function (ev) {
			if (this.staticTooltip) {
				this._removeStaticTooltip();
			}

			var latlng = ev.latlng,
				map = this._map,
				mapOpt = map ? map.options : {},
				distanceUnit = mapOpt.distanceUnit,
				squareUnit = mapOpt.squareUnit,
				tCont = L.DomUtil.create('div', 'content'),
				info = L.DomUtil.create('div', 'infoTooltip', tCont),
				closeBtn = L.DomUtil.create('div', 'closeBtn', tCont),
				polygon = this.options.type === 'Polygon',
				tOptions = {interactive: true, sticky: true, permanent: true, className: 'staticTooltip'};

			if (polygon) {
				if (this.options.endTooltip === 'center') {
					tOptions.direction = 'center';
					latlng = this.getBounds().getCenter();
				}
				info.innerHTML = L.gmxUtil.prettifyArea(this.getArea(), squareUnit);
			} else {
				tOptions.offset = L.point(10, 0);
				var arr = this.rings[0].ring.points.getLatLngs()[0];
				latlng = arr[arr.length - 1];
				info.innerHTML = L.gmxUtil.prettifyDistance(this.getLength(), distanceUnit);
			}
			closeBtn.innerHTML = '×';
			L.DomEvent.on(closeBtn, 'click', function() {
				this._removeStaticTooltip();
				this.remove();
			}, this);

			this.staticTooltip = L.tooltip(tOptions)
				.setLatLng(latlng)
				.setContent(tCont)
				.addTo(this._map);

			requestIdleCallback(function () {
				this.on('edit', this._removeStaticTooltip, this);
			}.bind(this), {timeout: 0});
		}, this);
    },

    _removeStaticTooltip: function () {
		if (this.staticTooltip) {
			this._map.removeLayer(this.staticTooltip);
			this.staticTooltip = null;
		}
    },

    _enableDrag: function () {
        this._parent._enableDrag();
    },

    _disableDrag: function () {
        this._parent._disableDrag();
    },

    _setMarker: function (marker) {
        var _this = this,
            _parent = this._parent,
			_map = _parent._map,
			mapOpt = _map ? _map.options : {};

        marker
            .bindPopup(null, {maxWidth: 1000, closeOnClick: mapOpt.maxPopupCount > 1 ? false : true})
            .on('dblclick', function() {
                if (_map) { _map.removeLayer(this); }
                _this.remove();
                //_parent.remove(this);
            })
            .on('dragstart', function() {
                _this._fireEvent('dragstart');
            })
            .on('drag', function(ev) {
				if (ev.originalEvent && ev.originalEvent.ctrlKey) {
					marker.setLatLng(L.GmxDrawing.utils.snapPoint(marker.getLatLng(), marker, _map));
				}
                _this._fireEvent('drag');
                _this._fireEvent('edit');
            })
            .on('dragend', function() {
                _this._fireEvent('dragend');
            })
            .on('popupopen', function(ev) {
                var popup = ev.popup;
                if (!popup._input) {
                    popup._input = L.DomUtil.create('textarea', 'leaflet-gmx-popup-textarea', popup._contentNode);
                    // popup._input.placeholder = _this.options.title || marker.options.title || '';
                    popup._input.value = _this.options.title || marker.options.title || '';
                    popup._contentNode.style.width = 'auto';
                }
                L.DomEvent.on(popup._input, 'keyup', function() {
                    var rows = this.value.split('\n'),
                        cols = this.cols || 0;

                    rows.forEach(function(str) {
                        if (str.length > cols) { cols = str.length; }
                    });
                    this.rows = rows.length;
                    if (cols) { this.cols = cols; }
                    popup.update();
                    _this.options.title = marker.options.title = this.value;
                    this.focus();
                }, popup._input);
                popup.update();
            });
        _map.addLayer(marker);

        _this.openPopup = marker.openPopup = function () {
            if (marker._popup && marker._map && !marker._map.hasLayer(marker._popup)) {
                marker._popup.setLatLng(marker._latlng);
                var gmxDrawing = marker._map.gmxDrawing;
                if (gmxDrawing._drawMode) {
                    marker._map.fire(gmxDrawing._createType ? 'click' : 'mouseup', {latlng: marker._latlng, delta: 1});
                } else {
                    marker._popup.addTo(marker._map);
                    marker._popup._isOpen = true;
                }
            }
            return marker;
        };
    },

    setAddMode: function () {
        if (this.rings.length) {
            this.rings[0].ring.setAddMode();
        }
		return this;
    },

    _pointDown: function (ev) {
        if (this.rings.length) {
            this.rings[0].ring._pointDown(ev);
        }
    },

    getPopup: function() {
        if (this.options.type === 'Point') {
            return this._obj.getPopup();
        }
    }
});


L.GmxDrawing.Ring = L.LayerGroup.extend({
    options: {
        className: 'leaflet-drawing-ring',
        //noClip: true,
        maxPoints: 0,
        smoothFactor: 0,
		noClip: true,
        opacity: 1,
        shape: 'circle',
        fill: true,
        fillColor: '#ffffff',
        fillOpacity: 1,
        size: L.Browser.mobile ? 40 : 8,
        weight: 2
    },
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    initialize: function (parent, coords, options) {
        options = options || {};

        this.contextmenu = new L.GmxDrawingContextMenu();
        options.mode = '';
        this._activeZIndex = options.activeZIndex || 7;
        this._notActiveZIndex = options.notActiveZIndex || 6;
        this.options = L.extend({}, this.options, parent.getStyle(), options);

        this._layers = {};
        this._coords = coords;
        this._legLength = [];
        this._parent = parent;

        this._initialize(parent, coords);
    },

    _initialize: function (parent, coords) {
        this.clearLayers();
        delete this.lines;
        delete this.fill;
        delete this.points;

        this.downObject = false;
        this.mode = '';
        this.lineType = this.options.type.indexOf('Polyline') !== -1;
		if (this.options.type === 'Rectangle') {
			this.options.disableAddPoints = true;
		}

        var pointStyle = this.options.pointStyle;
        var lineStyle = {opacity:1, weight:2, noClip: true, clickable: false, className: 'leaflet-drawing-lines'};
        if (!this.lineType) {
            lineStyle.fill = 'fill' in this.options ? this.options.fill : true;
        }
        if (this.options.lineStyle) {
            for (var key in this.options.lineStyle) {
                if (key !== 'fill' || !this.lineType) {
                    lineStyle[key] = this.options.lineStyle[key];
                }
            }
        }
        if (this.options.hole) {
            lineStyle = L.extend({}, lineStyle, L.GmxDrawing.utils.defaultStyles.holeStyle);
            pointStyle = L.extend({}, pointStyle, L.GmxDrawing.utils.defaultStyles.holeStyle);
        }

        var latlngs = coords,
            _this = this,
            mode = this.options.mode || (latlngs.length ? 'edit' : 'add');

        this.fill = new L.Polyline(latlngs, {
            className: 'leaflet-drawing-lines-fill',
            opacity: 0,
			smoothFactor: 0,
			noClip: true,
            fill: false,
            size: 10,
            weight: 10
        });
        this.addLayer(this.fill);

        this.lines = new L.Polyline(latlngs, lineStyle);
        this.addLayer(this.lines);

        if (!this.lineType && mode === 'edit') {
			// var latlng = L.GmxDrawing.utils.isOldVersion ? latlngs[0] : latlngs[0][0];
			var latlng = latlngs[0][0] || latlngs[0];
            this.lines.addLatLng(latlng);
            this.fill.addLatLng(latlng);
        }
        this.mode = mode;

        this.points = new L.GmxDrawing.PointMarkers(latlngs, pointStyle);
        this.points._parent = this;

        this.addLayer(this.points);
        this.points
            .on('mouseover', function (ev) {
				this.toggleTooltip(ev, true, _this.lineType ? 'Length' : 'Area');
                if (ev.type === 'mouseover') {
                    _this._recheckContextItems('points', _this._map);
                }
            }, this)
            .on('mouseout', this.toggleTooltip, this);
        this.fill
            .on('mouseover mousemove', function (ev) {
				this.toggleTooltip(ev, true);
            }, this)
            .on('mouseout', this.toggleTooltip, this);
        // this.lines
            // .on('mouseover', function (ev) {// console.log('lines___', ev);
				// this.toggleTooltip(ev, true);
            // }, this);

		if (this.points.bindContextMenu) {
			this.points.bindContextMenu({
				contextmenu: false,
				contextmenuInheritItems: false,
				contextmenuItems: []
			});
		}
    },
    toggleTooltip: function (ev, flag, type) {
		if ('hideTooltip' in this._parent) {
			ev.ring = this;
			if (flag) {
				type = type || 'Length';
				this._parent._showTooltip(type, ev);
			} else if (this.mode !== 'add') {
				this._parent.hideTooltip(ev);
			}
		}
	},

    _recheckContextItems: function (type, map) {
        var _this = this;
		this[type].options.contextmenuItems = map.gmxDrawing.contextmenu.getItems()[type]
			.concat(this._parent.contextmenu.getItems()[type])
			.concat(this.contextmenu.getItems()[type])
			.map(function(obj) {
				return {
					id: obj.text,
					text: L.GmxDrawing.utils.getLocale(obj.text),
					callback: obj.callback || function (ev) { _this._eventsCmd(obj, ev); }
				};
			});
    },

    _eventsCmd: function (obj, ev) {
		var ring = ev.relatedTarget._parent;
		var downAttr = L.GmxDrawing.utils.getDownType.call(ring, ev, ring._map, ring._parent);
		if (downAttr) {
			var type = obj.text;
			if (obj.callback) {
				obj.callback(downAttr);
			} else if (type === 'Remove point') {
				ring._removePoint(downAttr.num);
			} else if (type === 'Delete feature') {
                ring._parent.remove(ring);
			}
        }
    },

    getFeature: function () {
		return this._parent;
    },

    onAdd: function (map) {
        L.LayerGroup.prototype.onAdd.call(this, map);
        this.setEditMode();
    },

    onRemove: function (map) {
        if (this.points) {
            this._pointUp();
            this.removeAddMode();
            this.removeEditMode();

            if ('hideTooltip' in this._parent) { this._parent.hideTooltip(); }
        }
        L.LayerGroup.prototype.onRemove.call(this, map);
        if (this.options.type === 'Point') {
            map.removeLayer(this._obj);
        }
        this._fireEvent('removefrommap');
    },

    getLength: function (downAttr) {
        var length = 0,
            latlngs = this._getLatLngsArr(),
            len = latlngs.length;

        if (len) {
            var beg = 1,
                prev = latlngs[0];
            if (downAttr) {
                if (downAttr.type === 'node') {
                    len = downAttr.num + 1;
                } else {
                    beg = downAttr.num;
                    if (beg === len) {
                        prev = latlngs[beg - 1];
                        beg = 0;
                    } else {
                        prev = latlngs[beg - 1];
                    }
                    len = beg + 1;
                }
            }
            for (var i = beg; i < len; i++) {
                var leg = this._legLength[i] || null;
                if (leg === null) {
                    leg = L.gmxUtil.distVincenty(prev.lng, prev.lat, latlngs[i].lng, latlngs[i].lat);
                    this._legLength[i] = leg;
                }
                prev = latlngs[i];
                length += leg;
            }
        }
        return length;
    },

    _setPoint: function (latlng, nm, type) {
        if (!this.points) { return; }
        var latlngs = this._getLatLngsArr();
        if (this.options.type === 'Rectangle') {
			if (type === 'edge') {
                nm--;
                if (nm === 0) { latlngs[0].lng = latlngs[1].lng = latlng.lng; }
                else if (nm === 1) { latlngs[1].lat = latlngs[2].lat = latlng.lat; }
                else if (nm === 2) { latlngs[2].lng = latlngs[3].lng = latlng.lng; }
                else if (nm === 3) { latlngs[0].lat = latlngs[3].lat = latlng.lat; }
            } else {
                latlngs[nm] = latlng;
                if (nm === 0) { latlngs[3].lat = latlng.lat; latlngs[1].lng = latlng.lng; }
                else if (nm === 1) { latlngs[2].lat = latlng.lat; latlngs[0].lng = latlng.lng; }
                else if (nm === 2) { latlngs[1].lat = latlng.lat; latlngs[3].lng = latlng.lng; }
                else if (nm === 3) { latlngs[0].lat = latlng.lat; latlngs[2].lng = latlng.lng; }
            }
            this._legLength = [];
        } else {
            latlngs[nm] = latlng;
            this._legLength[nm] = null;
            this._legLength[nm + 1] = null;
        }
        this.setLatLngs(latlngs);
    },

    addLatLng: function (point, delta) {
        this._legLength = [];
        if (this.points) {
            var points = this._getLatLngsArr(),
                maxPoints = this.options.maxPoints,
                len = points.length,
                lastPoint = points[len - 2],
				flag = !lastPoint || !lastPoint.equals(point);

            if (maxPoints && len >= maxPoints) {
				this.setEditMode();
				this._fireEvent('drawstop', {latlng: point});
				len--;
			}
            if (flag) {
                if (delta) { len -= delta; }    // reset existing point
                this._setPoint(point, len, 'node');
            }
			this._parent.lastAddLatLng = point;
        } else if ('addLatLng' in this._obj) {
            this._obj.addLatLng(point);
        }
    },

    setPositionOffset: function (p) {
        L.DomUtil.setPosition(this.points._container, p);
        L.DomUtil.setPosition(this.fill._container, p);
        L.DomUtil.setPosition(this.lines._container, p);
    },

    setLatLngs: function (latlngs) {
		if (this.points) {
            var points = this.points;
            this.fill.setLatLngs(latlngs);
            this.lines.setLatLngs(latlngs);
            if (!this.lineType && this.mode === 'edit' && latlngs.length > 2) {
                this.lines.addLatLng(latlngs[0]);
                this.fill.addLatLng(latlngs[0]);
            }
            points.setLatLngs(latlngs);
        } else if ('setLatLngs' in this._obj) {
            this._obj.setLatLngs(latlngs);
        }
        this._fireEvent('edit');
    },

    _getLatLngsArr: function () {
		return L.GmxDrawing.utils.isOldVersion ? this.points._latlngs : this.points._latlngs[0];
    },

    // edit mode
    _pointDown: function (ev) {
        if (!this._map) {
            return;
        }
        if (L.Browser.ie || (L.gmxUtil && L.gmxUtil.gtIE11)) {
            this._map.dragging._draggable._onUp(ev); // error in IE
        }
        if (ev.originalEvent) {
            var originalEvent = ev.originalEvent;
            if (originalEvent.altKey) {	// altKey, shiftKey
                this._onDragStart(ev);
                return;
            } else if (originalEvent.which !== 1 && originalEvent.button !== 1) {
                return;
            }
        }
        var downAttr = L.GmxDrawing.utils.getDownType.call(this, ev, this._map, this._parent),
            type = downAttr.type,
            opt = this.options;

        this._lastDownTime = Date.now() + 100;
        this.down = downAttr;
        if (type === 'edge' && opt.type !== 'Rectangle') {
            if (opt.disableAddPoints) { return; }
            this._legLength = [];
            var num = downAttr.num,
                points = this._getLatLngsArr();
            points.splice(num, 0, points[num]);
            this._setPoint(ev.latlng, num, type);
        }
        this.downObject = true;
        this._parent._disableDrag();
        this._map
            .on('mousemove', this._pointMove, this)
            .on('mouseup', this._mouseupPoint, this);
    },

    _mouseupPoint: function (ev) {
		this._pointUp(ev);
        if (this.__mouseupPointTimer) { cancelIdleCallback(this.__mouseupPointTimer); }
		this.__mouseupPointTimer = requestIdleCallback(function() {
			this._fireEvent('editstop', ev);
		}.bind(this), {timeout: 250});
    },

    _pointMove: function (ev) {
        if (this.down && this._lastDownTime < Date.now()) {
            if (!this.lineType) {
                this._parent.showFill();
            }
            this._clearLineAddPoint();
            this._moved = true;

			var latlng = ev.originalEvent.ctrlKey ? L.GmxDrawing.utils.snapPoint(ev.latlng, this, this._map) : ev.latlng;
            this._setPoint(latlng, this.down.num, this.down.type);
			if ('_showTooltip' in this._parent) {
				ev.ring = this;
				this._parent._showTooltip(this.lineType ? 'Length' : 'Area', ev);
			}
        }
    },

    _pointUp: function (ev) {
        this.downObject = false;
        this._parent._enableDrag();
        if (!this.points) { return; }
        if (this._map) {
            this._map
                .off('mousemove', this._pointMove, this)
                .off('mouseup', this._mouseupPoint, this);

            var target = ev && ev.originalEvent ? ev.originalEvent.target : null;
            if (target && target._leaflet_pos && /leaflet-marker-icon/.test(target.className)) {
                var latlng = L.GmxDrawing.utils.getMarkerByPos(target._leaflet_pos, this._map.gmxDrawing.getFeatures());
                this._setPoint(latlng, this.down.num, this.down.type);
            }
            this._map._skipClick = true;    // for EventsManager
        }
        if (this._drawstop) {
            this._fireEvent('drawstop', ev);
        }
        this._drawstop = false;
        this.down = null;
        var lineStyle = this.options.lineStyle || {};
        if (!lineStyle.fill && !this.lineType) {
            this._parent.hideFill();
        }
    },
    _lastPointClickTime: 0,  // Hack for emulate dblclick on Point

    _removePoint: function (num) {
        var points = this._getLatLngsArr();
        if (points.length > num) {
            this._legLength = [];
            points.splice(num, 1);
            if (this.options.type === 'Rectangle'
                || points.length < 2
                || (points.length < 3 && !this.lineType)
                ) {
                this._parent.remove(this);
            } else {
                this._setPoint(points[0], 0);
            }
        }
	},

    _clearLineAddPoint: function () {
        if (this._lineAddPointID) { clearTimeout(this._lineAddPointID); }
        this._lineAddPointID = null;
    },

    _pointDblClick: function (ev) {
        this._clearLineAddPoint();
        if (!this.options.disableAddPoints && (!this._lastAddTime || Date.now() > this._lastAddTime)) {
            var downAttr = L.GmxDrawing.utils.getDownType.call(this, ev, this._map, this._parent);
            this._removePoint(downAttr.num);
        }
    },

    _pointClick: function (ev) {
        if (ev.originalEvent && ev.originalEvent.ctrlKey) { return; }
        var clickTime = Date.now(),
            prevClickTime = this._lastPointClickTime;

        this._lastPointClickTime = clickTime + 300;
        if (this._moved || clickTime < prevClickTime) { this._moved = false; return; }

        var downAttr = L.GmxDrawing.utils.getDownType.call(this, ev, this._map, this._parent),
            mode = this.mode;
        if (downAttr.type === 'node') {
            var num = downAttr.num;
            if (downAttr.end) {  // this is click on first or last Point
                if (mode === 'add') {
                    this._pointUp();
                    this.setEditMode();
                    if (this.lineType && num === 0) {
                        this._parent.options.type = this.options.type = 'Polygon';
                        this.lineType = false;
                        this._removePoint(this._getLatLngsArr().length - 1);
                    }
                    this._fireEvent('drawstop', downAttr);
                    this._removePoint(num);
                } else if (this.lineType) {
					this._clearLineAddPoint();
                    this._lineAddPointID = setTimeout(function () {
						if (num === 0) { this._getLatLngsArr().reverse(); }
						this.points.addLatLng(downAttr.latlng);
						this.setAddMode();
						this._fireEvent('drawstop', downAttr);
					}.bind(this), 250);
                }
            } else if (mode === 'add') { // this is add pont
                this.addLatLng(ev.latlng);
            }
        }
    },

    _onDragEnd: function () {
        this._map
            .off('mouseup', this._onDragEnd, this)
            .off('mousemove', this._onDrag, this);

		this._parent._enableDrag();
        this._fireEvent('dragend');
    },

    _onDragStart: function (ev) {
        this._dragstartPoint = ev.latlng;
        this._map
            .on('mouseup', this._onDragEnd, this)
            .on('mousemove', this._onDrag, this);
		this._parent._disableDrag();
        this._fireEvent('dragstart');
    },

    _onDrag: function (ev) {
        var lat = this._dragstartPoint.lat - ev.latlng.lat,
            lng = this._dragstartPoint.lng - ev.latlng.lng,
            points = this._getLatLngsArr();

        points.forEach(function (item) {
            item.lat -= lat;
            item.lng -= lng;
        });
        this._dragstartPoint = ev.latlng;

        this._legLength = [];
        this.setLatLngs(points);
        this._fireEvent('drag');
    },

    _fireEvent: function (name, options) {
        this._parent._fireEvent(name, options);
    },

    _startTouchMove: function (ev, drawstop) {
        var downAttr = L.GmxDrawing.utils.getDownType.call(this, ev, this._map, this._parent);
        if (downAttr.type === 'node') {
            this._parent._disableDrag();
            this.down = downAttr;
            //var num = downAttr.num;
            var my = this;
            var _touchmove = function (ev) {
                downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map, this._parent);
                    if (ev.touches.length === 1) { // Only deal with one finger
                        my._pointMove(downAttr);
                  }
            };
            var _touchend = function () {
                L.DomEvent
                    .off(my._map._container, 'touchmove', _touchmove, my)
                    .off(my._map._container, 'touchend', _touchend, my);
                my._parent._enableDrag();
                if (drawstop) {
                    my._parent.fire('drawstop', {mode: my.options.type, object: my});
                }
            };
            L.DomEvent
                .on(my._map._container, 'touchmove', _touchmove, my)
                .on(my._map._container, 'touchend', _touchend, my);
        }
    },

    _editHandlers: function (flag) {
        //if (!this.points) { return; }
        var stop = L.DomEvent.stopPropagation,
			prevent = L.DomEvent.preventDefault;
        if (this.touchstart) {
            L.DomEvent.off(this.points._container, 'touchstart', this.touchstart, this);
        }
        if (this.touchstartFill) {
            L.DomEvent.off(this.fill._container, 'touchstart', this.touchstartFill, this);
        }
        this.touchstart = null;
        this.touchstartFill = null;
        if (flag) {
            this.points
                .on('dblclick click', stop, this)
                .on('dblclick click', prevent, this)
                .on('dblclick', this._pointDblClick, this)
                .on('click', this._pointClick, this);
            if (L.Browser.mobile) {
                if (this._EditOpacity) {
                    this._parent._setPointsStyle({fillOpacity: this._EditOpacity});
                }
                var my = this;
                this.touchstart = function (ev) {
                    my._startTouchMove(ev);
                };
                L.DomEvent.on(this.points._container, 'touchstart', this.touchstart, this);
                this.touchstartFill = function (ev) {
                    var downAttr = L.GmxDrawing.utils.getDownType.call(my, ev, my._map, this._parent);
                    if (downAttr.type === 'edge' && my.options.type !== 'Rectangle') {
                        var points = my.points._latlngs;
                        points.splice(downAttr.num, 0, points[downAttr.num]);
                        my._legLength = [];
                        my._setPoint(downAttr.latlng, downAttr.num, downAttr.type);
                    }
                };
                L.DomEvent.on(this.fill._container, 'touchstart', this.touchstartFill, this);
            } else {
                this.points
                    .on('mousemove', stop)
                    .on('mousedown', this._pointDown, this);
                this.lines
                    .on('mousedown', this._pointDown, this);
                this.fill
                    .on('dblclick click', stop, this)
                    .on('mousedown', this._pointDown, this);
                this._fireEvent('editmode');
            }
        } else {
            this._pointUp();
            this.points
                .off('dblclick click', stop, this)
                .off('dblclick click', prevent, this)
                .off('dblclick', this._pointDblClick, this)
                .off('click', this._pointClick, this);
            if (!L.Browser.mobile) {
                this.points
                    .off('mousemove', stop)
                    .off('mousedown', this._pointDown, this);
                this.lines
                    .off('mousedown', this._pointDown, this);
                this.fill
                    .off('dblclick click', stop, this)
                    .off('mousedown', this._pointDown, this);
            }
        }
    },

    _createHandlers: function (flag) {
        if (!this.points || !this._map) { return; }
        var stop = L.DomEvent.stopPropagation;
        if (flag) {
			if (this._map.contextmenu) {
				this._map.contextmenu.disable();
			}

            this._parent._enableDrag();
            this._map
                .on('dblclick', stop)
                .on('mousedown', this._mouseDown, this)
                .on('mouseup', this._mouseUp, this)
                .on('mousemove', this._moseMove, this);
            this.points
                .on('click', this._pointClick, this);
            this._fireEvent('addmode');
            if (!this.lineType) { this.lines.setStyle({fill: true}); }
        } else {
            if (this._map) {
                this._map
                    .off('dblclick', stop)
                    .off('mouseup', this._mouseUp, this)
                    .off('mousemove', this._moseMove, this);
                this.points
                    .off('click', this._pointClick, this);
            }
            var lineStyle = this.options.lineStyle || {};
            if (!this.lineType && !lineStyle.fill) {
                this.lines.setStyle({fill: false});
            }
        }
    },

    setEditMode: function () {
        if (this.options.editable) {
            this._editHandlers(false);
            this._createHandlers(false);
            this._editHandlers(true);
            this.mode = 'edit';
        }
        return this;
    },

    setAddMode: function () {
        if (this.options.editable) {
            this._editHandlers(false);
            this._createHandlers(false);
            this._createHandlers(true);
            this.mode = 'add';
        }
        return this;
    },

    removeAddMode: function () {
        this._createHandlers(false);
        this.mode = '';
    },

    removeEditMode: function () {
        this._editHandlers(false);
        this.mode = '';
    },

    // add mode
    _moseMove: function (ev) {
        if (this.points) {
            var points = this._getLatLngsArr(),
				latlng = ev.latlng;
            if (ev.originalEvent.ctrlKey) { latlng = L.GmxDrawing.utils.snapPoint(latlng, this, this._map); }
            if (points.length === 1) { this._setPoint(latlng, 1); }

            this._setPoint(latlng, points.length - 1);
			this.toggleTooltip(ev, true, this.lineType ? 'Length' : 'Area');
        }
    },

    _mouseDown: function () {
        this._lastMouseDownTime = Date.now() + 200;
    },

    _mouseUp: function (ev) {
        var timeStamp = Date.now();
        if (ev.delta || timeStamp < this._lastMouseDownTime) {
            this._lastAddTime = timeStamp + 1000;

			var _latlngs = this._getLatLngsArr();
			if (ev.originalEvent && ev.originalEvent.which === 3
				&& this.points && _latlngs && _latlngs.length) {	// for click right button

				this.setEditMode();
				this._removePoint(_latlngs.length - 1);
				this._pointUp();
				this._fireEvent('drawstop');
				if (this._map && this._map.contextmenu) {
					requestIdleCallback(this._map.contextmenu.enable.bind(this._map.contextmenu), {timeout: 250});
				}
			} else {
				var latlng = ev._latlng || ev.latlng;
				if (ev.delta) { this.addLatLng(latlng, ev.delta); }    // for click on marker
				this.addLatLng(latlng);
			}
			this._parent._parent._clearCreate();
        }
    }
});


L.GmxDrawing.PointMarkers = L.Polygon.extend({
    options: {
        className: 'leaflet-drawing-points',
        noClip: true,
        smoothFactor: 0,
        opacity: 1,
        shape: 'circle',
        fill: true,
        fillColor: '#ffffff',
        fillOpacity: 1,
        size: L.Browser.mobile ? 40 : 8,
        weight: 2
    },
	_convertLatLngs: function (latlngs) {
		return L.Polyline.prototype._convertLatLngs.call(this, latlngs);
	},

    getRing: function () {
		return this._parent;
    },

    getFeature: function () {
		return this.getRing()._parent;
    },

    getPathLatLngs: function () {
        var out = [],
            size = this.options.size,
            dontsmooth = this._parent.options.type === 'Rectangle',
            points = this._parts[0],
            prev;

        for (var i = 0, len = points.length, p; i < len; i++) {
            p = points[i];
            if (i === 0 || dontsmooth || Math.abs(prev.x - p.x) > size || Math.abs(prev.y - p.y) > size) {
                out.push(this._latlngs[i]);
                prev = p;
            }
        }
        return out;
    },

    _getPathPartStr: function (points) {
        var round = L.Path.VML,
            size = this.options.size / 2,
            dontsmooth = this._parent.options.type === 'Rectangle',
            skipLastPoint = this._parent.mode === 'add' && !L.Browser.mobile ? 1 : 0,
            radius = (this.options.shape === 'circle' ? true : false),
            prev;

        for (var j = 0, len2 = points.length - skipLastPoint, str = '', p; j < len2; j++) {
            p = points[j];
            if (round) { p._round(); }
            if (j === 0 || dontsmooth || Math.abs(prev.x - p.x) > this.options.size || Math.abs(prev.y - p.y) > this.options.size) {
                if (radius) {
                    str += 'M' + p.x + ',' + (p.y - size) +
                           ' A' + size + ',' + size + ',0,1,1,' +
                           (p.x - 0.1) + ',' + (p.y - size) + ' ';
                } else {
                    var px = p.x, px1 = px - size, px2 = px + size,
                        py = p.y, py1 = py - size, py2 = py + size;
                    str += 'M' + px1 + ' ' + py1 + 'L' + px2 + ' ' + py1 + 'L' + px2 + ' ' + py2 + 'L' + px1 + ' ' + py2 + 'L' + px1 + ' ' + py1;
                }
                prev = p;
            }
        }
        return str;
    },

    _onMouseClick: function (e) {
        //if (this._map.dragging && this._map.dragging.moved()) { return; }
        this._fireMouseEvent(e);
    },

	_updatePath: function () {
		if (L.GmxDrawing.utils.isOldVersion) {
			if (!this._map) { return; }
			this._clipPoints();
			this.projectLatlngs();
			var pathStr = this.getPathString();

			if (pathStr !== this._pathStr) {
				this._pathStr = pathStr;
				if (this._path.getAttribute('fill-rule') !== 'inherit') {
					this._path.setAttribute('fill-rule', 'inherit');
				}
				this._path.setAttribute('d', this._pathStr || 'M0 0');
			}
		} else {
			var str = this._parts.length ? this._getPathPartStr(this._parts[0]) : '';
			this._renderer._setPath(this, str);
		}
	}
});


(function () {
	function GmxDrawingContextMenu(options) {
		this.options = options || {points: [], lines: []};
	}

	GmxDrawingContextMenu.prototype = {
		insertItem: function (obj, index, type) {
			var optKey = type || 'points';
			if (index === undefined) { index = this.options[optKey].length; }
			this.options[optKey].splice(index, 0, obj);
			return this;
		},

		removeItem: function (obj, type) {
			var optKey = type || 'points';
			for (var i = 0, len = this.options[optKey].length; i < len; i++) {
				if (this.options[optKey][i].callback === obj.callback) {
					this.options[optKey].splice(i, 1);
					break;
				}
			}
			return this;
		},

		removeAllItems: function (type) {
			if (!type) {
				this.options = {points: [], lines: []};
			} else if (type === 'lines') {
				this.options.lines = [];
			} else {
				this.options.points = [];
			}
			return this;
		},

		getItems: function () {
			return this.options;
		}
	};
	L.GmxDrawingContextMenu = GmxDrawingContextMenu;
})();


L.GmxDrawing.utils = {
	snaping: 10,			// snap distance
	isOldVersion: L.version.substr(0, 3) === '0.7',
	defaultStyles: {
        mode: '',
        map: true,
        editable: true,
        holeStyle: {
            opacity: 0.5,
            color: '#003311'
        },
        lineStyle: {
            opacity:1,
            weight:2,
            clickable: false,
            className: 'leaflet-drawing-lines',
            color: '#0033ff',
            dashArray: null,
            lineCap: null,
            lineJoin: null,
            fill: false,
            fillColor: null,
            fillOpacity: 0.2,
            smoothFactor: 0,
			noClip: true,
            stroke: true
        },
        pointStyle: {
            className: 'leaflet-drawing-points',
            smoothFactor: 0,
			noClip: true,
            opacity: 1,
            shape: 'circle',
            fill: true,
            fillColor: '#ffffff',
            fillOpacity: 1,
            size: L.Browser.mobile ? 40 : 8,
            weight: 2,
            clickable: true,
            color: '#0033ff',
            dashArray: null,
            lineCap: null,
            lineJoin: null,
            stroke: true
        },
        markerStyle: {
            mode: '',
            editable: false,
            title: 'Text example',
            options: {
                alt: '',
                //title: '',
                clickable: true,
                draggable: false,
                keyboard: true,
                opacity: 1,
                zIndexOffset: 0,
                riseOffset: 250,
                riseOnHover: false,
                icon: {
                    className: '',
                    iconUrl: '',
                    iconAnchor: [12, 41],
                    iconSize: [25, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                }
            }
        }
    },

    snapPoint: function (latlng, obj, map) {
		var res = latlng;
		if (L.GeometryUtil) {
			var drawingObjects = map.gmxDrawing.getFeatures()
					.filter(function(it) { return it !== obj._parent && it._obj !== obj; })
					.map(function(it) { return it.options.type === 'Point' ? it._obj : it; }),
					snaping = Number(map.options.snaping || L.GmxDrawing.utils.snaping),
					closest = L.GeometryUtil.closestLayerSnap(map, drawingObjects, latlng, snaping, true);

			if (closest) {
				res = closest.latlng;
			}
		}
		return res;
   },

    getNotDefaults: function(from, def) {
        var res = {};
        for (var key in from) {
            if (key === 'icon' || key === 'map') {
                continue;
            } else if (key === 'iconAnchor' || key === 'iconSize' || key === 'popupAnchor' || key === 'shadowSize') {
                if (!def[key]) { continue; }
                if (def[key][0] !== from[key][0] || def[key][1] !== from[key][1]) { res[key] = from[key]; }
            } else if (key === 'lineStyle' || key === 'pointStyle' || key === 'markerStyle') {
                res[key] = this.getNotDefaults(from[key], def[key]);
            } else if (!def || (def[key] !== from[key] || key === 'fill')) {
                res[key] = from[key];
            }
        }
        return res;
    },

    getShiftLatlng: function (latlng, map, shiftPixel) {
        if (shiftPixel && map) {
            var p = map.latLngToLayerPoint(latlng)._add(shiftPixel);
            latlng = map.layerPointToLatLng(p);
        }
        return latlng;
    },

    getDownType: function(ev, map, feature) {
        var layerPoint = ev.layerPoint,
			originalEvent = ev.originalEvent,
            ctrlKey = false, shiftKey = false, altKey = false,
            latlng = ev.latlng;
        if (originalEvent) {
            ctrlKey = originalEvent.ctrlKey; shiftKey = originalEvent.shiftKey; altKey = originalEvent.altKey;
        }
        if (ev.touches && ev.touches.length === 1) {
            var first = ev.touches[0],
                containerPoint = map.mouseEventToContainerPoint(first);
            layerPoint = map.containerPointToLayerPoint(containerPoint);
            latlng = map.layerPointToLatLng(layerPoint);
        }
        var out = {type: '', latlng: latlng, ctrlKey: ctrlKey, shiftKey: shiftKey, altKey: altKey},
            ring = this.points ? this : (ev.ring || ev.relatedEvent),
            points = ring.points._originalPoints || ring.points._parts[0] || [],
            len = points.length;

        if (len === 0) { return out; }

        var size = (ring.points.options.size || 10) / 2;
        size += 1 + (ring.points.options.weight || 2);

        var cursorBounds = new L.Bounds(
            L.point(layerPoint.x - size, layerPoint.y - size),
            L.point(layerPoint.x + size, layerPoint.y + size)
            ),
            prev = points[len - 1],
            lastIndex = len - (ring.mode === 'add' ? 2 : 1);

        out = {
            mode: ring.mode,
            layerPoint: ev.layerPoint,
            ctrlKey: ctrlKey, shiftKey: shiftKey, altKey: altKey,
            latlng: latlng
        };
        for (var i = 0; i < len; i++) {
            var point = points[i];
            if (feature.shiftPixel) { point = points[i].add(feature.shiftPixel); }
            if (cursorBounds.contains(point)) {
                out.type = 'node';
                out.num = i;
                out.end = (i === 0 || i === lastIndex ? true : false);
                break;
            }
            var dist = L.LineUtil.pointToSegmentDistance(layerPoint, prev, point);
            if (dist < size) {
                out.type = 'edge';
                out.num = (i === 0 ? len : i);
            }
            prev = point;
        }
        return out;
    },

    _getLastObject: function (obj) {
        if (obj.getLayers) {
            var layer = obj.getLayers().shift();
            return layer.getLayers ? this._getLastObject(layer) : obj;
        }
        return obj;
    },

    getMarkerByPos: function (pos, features) {
        for (var i = 0, len = features.length; i < len; i++) {
            var feature = features[i],
                fobj = feature._obj ? feature._obj : null,
                mpos = fobj && fobj._icon ? fobj._icon._leaflet_pos : null;
            if (mpos && mpos.x === pos.x && mpos.y === pos.y) {
                return fobj._latlng;
            }
        }
        return null;
    },

    getLocale: function (key) {
		var res = L.gmxLocale ? L.gmxLocale.getText(key) : null;
		return res || key;
    }
};



L.Map.addInitHook(function () {
    var corners = this._controlCorners,
        parent = this._controlContainer,
        tb = 'leaflet-top leaflet-bottom',
        lr = 'leaflet-left leaflet-right',
        classNames = {
            bottom: 'leaflet-bottom ' + lr,
            gmxbottomleft: 'leaflet-bottom leaflet-left',
            gmxbottomcenter: 'leaflet-bottom ' + lr,
            gmxbottomright: 'leaflet-bottom leaflet-right',
            center: tb + ' ' + lr,
            right:  'leaflet-right ' + tb,
            left:   'leaflet-left ' + tb,
            top:    'leaflet-top ' + lr
        };

    for (var key in classNames) {
        if (!corners[key]) {
            corners[key] = L.DomUtil.create('div', classNames[key], parent);
        }
    }
	
/*
        MAP.addControl(new L.Control.gmxDrawing({
            id: 'drawing'
            //,
            //drawOptions: {pointStyle:{shape: 'box', size: 8, fillOpacity: 0.8}, lineStyle:{fill: false, color: '#ff0000'}}
        }));

        var prefix = 'http://maps.kosmosnimki.ru/GetImage.ashx?usr=khaibrik%40scanex.ru&img=',
            onClick = function (ev) {
                console.log('click', arguments);
            },
            statechange = function (ev) {
                console.log('statechange', arguments, ev.target.options.isActive);
            };

        MAP.addControl(L.control.gmxIconGroup({
            id: 'myGroupControl',
            singleSelection: true,
            isSortable: true,
            items: [
                L.control.gmxIcon({
                    id: 'test1', title: 'Test icon', regularImageUrl: prefix + 'sled_walf.png'
                    })
                    .on('click', onClick)
                    .on('statechange', statechange)
                ,
                L.control.gmxIcon({
                    id: 'test2', title: 'Test icon2', regularImageUrl: prefix + 'logovo_walf.png'
                    })
                    .on('click', onClick)
                    .on('statechange', statechange)
            ]
        }));
	L.gmxUtil.requestLink('//www.kosmosnimki.ru/lib/geomixer_1.3/geomixer.css').then(function(ev) {
		console.log('glfx', window.fx);
	});
*/
	this.addControl(new L.Control.gmxDrawing({position: 'topright'}));
	L.gmxUtil.requestLink('//www.kosmosnimki.ru/lib/geomixer_1.3/geomixer.css');

});
