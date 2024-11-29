import fs from "node:fs";

import { getHttrackArgs, runHttrack, getHttrackProgress } from "./httrack";
import { jwt } from "../constants.js";

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

describe('getHttrackProgress', () => {
  it('should return progress', async () => {
    const progress = await getHttrackProgress('/tmp/www.all.net');

    expect(progress).toMatchSnapshot();
  });
});
