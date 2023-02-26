/*
 * TODO: make it react hook?
 * TODO: middlewares
 */
import { createRefProxy } from "./proxy.js";

const refTypeMap = new Map();
const waitingMap = {};
const removeWaitingMap = {};

/**
 * Get map of a specific type
 *
 * @param {number} refType type of ref
 * @returns {Map} existing / new map ref
 */
const getRefMap = refType => {
  if (refTypeMap.has(refType)) {
    return refTypeMap.get(refType);
  }

  const map = new Map();
  refTypeMap.set(refType, map);

  return map;
};

/**
 * ES6 Promise version of getRef
 *
 * @param {string} name string identifier to exchange to ref
 * @param {number} refType Ref type
 * @returns {Promise} resolves to ref
 */
const whenRef = (name, refType) => new Promise(resolve => {
  getRef(name, resolve, refType);
});

/**
 * Creates a promise that resolve when next ref is set
 *
 * @param {string} name ref name
 * @param {number} refType ref type
 * @returns {Promise} resolves to next ref
 */
const whenNextRef = (name, refType = 0) => new Promise(resolve => {
  getNextRef(name, resolve, refType);
});

/**
 * Promise version that wait for `unsetRef()` and resolves to the last ref value
 *
 * @param {string} name Ref name
 * @param {number?} refType Ref type
 * @returns {Promise} resolves to ref value at the moment being removed
 */
const whenRefUnset = (name, refType = 0) => new Promise(resolve => {
  getUnsetRef(name, resolve, refType);
});

/**
 * Obtain ref of a given type (default get any), caution ref may not be instantly available, it's suggested to use getter function to guarantee success retrieval
 *
 * @param {string|Array} name identity of this ref, Array of strings can be provided to get multiple refs of a kind
 * @param {Function?} getter (ref) => {}, to be called once ref becomes available now or later, this can be omitted,
 * @param {number} refType target type of this ref
 * @param {any} param to pass as second param in getter
 * @returns {null|any} target ref, could be null if not found
 */
const getRef = (
  name,
  getter = null,
  refType = 0,
  param = null,
) => {
  if (Array.isArray(name)) {
    const arr = [...name];
    let expected = name.length;
    let wait = false;
    const agetter = (instance, i) => {
      arr[i] = instance;
      if (!--expected && getter) {
        getter(arr, param, name, getter);
      }
    };

    for (let i = 0, len = expected; i < len; i++) {
      const refName = arr[i];
      if ((arr[i] = getRef(refName, null, refType)) && arr[i] !== null) {
        expected--;
      } else {
        wait = true;
        arr[i] = getRef(refName, agetter, refType, i);
      }
    }

    if (wait) {
      return null;
    } else if (getter) {
      getter(arr, param, name, getter);
    }

    return arr;
  }

  const mapOfTheType = getRefMap(refType);
  if (mapOfTheType.has(name)) {
    // reference already exist - immediately invoke getter callback
    const result = mapOfTheType.get(name);
    if (getter) {
      getter(result, param, name, getter);
    }
    return result;
  }

  if (!getter) {
    // reference not exist nor the getter, do nothing
    return null;
  }

  const signature = `${refType}_${name}`;

  if (!waitingMap[signature]?.push(getter, param)) {
    waitingMap[signature] = [getter, param];
  }

  return null;
};

/**
 * Not getting current existing ref, but next setRef()
 *
 * @param {string} name ref name
 * @param {Function} getter ref getter function
 * @param {number} refType ref type
 * @param {*} param any
 * @returns {void} nothing
 */
const getNextRef = (name, getter, refType = 0, param = null) => {
  if (!getter?.call) {
    return;
  }

  const signature = `${refType}_${name}`;
  getRefMap(refType);
  if (!waitingMap[signature]?.push(getter, param)) {
    waitingMap[signature] = [getter, param];
  }

};

/**
 * Get ref only when it's being removed
 *
 * @param {string} name ref name
 * @param {Function} getter the getter function
 * @param {number} refType ref type
 * @param {*} param anything to pass as getter function 2nd callback
 * @returns {void} nothing
 */
const getUnsetRef = (name, getter, refType = 0, param = null) => {
  if (!getter?.call) {
    return;
  }

  const signature = `${refType}_${name}`;
  getRefMap(refType);
  if (!removeWaitingMap[signature]?.push(getter, param)) {
    removeWaitingMap[signature] = [getter, param];
  }
};

/**
 * Add / Set / Save an ref by ref providers
 *
 * @param {string} name identity of this ref
 * @param {any} ref any ref you want to save
 * @param {number} refType type of this ref
 * @returns {any} ref anything saved
 */
