const refTypeMap = new Map();
const waitingMap = {};
const removeWaitingMap = {};

// Expending types
export const RefTypes = {
  Any: 0,
};

/**
 * Get map of a specific type
 *
 * @param {number} type type of ref
 * @returns {Map} existing / new map ref
 */
export const getRefMap = type => {
  if (refTypeMap.has(type)) {
    return refTypeMap.get(type);
  }

  const newMap = new Map();
  refTypeMap.set(type, newMap);
  return newMap;
};

/**
 * ES6 Promise version of getRef
 *
 * @param {string} name string identifier to exchange to ref
 * @param {number} type Ref type
 * @returns {Promise} resolves to ref
 */
export const whenRef = (name, type) => new Promise(resolve => {
  getRef(name, resolve, type);
});

/**
 * Promise version that wait for `removeRef()` and resolves to the last ref value
 *
 * @param {string} name Ref name
 * @param {number} type Ref type
 * @returns {Promise} resolves to ref value at the moment being removed
 */
export const whenRefRemoved = (name, type = RefTypes.Any) => new Promise(res => {
  const signature = `${type}_${name}`;

  if (!Array.isArray(removeWaitingMap[signature])) {
    removeWaitingMap[signature] = [];
  }

  removeWaitingMap[signature].push(res);
});

/**
 * Obtain ref of a given type (default get any), caution ref may not be instantly available, it's suggested to use getter function to guarantee success retrieval
 *
 * @param {string|Array} name identity of this ref, Array of strings can be provided to get multiple refs of a kind
 * @param {Function?} getter (ref) => {}, to be called once ref becomes available now or later, this can be omitted,
 * @param {number} type target type of this ref
 * @param {*} param to pass as second param in getter
 * @returns {null|*} target ref, could be null if not found
 */
export const getRef = (
  name,
  getter = null,
  type = RefTypes.Any,
  param = null,
) => {
  if (Array.isArray(name)) {
    let expected = name.length;
    let wait = false;
    const agetter = (instance, i) => {
      name[i] = instance;
      if (!--expected && getter) {
        getter(name, param);
      }
    };

    for (let i = 0, len = expected; i < len; i++) {
      const refName = name[i];
      if ((name[i] = getRef(refName, null, type)) && name[i] !== null) {
        expected--;
      } else {
        wait = true;
        name[i] = getRef(refName, agetter, type, i);
      }
    }

    if (wait) {
      return null;
    } else if (getter) {
      getter(name, param);
    }

    return name;
  }

  const mapOfTheType = getRefMap(type);
  if (mapOfTheType.has(name)) {
    // reference already exist - immediately invoke getter callback
    const result = mapOfTheType.get(name);
    if (getter) {
      getter(result, param, name);
    }
    return result;
  }

  if (!getter) {
    // reference not exist nor the getter, do nothing
    return null;
  }

  const signature = `${type}_${name}`;
  if (!waitingMap[signature]) {
    waitingMap[signature] = []; // creates waiting list for this type and name
  }

  waitingMap[signature].push(getter, param);
  return null;
};

/**
 * Add / Set / Save an ref by ref providers
 *
 * @param {string} name identity of this ref
 * @param {*} ref any ref you want to save
 * @param {number} type type of this ref
 * @returns {*} ref anything saved
 */
export const setRef = (name, ref, type = RefTypes.Any) => {
  const mapOfTheType = getRefMap(type);
  mapOfTheType.set(name, ref);

  const signature = `${type}_${name}`;
  if (!waitingMap[signature]) {
    return ref;
  }

  const waitingList = waitingMap[signature];

  for (let len = waitingList.length; len > 0; len -= 2) {
    const lGetter = waitingList.shift();
    const lParam = waitingList.shift();
    lGetter(ref, lParam, name);
  }

  if (!(0 in waitingList)) {
    // Reuse waiting list
    waitingMap[signature] = null;
  }
  return ref;
};

/**
 * Remove ref from map of given ref type
 *
 * @param {string} name ref name
 * @param {?number} type optional type of refs
 * @returns {*} the removed ref
 */
