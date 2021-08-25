import { describe, expect, test } from "@jest/globals";
import { getRef, RefTypes, setRef } from "./index.js";
import { createRefProxy } from "./proxy.js";
import crypto from "crypto";
import { performance } from "perf_hooks";

describe("Proxy", () => {
  test("create proxy", () => {
    const p = createRefProxy();
    p.gg = "abc";
    p.testing = 1234;

    expect(getRef("gg")).toBe("abc");
    expect(getRef("testing")).toBe(1234);
    expect(p.gg).toBe("abc");
    expect(p.testing).toBe(1234);

    setRef("omg", "should exist");
    expect(p.omg).toBe("should exist");
    p.omg = "should be modified";

    expect(getRef("omg")).toBe("should be modified");
    expect(Object.keys(p)).toEqual(["gg", "testing", "omg"]);

    delete p.gg;
    expect(getRef("gg")).toBeNull();
    expect(p.gg).toBeNull();

    expect(() => {
      delete p.notExist;
    }).toThrowError("'deleteProperty' on proxy: trap returned falsish for property 'notExist'");

  });

  test("reuse", () => {

    expect(createRefProxy()).not.toBe(createRefProxy());

    const target = {};

    expect(createRefProxy(RefTypes.Any, target)).toBe(createRefProxy(RefTypes.Any, target));
  });

  test("intensive call speed", () => {
    const sampleRate = 500000;
    const p = createRefProxy();

    const tuples = new Array(sampleRate)
      .fill("")
      .map(() => [crypto.randomBytes(16).toString("hex"), crypto.randomBytes(16).toString("hex")]);

    getRef(tuples[0][0], () => {
      console.log(`${sampleRate} operations took ${performance.now() - start}ms`); // eslint-disable-line no-console
    }, RefTypes.Any);

    const start = performance.now();
    for (let len = tuples.length; len > 0; len--) {
      const [left, right] = tuples[len - 1];
      p[left] = [right];
    }

    expect(Object.keys(p).length).toBe(sampleRate);

  });
});

