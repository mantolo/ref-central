# Ref Central

A simple, __0 runtime dependencies__ ECMAScript module (ESM) library for lightning fast in-memory state I/O management.

`ref-central` is created to ease general purpose programing with unified interface, it's use case including but not limited to:
  - pub/sub with state
  - asynchronous I/O (Promise)
  - synchronous key / value map
  - mutation observer
  - data cache with TTL

Leveraging native API supporting in both Web & NodeJS environments, in conjunction of `Map`, `Array` and `Proxy` with function callbacks, The ref-central allow accessing ref (data) anywhere in your application with just simple I/O operations

Unlike famous frameworks, ref-central currently does not provide plugin-like system or interface, though it could be added in upcoming versions.

## Installation

```shell
npm install --save ref-central
```

## Usage

It starts with creating a ref-central instance

```javascript
import refCentral from "ref-central";

// API from instance
const {
  typeId, // context ID
  getRef,
  getNextRef,
  getUnsetRef,
  setRef,
  unsetRef,
  unsetAllRefs,
  whenRef,
  whenRefUnset,
  whenNextRef,
  listenRef,
  createProxy
} = refCentral(); // Creates a ref central context
```

### pub / sub

```javascript
const removeListener = listenRef("eventName", (data) => {
  // called on `setRef()`
  console.log(data); // { eventData: "some payload" }
});

...

// `setRef()` serve as `dispatch()`
setRef("eventName", { eventData: "some payload" });

// You can even get the latest event data object by getRef
console.log(getRef("eventName")); // { eventData: "some payload" }
```

### async I/O

```javascript

// Some async process...
setTimeout(() => {
  setRef("asyncRef", { asyncResource: "async" }); 
}, 100);

// You may use handy whenRef
whenRef("asyncRef").then((ref) => {
  console.log(ref); // { asyncResource: "async" }
});

// or getRef()
getRef("asyncRef", (ref) => {
  console.log(ref); // { asyncResource: "async" }
});
```

### getRef, setRef, unsetRef, getNextRef

```javascript
console.log(getRef("customData", (ref) => {
  console.log(ref); // a
})); // null

getUnsetRef("customData", (ref) => {
  console.log(ref); // d
});

whenRefUnset("customData").then((ref) => {
  console.log(ref); // d
});

setRef("customData", "a");
getRef("customData", (ref) => {
  console.log(ref); // a
});
getNextRef("customData", (ref) => {
  console.log(ref); // b
});
setRef("customData", "b");
setRef("customData", "c");
setRef("customData", "d");
unsetRef("customData");

console.log(getRef("customData")); // null
```

### proxy

This is a syntax sugar helper leveraging native `Proxy` for ones who wants to use ref-central like normal object properties

```javascript
const proxy = createProxy(); // default proxy to RefTypes.Any

proxy.refName = "whatever you like";

getRef("refName"); // "whatever you like"

setRef("otherRefName", "ref-central awesome!")

console.log(proxy.otherRefName); // "ref-central awesome!"
```

## Purpose definition

- **Zero** run-time dependencies, can be used as soon as imported
- **One** time callback
- **Simple** as it should
- Lightning fast I/O
- Supports getting ref both sync and async
- Isolated by context
- Always return `null` instead of `undefined` when ref is not found


