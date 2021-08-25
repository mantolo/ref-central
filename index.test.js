import { beforeEach, describe, expect, test } from "@jest/globals";
import {
  createRefType,
  getRef,
  getRefMap,
  observeRef,
  RefTypes,
  removeRef,
  setRef,
  whenRef,
  whenRefRemoved,
} from "./index.js";

describe("Basic ref central", () => {

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

  test("remove ref", () => {
    expect(whenRefRemoved("predefined")).resolves.toEqual({ payload: "somedata" });
    setRef("predefined", { payload: "somedata" });
    expect(getRef("predefined")).toEqual({ payload: "somedata" });
    removeRef("predefined");
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

  test("observer basic", () => {
    const observer = observeRef("some little ref");

    expect(observer.refType).toBe(RefTypes.Any);
    expect(observer.name).toBe("some little ref");

    // Call safety check
    observer.start();
    observer.start();
    observer.stop();
    observer.stop();
    observer.flush();
    observer.flush();

    const remove = observer.addListener((ref, old, param, refName) => {
      expect(ref.type).toBe("little ref");
      expect(param).toEqual({ staticPayload: "staticPayload" });
      expect(refName).toBe("some little ref");
      expect(old).not.toEqual(ref);
    }, { staticPayload: "staticPayload" });

    expect(remove).toBeInstanceOf(Function);

    setRef("some little ref", { type: "little ref", payload: "some ref data" });
    observer.start(true);
    expect(observer.value).toEqual({ type: "little ref", payload: "some ref data" });
    setRef("some little ref", { type: "little ref", payload: "some other ref data" });
    expect(observer.value).toEqual({ type: "little ref", payload: "some other ref data" });
    observer.stop();
    observer.flush();
    setRef("some little ref", { type: "little tiny ref", payload: "irrelavent data" }); // this won't print
    expect(observer.value).toEqual({ type: "little tiny ref", payload: "irrelavent data" }); // value still change
    remove();
    observer.start(true);
    setRef("some little ref", { type: "you can not hear me!", payload: "blah blah" });

  });

});
