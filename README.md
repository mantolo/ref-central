# Ref Central

A ECMAScript module to store reference of any kind, be it class / objects / function / image / blob / file, you name it.
Those are all referred `ref`.  

Leveraging native `Map` with function callbacks, The ref central allows accessing ref anywhere in your application, it aims to act as light-weight signal / pub-sub with data storage solution, it's Promise-friendly due to it's one-time callback nature, it's also performance proof due to it's simplicity. It's use case including but not limited to: resource loader, promise races / async-await, global variables, data storage with change / removal events in performance-focused application...

Unlike famous frameworks, ref central does not provide plugin-like system or interface, but using it's iconic functions `getRef()`, `setRef()` and `removeRef()` alone already allows developer to create variety of extensions

## Installation

```shell
npm install --save ref-central
```

## Basic usage

### setRef

```javascript
// a.js
import { setRef } from "ref-central"

console.log(setRef("customData", { payload: "anything I want to pass in!" }));
 // print { payload: "anything I want to pass in!" }
```

### getRef

```javascript
// b.js
import './a.js';
import { getRef } from "ref-central"

const data = getRef("customData");
console.log(data); // print { payload: "anything I want to pass in!" }
```

### removeRef
```javascript
import "./b.js";
import { getRef, removeRef } from "ref-central";
removeRef("customData");

const data = getRef("customData");
console.log(data); // null
```

This looks too simple and silly isn't it? lets look into an other example

### one-time event listener

```javascript
// event-a.js
...
getRef("eventName", (evt) => {
  console.log("event-a", evt); 
});

// event-b.js
import "./event-a.js";

getRef("eventName", (evt) => {
  console.log("event-b", evt);
});

...
setRef("eventName", { target: "some target", data: { ... }  })

// prints 
// event-a { target: "some target", data: { ... }  }
// event-b { target: "some target", data: { ... }  }
```

What's different between event listener and ref-central is, the former subscribe event permanently, the later subscribe only just once. The idea is to encourage write ___subscribing as necessary code___. If you need to subscribe `eventName` continously, just do this:

```javascript
import { getRef, getNextRef } from "ref-central";

getRef("eventName", (ref, param, name, context) => {
  getNextRef("eventName", context, RefTypes.Any, param); // subscribe to only next ref with context which is identical function to current callback
}, RefTypes.Any);
```

### Promise

```javascript
// Forge your own
new Promise((resolve) => { getRef("signal", resolve); })

// Or use helper
import { whenRef } from "ref-central";

whenRef("someRef").then((ref) => {
  // ...
});

(async() => {
  const ref = await whenRef("someRef");
  // ...
})
```

You may also subscribe with promise to __only__ next `setRef()` with `whenNextRef()`, or when it's being removed by `removeRef()` with `whenRefRemoved()`

```javascript
import { whenRefRemoved, whenNextRef } from "ref-central";

whenRefRemoved("refToBeRemoved").then((ref) => {
  // Called when removeRef("refToBeRemoved") successfully removed the ref
  // ...  
});

whenNextRef("refToSetAgain").then((ref) => {
  // Called when additional setRef("refToSetAgain") is called
  // ...
});

```

## Misc

### RefTypes

It's like channel to isolate scope of data storing or signaling, simply create your ref type and use whenever `refType` param is required. All refs are stored in `RefTypes.Any` when such field is not specified.  

```javascript
import { createRefType, RefTypes, getRef, setRef } from "ref-central";

const newRefType = createRefType("MyRefType");

setRef("refName", "first data set", newRefType);
setRef("refName", "second data set");

// ...
const data = getRef("refName", null, newRefType);
// or aternatively
const data = getRef("refName", null, RefTypes.MyRefType);

console.log(data); // "first data set"
```

### Proxy

This is a syntax sugar helper leveraging native `Proxy` for ones who wants to use ref-central like normal object properties

```javascript
import { getRef, createRefProxy } from "ref-central";

const proxy = createRefProxy(); // default proxy to RefTypes.Any

proxy.refName = "whatever you like";

getRef("refName"); // "whatever you like"

setRef("otherRefName", "ref-central awesome!")

console.log(proxy.otherRefName); // "ref-central awesome!"

```

## Purpose definition

- **Zero** install dependency, can be used as soon as imported
- **One** time callback
- **Simple** as _key-value-pair_ `Map` objects
- Lightning fast I/O
- Supports getting ref both sync and async
- Categorize references by **ref types**, default `RefTypes.Any`
- Always return `null` instead of `undefined` when ref is not found