const setRef = (name, ref, refType = 0) => {
  const mapOfTheType = getRefMap(refType);
  mapOfTheType.set(name, ref);
  const signature = `${refType}_${name}`;
  if (!waitingMap[signature]) {
    return ref;
  }

  const waitingList = waitingMap[signature];

  for (let len = waitingList.length; len > 0; len -= 2) {
    const lGetter = waitingList.shift();
    const lParam = waitingList.shift();
    lGetter(ref, lParam, name, lGetter);
  }

  if (!(0 in waitingList)) {
    waitingMap[signature] = null;
  }
  return ref;
};

/**
 * Remove ref from map of given ref type
 *
 * @param {string} name ref name
 * @param {?number} refType optional type of refs
 * @returns {*} the removed ref
 */
const unsetRef = (name, refType = 0) => {
  const mapOfTheType = getRefMap(refType);
  if (mapOfTheType.has(name)) {
    const signature = `${refType}_${name}`;
    const result = mapOfTheType.get(name);
    const waitingList = removeWaitingMap[signature];
    mapOfTheType.delete(name);
    if (Array.isArray(waitingList)) {
      for (let len = waitingList.length; len > 0; len -= 2) {
        const fn = waitingList.shift();
        const param = waitingList.shift();
        fn(result, param);
      }
    }
    return result;
  }
  return null;
};

let typeCount = 0;

export default fnInit => {
  const typeId = typeCount++;

  // The Ref interface
  const api = {
    typeId,

    /**
     * Obtain ref, if ref exist, it will both return and callback the ref synchronously, if ref doesn't already exist, only callback will be called when `setRef` is invoked else where
     *
     * @param {string|Array} nameOrDeps identity of this ref, Array of strings can be provided to get multiple refs of a kind
     * @param {Function?} getter (ref) => {}, to be called once ref becomes available now or later, this can be omitted
     * @param {any} param to pass as second param in getter
     * @returns {null|any} target ref, could be null if not found
     */
    getRef: (nameOrDeps, getter, param) => getRef(nameOrDeps, getter, typeId, param),
    getNextRef: (name, getter, param) => getNextRef(name, getter, typeId, param),

    /**
     * Listen to changes of target ref identity, starting only from next `setRef`
     *
     * @param {string} name identity of target ref caller wants to listen
     * @param {Function} getter (ref) => {}, to be called each per target ref change until remove listener function is called
     * @param {any} param optional, extra param to bind with the given getter callback
     * @returns {Function} remove listener
     */
    listenRef: (name, getter, param) => {
      let isEnded = false;
      const refCallback = (data, lParam, refName, lGetter) => {

        if (isEnded) {
          return;
        }

        getNextRef(refName, lGetter, typeId, lParam);
        getter(data, lParam, refName, lGetter);
      };

      getNextRef(name, refCallback, typeId, param);

      return () => {
        isEnded = true;
      };
    },

    /**
     * Get ref when it's being removed i.e. related `unsetRef` is called
     *
     * @param {string} name ref name
     * @param {Function} getter the getter function
     * @param {*} param anything to pass as getter function 2nd callback
     * @returns {void}
     */
    getUnsetRef: (name, getter, param) => getUnsetRef(name, getter, typeId, param),

    /**
     * Add / Set / Save an ref, this will trigger relative `getRef` callbacks, you may
     *
     * @param {string} name identity of this ref
     * @param {any} data any ref you want to save
     * @param {number?} ttl optional, time-to-live for this ref, in seconds
     * @returns {any} ref anything saved
     */
    setRef: (name, data, ttl) => {
      if (typeof ttl === "number" && ttl > 0) {
        setTimeout(() => {
          unsetRef(name, typeId);
        }, ttl * 1000);
      }
      return setRef(name, data, typeId);
    },

    /**
     * Remove ref, this will essentially trigger `getUnsetRef` callbacks
     *
     * @param {string} name ref name
     * @returns {*} the removed ref
     */
    unsetRef: name => unsetRef(name, typeId),
    unsetAllRefs: () => {
      const fullMap = getRefMap(typeId);
      const list = [...fullMap.keys()];

      for (const name of list) {
        unsetRef(name, typeId);
      }

      fullMap.clear();
    },
    whenRef: name => whenRef(name, typeId),
    whenNextRef: name => whenNextRef(name, typeId),
    whenRefUnset: name => whenRefUnset(name, typeId),
    createProxy: target => createRefProxy(api, target),
  };

  fnInit?.(api);

  return api;
};