export const removeRef = (name, type = RefTypes.Any) => {
  const mapOfTheType = getRefMap(type);
  if (mapOfTheType && mapOfTheType.has(name)) {
    const signature = `${type}_${name}`;
    const result = mapOfTheType.get(name);
    mapOfTheType.delete(name);
    if (Array.isArray(removeWaitingMap[signature])) {
      for (let len = removeWaitingMap[signature].length; len > 0; len--) {
        removeWaitingMap[signature].shift()(result);
      }
    }
    return result;
  }
  return null;
};

/**
 * Create a new ref type id, if the name is existed, it will return existed type
 *
 * @param {string} name Ref type name
 * @returns {number} new ref type Id
 */
export const createRefType = name => {
  if (RefTypes[name]) {
    return RefTypes[name];
  }

  const nextCollectionId =
    (RefTypes._current || Math.max(...Object.values(RefTypes))) + 1;
  RefTypes._current = nextCollectionId;
  RefTypes[name] = nextCollectionId;
  return nextCollectionId;
};

let observers = null;

/**
 * Observe ref activities and return observer object to control it, observer is defaulting stop
 *
 * @param {string} name name of the reference
 * @param {?number} refType Type of ref, default Any
 * @param {?object} observersMap output object
 * @returns {object} control object of the observer { start(), stop(), flush(), addListener(), name, value }
 */
export const observeRef = (
  name,
  refType = RefTypes.Any,
  observersMap = observers,
) => {
  if (observers === null) {
    observers = {};
  }

  if (observersMap === null) {
    return observeRef(name, refType);
  }

  const signature = `${refType}_${name}`;

  if (signature in observersMap) {
    return observersMap[signature].observer;
  }

  let isStopped = true;

  const signal = (ref, old, refName) => {
    if (isStopped) {
      return;
    }
    const { listeners } = obj;

    if (Array.isArray(waitingMap[signature]) === false) {
      waitingMap[signature] = [];
    }

    waitingMap[signature].push(signal, ref); // wait next

    // Notify listeners
    for (let i = 0, len = listeners.length; i < len; i += 3) {
      if ("call" in listeners[i + 1]) {
        listeners[i + 1](ref, old, listeners[i + 2], refName);
      } else {
        // String type
        getRef(listeners[i + 1])(ref, old, listeners[i + 2], refName);
      }
    }
  };

  const obj = {
    listeners: [],
    observer: {
      refType,
      name,
      get value() {
        return getRef(name, null, refType);
      },

      /**
       * Flush (setRef) again when possible
       */
      flush() {
        const dat = getRef(name, null, refType);
        if (dat !== null) {
          setRef(name, dat, refType);
        }
      },

      /**
       * Start the observer, when ref changes, all listeners fires
       *
       * @param {boolean} [withFlush=false] whether to setRef or not
       */
      start: (withFlush = false) => {
        if (isStopped === false) {
          return;
        }

        isStopped = false;
        const dat = getRef(name, null, refType);
        if (withFlush !== true && dat !== null) {
          getRefMap(refType).delete(name);
        }
        getRef(name, signal, refType, withFlush === true ? null : dat);
        if (withFlush !== true && dat !== null) {
          getRefMap(refType).set(name, dat); // Pretend the data exist after _signal_ has been put in waiting list
        }
      },

      /**
       * Stop the observer
       */
      stop: () => {
        if (isStopped === true) {
          return;
        }

        isStopped = true;
        if (Array.isArray(waitingMap[signature])) {
          let idx = -1;
          while ((idx = waitingMap[signature].indexOf(signal)) > -1) {
            waitingMap[signature].splice(idx, 2);
          }
        }
      },

      /**
       * Add a persisting listener to this observer
       *
       * @param {Function|string} fn Stream function to handle every `setRef()`, expects `(ref, old, param, refName) => {}`
       * @param {*} param A thing to be brought back as 3rd param in `fnStream`
       * @returns {Function} function to remove this listener
       */
      addListener: (fn, param = null) => {
        const symbol = Symbol(`listener_${Date.now()}`);
        obj.listeners.push(symbol, fn, param);
        // Return remove listener
        return () => {
          let idx = -1;
          while ((idx = obj.listeners.indexOf(symbol)) > -1) {
            obj.listeners.splice(idx, 3);
          }
        };
      },
    },
  };

  observersMap[signature] = obj;

  return obj.observer;
};

export { createRefProxy } from "./proxy.js";
