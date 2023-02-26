const proxyMap = new WeakMap();

class RefProxyHandler {
  constructor(refAPI) {
    this.refAPI = refAPI;
  }

  get(obj, prop) {
    return this.refAPI.getRef(prop);
  }

  set(obj, prop, value) {
    obj[prop] = this.refAPI.setRef(prop, value);
    return true;
  }

  has(obj, key) {
    return this.refAPI.getRef(key) !== null;
  }

  deleteProperty(obj, prop) {
    if (prop in obj) {
      delete obj[prop];
      this.refAPI.unsetRef(prop);
      return true;
    }
    return false;
  }
}

/**
 * Creates a proxy instance to ease get / set / remove operations to be like object assignments
 *
 * @param {object} refAPI RefAPI instance
 * @param {object} target optional. target object to be proxified, you may set properties and values to sync inital refs
 * @returns {Proxy} proxy object help to manipulate ref
 */
export const createRefProxy = (refAPI, target = {}) => {
  for (const k in target) {
    refAPI.setRef(k, target[k]);
  }

  if (proxyMap.has(target)) {
    return proxyMap.get(target);
  }

  const proxy = new Proxy(target, new RefProxyHandler(refAPI));
  proxyMap.set(target, proxy);

  return proxy;
};
