import fs from "node:fs";
import http from "node:http";
import { afterAll, it, jest } from "@jest/globals";

import {
  getSnapshotPaths,
  getHttrackArgs,
  runHttrack,
  getHttrackProgress,
  waitForHttrackComplete,
} from "./httrack";
import { intranetUrls, intranetJwts } from "../constants.js";

// Skip long tests when running in watch mode.
const skipLongTests = process.env.npm_lifecycle_event === "test:watch";

describe("getSnapshotPaths", () => {
  it("should return the s3 and fs paths - production", () => {
    const env = "production";
    const agency = "hq";

    const paths = getSnapshotPaths({ env, agency });

    expect(paths).toStrictEqual({
      s3: `${agency}/${new Date().toISOString().slice(0, 10)}`,
      fs: `/tmp/snapshots/${agency}/${new Date().toISOString().slice(0, 10)}`,
    });
  });

  it("should return the s3 and fs paths - non-production", () => {
    const env = "dev";
    const agency = "hq";

    const paths = getSnapshotPaths({ env, agency });

    expect(paths).toStrictEqual({
      s3: `dev-${agency}/${new Date().toISOString().slice(0, 10)}`,
      fs: `/tmp/snapshots/dev-${agency}/${new Date()
        .toISOString()
        .slice(0, 10)}`,
    });
  });

  it("should return the s3 and fs paths - invalid env", () => {
    const env = "invalid";
    const agency = "hq";

    expect(() => getSnapshotPaths({ env, agency })).toThrowError(
      `Invalid environment: ${env}`,
    );
  });
});

describe("getHttrackArgs", () => {
  it("should return an array of arguments", async () => {
    const env = "production";
    const url = new URL(intranetUrls[env]);
    const jwt = intranetJwts[env];

    const options = {
      url,
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

    fs.rmSync("/tmp/www.all.net", { recursive: true, force: true });
    fs.rmSync("/tmp/news.ycombinator.com", { recursive: true, force: true });
  });

  afterAll(async () => {
    // Wait for httrack close message to log
    await new Promise((resolve) => setTimeout(resolve, 500));
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

  it("should run multiple system commands", async () => {
    // Remove src attributes (with double and single quotes).
    const script1 = `sed -i 's/src="[^"]*"//g' $0`;
    const script2 = `sed -i "s/src='[^']*'//g" $0`;
    // Replace a link for https://news.ycombinator.com/newsfaq.html with a link to https://example.com
    const script3 = `sed -i 's|href="https://news.ycombinator.com/newsfaq.html"|href="/example.html"|g' $0`;

    const { listener, promise } = runHttrack([
      "https://news.ycombinator.com",
      "-O",
      "/tmp/news.ycombinator.com",
      "+*.news.ycombinator.com/*",
      "-v",
      "-r1",
      "-V",
      `"${script1} && ${script2} && ${script3}"`,
    ]);

    // listener should have a pid, it should be a number
    expect(listener.pid).toBeGreaterThan(0);

    const exitCode = await promise;

    expect(exitCode).toBe(0);

    const fileContents = fs.readFileSync(
      "/tmp/news.ycombinator.com/news.ycombinator.com/index.html",
      "utf-8",
    );

    expect(fileContents).toContain("<img");
    expect(fileContents).not.toContain("src=");
    expect(fileContents).toContain("/example.html");
  }, 10_000);
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

    expect(httrackComplete).toStrictEqual({ timedOut: false });

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

    expect(httrackComplete).toStrictEqual({ timedOut: true });

    // Wait for the process to finish logging.
    await promise;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 10_000);
});

/**
 * Test the way httrack sends cookies.
 *
 * This experiment shows that:
 * - we can set a cookie in the cookies.txt file before the crawl starts
 *   it will persist throughout the crawl, even if the server responds
 *   with an update for the cookie.
 * - any updates to the cookies.txt file during the crawl will not be
 *   picked up by httrack.
 */

xdescribe("httrack cookie playground", () => {
  let server;
  let counter = 0;

  beforeAll(() => {
    // Create a http server
    server = http.createServer((_req, res) => {
      // Log the request cookies.
      console.log(_req.headers.cookie);
      res.setHeader("Set-Cookie", "dw_agency=updated-by-server");
      res.setHeader("Set-Cookie", `counter=${counter++}`);

      // Respond with 5 links to /1, /2 etc.
      res.end(`
        <html>
          <body>
        ${Array.from({ length: 5 })
          .map((_, i) => `<a href="/${i}">${i}</a>`)
          .join("")}
          </body>
        </html>
        `);
    });

    server.listen(4000);
  });

  afterAll(() => {
    server.close();
  });

  it("should send cookies from cookies.txt", async () => {
    // Clean out the directory
    fs.rmSync("/tmp/localhost", { recursive: true, force: true });

    // Make the folder for the snapshot
    fs.mkdirSync("/tmp/localhost");

    // Add a cookies.txt file
    fs.writeFileSync(
      "/tmp/localhost/cookies.txt",
      "localhost:4000\tTRUE\t/\tFALSE\t1999999999\tdw_agency\thq",
    );

    // Run a basic httrack command
    const { promise } = runHttrack([
      "http://localhost:4000",
      "-O",
      "/tmp/localhost",
      "+localhost/*",
      "-v",
      // "-b1", // This option does nothing here.
    ]);

    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Writing to the cookies.txt mid-crawl does noting.
    fs.writeFileSync(
      "/tmp/localhost/cookies.txt",
      "localhost:4000\tTRUE\t/\tFALSE\t1999999999\tfile\ttest",
    );

    console.log("Cookies file updated");

    await promise;

    // Wait for the process to finish logging.
    await new Promise((resolve) => setTimeout(resolve, 500));

    await waitForHttrackComplete("/tmp/localhost");

    // Read the cookies file after the process has finished.
    const cookies = fs.readFileSync("/tmp/localhost/cookies.txt", "utf-8");

    expect(cookies).toContain("dw_agency\thq");
    expect(cookies).not.toContain("dw_agency\tupdated-by-server");
    expect(cookies).toContain("counter\t6");
  }, 15_000);
});
