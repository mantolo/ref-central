import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import createRef from "./index.js";

describe.only("Basic ref central", () => {

  const {
    getRef,
    setRef,
    getNextRef,
    getUnsetRef,
    unsetRef,
    whenRef,
    whenRefUnset,
    whenNextRef,
    unsetAllRefs,
    listenRef,
    createProxy,
  } = createRef();

  beforeEach(() => {
    unsetAllRefs();
  });

  test("not exist", () => {
    expect(getRef("not exist")).toBeNull();
  });

  test("get and set", () => {
    expect(getRef("will exist")).toBeNull();

    expect(getRef("will exist", (ref, param) => {
      expect(ref).toBe("blah blah");
      expect(param).toBeNull();
    })).toBeNull();

    expect(getRef("will exist", (ref, param) => {
      expect(ref).toBe("blah blah");
      expect(param).toEqual({ someCustomParam: "data" });
    }, { someCustomParam: "data" })).toBeNull();

    expect(setRef("will exist", "blah blah")).toBe("blah blah");
    expect(getRef("will exist")).toBe("blah blah");

    // Sync call race
    let raceResult = 0;
    raceResult = getRef("will exist", () => {
      expect(raceResult).toBe(0);
      raceResult = 1;
    }) && 2;

    expect(raceResult).toBe(2);
  });

  test("get array", () => {
    expect(whenRef(["a", "b", "c", "d"])).resolves.toEqual([
      { payload: "a" },
      { payload: "b" },
      { payload: "c" },
      { payload: "d" },
    ]);

    setRef("a", { payload: "a" });
    setRef("b", { payload: "b" });
    setRef("c", { payload: "c" });
    setRef("d", { payload: "d" });

    expect(getRef(["a", "b", "c", "d"], refList => {
      expect(refList).toEqual([
        { payload: "a" },
        { payload: "b" },
        { payload: "c" },
        { payload: "d" },
      ]);
    })).toEqual([
      { payload: "a" },
      { payload: "b" },
      { payload: "c" },
      { payload: "d" },
    ]);
  });

  test("get next", () => {
    setRef("nextRef", { existing: "value" });
    expect(getNextRef("nextRef")).toBeUndefined();
    getNextRef("nextRef", ref => {
      expect(ref).toEqual({ nextExisting: "value.next" });
    }, { parmProp: "paramValue" });
    setRef("nextRef", { nextExisting: "value.next" });

    expect(whenNextRef("nextRef")).resolves.toEqual({ nextExisting: "value.next.next" });
    setRef("nextRef", { nextExisting: "value.next.next" });
    expect(getRef("nextRef")).toEqual({ nextExisting: "value.next.next" });
  });

  test("unset ref", async () => {
    expect(unsetRef("predefined")).toBeNull();
    expect(getUnsetRef("predefined")).toBeUndefined();
    expect(whenRefUnset("predefined")).resolves.toEqual({ payload: "somedata" });
    setRef("predefined", { payload: "somedata" });
    expect(getRef("predefined")).toEqual({ payload: "somedata" });
    setTimeout(() => {
      expect(unsetRef("predefined")).toEqual({ payload: "somedata" });
    }, 0);
    await whenRefUnset("predefined");
    expect(getRef("predefined")).toBeNull();
  });

  test("ttl", done => {
    setRef("ttlRef", { shouldNotSeeMe: true }, 0.1);
    expect(getRef("ttlRef")).toEqual({ shouldNotSeeMe: true });
    const mock = jest.fn(ref => {
      expect(ref).toEqual({ someOtherRef: "hello" });
    });
    getUnsetRef("ttlRef", mock);
    setTimeout(() => {
      expect(getRef("ttlRef")).toBeNull();
      expect(mock).toBeCalled();
      expect(mock).toBeCalledTimes(1);
      done();
    }, 101);
    setRef("ttlRef", { someOtherRef: "hello" });
  });

  test("as event listener", done => {
    const mockFn = jest.fn();
    const removeListener = listenRef("async ref", mockFn);

    // Fire event!
    setTimeout(() => {
      setRef("async ref", { type: "some event name", payload: "blah blah" });
      setRef("async ref", { type: "some other name", payload: "blah blah" });
      removeListener();
      setRef("async ref", { type: "some another name", payload: "blah blah" });
      expect(mockFn).toBeCalledTimes(2);
      done();
    }, 100);
    expect(getRef("async ref", ref => {
      expect(ref).toEqual({ type: "some event name", payload: "blah blah" });
    })).toBeNull();

  });

  test("like promise", done => {
    expect(getRef("async ref")).toBeNull();

    // set later
    setTimeout(() => {
      setRef("async ref", { payload: "blah blah" });
    }, 100);

    whenRef("async ref").then(ref => {
      expect(getRef("async ref")).toEqual(ref);
      expect(ref).toEqual({ payload: "blah blah" });

      // Unset later
      setTimeout(() => {
        unsetRef("async ref");
      }, 100);

      return whenRefUnset("async ref");
    })
      .then(() => {
        expect(getRef("async ref")).toBeNull();
        done();
      });
  });

  test("createProxy", () => {
    const mock = jest.fn();
    expect(getRef("a", mock)).toBeNull();
    expect(getRef("b", mock)).toBeNull();
    expect(getRef("c", mock)).toBeNull();
    expect(getRef("d", mock)).toBeNull();

    const obj = createProxy({ a: 1, b: 2, c: 3 });
    expect(getRef("a")).toBe(1);
    expect(getRef("b")).toBe(2);
    expect(getRef("c")).toBe(3);
    expect(getRef("d")).toBeNull();
    obj.d = 4;
    expect(getRef("d")).toBe(4);
    expect(mock).toHaveBeenCalledTimes(4);
  });

  test("init", () => {
    const mock = jest.fn();
    createRef(mock);
    expect(mock).toBeCalledTimes(1);
  });
});
