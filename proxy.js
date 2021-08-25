import { getRef, RefTypes, removeRef, setRef } from "./index.js";

const proxyMap = new WeakMap();

class RefProxyHandler {
  constructor(refType) {
    this.refType = refType;
  }

  get(obj, prop) {
    return getRef(prop, null, this.refType);
  }

  set(obj, prop, value) {
    obj[prop] = setRef(prop, value, this.refType);
    return true;
  }

  has(obj, key) {
    return getRef(key, null, this.refType) !== null;
  }

  deleteProperty(obj, prop) {
    if (prop in obj) {
      delete obj[prop];
      removeRef(prop, this.refType);
      return true;
    }
    return false;
  }
}

/**
 * Creates a proxy instance to ease get / set / remove operations to be like object assignments
 *
 * @param {number} refType optional. default using Any channel
 * @param {object} target optional. target object to be proxified, you may set properties and values to sync inital refs
 * @returns {Proxy} proxy object help to manipulate ref
 */
export const createRefProxy = (refType = RefTypes.Any, target = {}) => {
  for (const k in target) {
    setRef(k, target[k], refType);
  }

  if (proxyMap.has(target)) {
    return proxyMap.get(target);
  }

  const proxy = new Proxy(target, new RefProxyHandler(refType));
  proxyMap.set(target, proxy);

  return proxy;
};
