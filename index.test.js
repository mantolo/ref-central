import { beforeEach, describe, expect, test } from "@jest/globals";
import {
  createRefType,
  getNextRef,
  getRef,
  getRefMap,
  RefTypes,
  removeRef,
  setRef,
  whenRef,
  whenRefRemoved,
} from "./index.js";

describe.only("Basic ref central", () => {

  beforeEach(() => {
    Object.values(RefTypes).forEach(refType => {
      getRefMap(refType)?.clear();
    });
  });

  test("not exist", () => {
    expect(getRef("not exist")).toBeNull();
  });

  test("get and set", () => {
    expect(getRef("will exist")).toBeNull();

    expect(getRef("will exist", (ref, param) => {
      expect(ref).toBe("blah blah");
      expect(param).toBeNull();
    }, RefTypes.Any)).toBeNull();

    expect(getRef("will exist", (ref, param) => {
      expect(ref).toBe("blah blah");
      expect(param).toEqual({ someCustomParam: "data" });
    }, RefTypes.Any, { someCustomParam: "data" })).toBeNull();

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
    getNextRef("nextRef", ref => {
      expect(ref).toEqual({ nextExisting: "value.next" });
    }, RefTypes.Any, { parmProp: "paramValue" });
    setRef("nextRef", { nextExisting: "value.next" });
  });

  test("remove ref", async () => {
    expect(whenRefRemoved("predefined")).resolves.toEqual({ payload: "somedata" });
    setRef("predefined", { payload: "somedata" });
    expect(getRef("predefined")).toEqual({ payload: "somedata" });
    setTimeout(() => {
      removeRef("predefined");
    }, 0);
    await whenRefRemoved("predefined");
    expect(getRef("predefined")).toBeNull();
  });

  test("ref type", () => {
    const type = createRefType("NewRefType");
    expect(type).toBe(RefTypes.NewRefType);

    expect(createRefType("NewRefType")).toBe(type);
    expect(createRefType("NewRefType")).toBe(type);

    setRef("some ref name", { payload: "some data" }, type);

    expect(getRef("some ref name", null, type)).toEqual({ payload: "some data" });
    expect(getRef("some ref name")).toBeNull();
  });

  test("like event listener but only once", done => {
  // Fire event!
    setTimeout(() => {
      setRef("async ref", { type: "some event name", payload: "blah blah" });
      setRef("async ref", { type: "some other name", payload: "blah blah" });
    }, 100);

    expect(getRef("async ref", ref => {
      expect(ref).toEqual({ type: "some event name", payload: "blah blah" });
      done();
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

      // remove later
      setTimeout(() => {
        removeRef("async ref");
      }, 100);

      return whenRefRemoved("async ref");
    })
      .then(() => {
        expect(getRef("async ref")).toBeNull();
        done();
      });
  });
});
