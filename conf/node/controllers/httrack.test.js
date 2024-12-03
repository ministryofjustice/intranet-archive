import fs from "node:fs";
import { afterAll, beforeEach, it, jest } from "@jest/globals";

import {
  getHttrackArgs,
  runHttrack,
  getHttrackProgress,
  waitForHttrackComplete,
} from "./httrack";
import { jwt } from "../constants.js";

// Skip long tests when running in watch mode.
const skipLongTests = process.env.npm_lifecycle_event === "test:watch";

describe("getHttrackArgs", () => {
  it("should return an array of arguments", async () => {
    const options = {
      url: new URL("https://intranet.justice.gov.uk/"),
      dest: "/tmp/test-snapshot",
      agency: "hq",
      jwt,
    };

    const args = getHttrackArgs(options);

    // Redacted args
    const redactedArgs = args.map((entry) => entry.replace(jwt, "***"));

    // Compare to snapshot
    expect(redactedArgs).toMatchSnapshot();
  });
});

describe("runHttrack", () => {
  beforeAll(() => {
    // Mock console.log so the tests are quiet.
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    // Restore console.log
    jest.restoreAllMocks();
  });

  it("should run httrack with arguments", async () => {
    const { listener, promise } = runHttrack([
      "http://www.all.net/",
      "-O",
      "/tmp/www.all.net",
      "+*.all.net/*",
      "-v",
      "-r2",
    ]);

    // listener should have a pid, it should be a number
    expect(listener.pid).toBeGreaterThan(0);

    const exitCode = await promise;

    expect(exitCode).toBe(0);
  });
});

describe("getHttrackProgress", () => {
  if (skipLongTests) {
    it.skip("should return progress", async () => {});
    return;
  }

  beforeAll(() => {
    // Mock console.log so the tests are quiet.
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    // Restore console.log
    jest.restoreAllMocks();
  });

  it("should return progress", async () => {
    // Delete the folder fontents /tmp/www.all.net
    fs.rmSync("/tmp/www.all.net", { recursive: true });

    // console.log(process.env);
    // Get some test data.
    const { listener, promise } = runHttrack([
      "http://www.all.net/",
      "-O",
      "/tmp/www.all.net",
      "+*.all.net/*",
      "-v",
      "-r10",
    ]);

    // await promise;

    // Wait for 0.5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    /**
     * 1️⃣ Get the progress for the 1st time.
     */
    const results1 = await getHttrackProgress("/tmp/www.all.net");

    expect(results1.complete).toBe(false);
    expect(results1.rate).toBeGreaterThan(0);
    expect(results1.requestCount).toBeGreaterThan(0);

    /**
     * 2️⃣ Get the progress for the 2nd time - immediately after the process has finished.
     */

    await promise;

    const results2 = await getHttrackProgress("/tmp/www.all.net");

    expect(results2.complete).toBe(true);
    expect(results2.rate).toBeGreaterThan(0);
    expect(results2.requestCount).toBeGreaterThan(results1.requestCount);

    /**
     * 3️⃣ Get the progress for the 3rd time - 5 seconds after the process has finished.
     */

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const results3 = await getHttrackProgress("/tmp/www.all.net");

    expect(results3.rate).toBe(0);
    expect(results3.complete).toBe(true);
  }, 20_000);
});

describe("waitForHttrackComplete", () => {
  beforeAll(() => {
    // Delete the folder fontents /tmp/www.all.net
    fs.rmSync("/tmp/www.all.net", { recursive: true });

    // Mock console.log so the tests are quiet.
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    // Restore console.log
    jest.restoreAllMocks();
  });

  it("should resolve when httrack is complete", async () => {
    const { promise } = runHttrack([
      "http://www.all.net/",
      "-O",
      "/tmp/www.all.net",
      "+*.all.net/*",
      "-v",
      "-r1",
    ]);

    const httrackComplete = await waitForHttrackComplete("/tmp/www.all.net");

    expect(httrackComplete).toStrictEqual({"timedOut": false});

    // Wait for the process to finish logging.
    await promise;
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it("should resolve when timeout is reached", async () => {
    const { promise } = runHttrack([
      "http://www.all.net/",
      "-O",
      "/tmp/www.all.net",
      "+*.all.net/*",
      "-v",
      "-r5",
    ]);

    const httrackComplete = await waitForHttrackComplete("/tmp/www.all.net", 2);

    expect(httrackComplete).toStrictEqual({"timedOut": true});

    // Wait for the process to finish logging.
    await promise;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 10_000);
});
