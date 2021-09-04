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
 * @param {number} refType type of ref
 * @returns {Map} existing / new map ref
 */
export const getRefMap = refType => {
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
export const whenRef = (name, refType) => new Promise(resolve => {
  getRef(name, resolve, refType);
});

/**
 * Creates a promise that resolve when next ref is set
 *
 * @param {string} name ref name
 * @param {number} refType ref type
 * @returns {Promise} resolves to next ref
 */
export const whenNextRef = (name, refType = RefTypes.Any) => new Promise(resolve => {
  getNextRef(name, resolve, refType);
});

/**
 * Promise version that wait for `removeRef()` and resolves to the last ref value
 *
 * @param {string} name Ref name
 * @param {number} type Ref type
 * @param refType
 * @returns {Promise} resolves to ref value at the moment being removed
 */
export const whenRefRemoved = (name, refType = RefTypes.Any) => new Promise(resolve => {
  getRemoveRef(name, resolve, refType);
});

/**
 * Obtain ref of a given type (default get any), caution ref may not be instantly available, it's suggested to use getter function to guarantee success retrieval
 *
 * @param {string|Array} name identity of this ref, Array of strings can be provided to get multiple refs of a kind
 * @param {Function?} getter (ref) => {}, to be called once ref becomes available now or later, this can be omitted,
 * @param {number} refType target type of this ref
 * @param refType
 * @param {*} param to pass as second param in getter
 * @returns {null|*} target ref, could be null if not found
 */
export const getRef = (
  name,
  getter = null,
  refType = RefTypes.Any,
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
 * @returns nothing
 */
export const getNextRef = (name, getter, refType = RefTypes.Any, param = null) => {
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
 * @returns nothing
 */
export const getRemoveRef = (name, getter, refType = RefTypes.Any, param = null) => {
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
 * @param {*} ref any ref you want to save
 * @param {number} refType type of this ref
 * @returns {*} ref anything saved
 */
export const setRef = (name, ref, refType = RefTypes.Any) => {
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
export const removeRef = (name, refType = RefTypes.Any) => {
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
export { createRefProxy } from "./proxy.js";
