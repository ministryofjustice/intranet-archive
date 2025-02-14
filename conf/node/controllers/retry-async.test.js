import { jest } from "@jest/globals";

import { retryAsync } from "./retry-async.js";

/**
 * This test has been adapted from the original source code at:
 * https://github.com/vitaly-t/retry-async/blob/main/src/test.ts
 */

describe("retryAsync", () => {
  beforeEach(() => {
    // Spy on console.error to check if error handler is called:
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("retries async operation - default options", async () => {
    const failCount = 1;

    // our async function, result from which we intend to re-try, when it fails:
    async function makeRequest(s) {
      if (s.index < failCount) {
        throw new Error(`Request failed ${s.index + 1} time(s)`);
      }
      return `Request succeeded after ${s.duration}ms and ${
        s.index + 1
      } attempt(s)`;
    }

    const result = await retryAsync(makeRequest);
    expect(result).toContain("Request succeeded after ");
    expect(result).toContain("ms and 2 attempt(s)");

    // Check if error handler was called 2 times:
    expect(console.error).toHaveBeenCalledTimes(failCount);
  }, 15_000);

  test("retries async operation - custom options", async () => {
    const failCount = 4; // let's fail our requests 4 times

    // our async function, result from which we intend to re-try, when it fails:
    async function makeRequest(s) {
      if (s.index < failCount) {
        throw new Error(`Request failed ${s.index + 1} time(s)`);
      }
      return `Request succeeded after ${s.duration}ms and ${
        s.index + 1
      } attempt(s)`;
    }

    // use delays with 0.5s increments:
    const delay = (s) => (s.index + 1) * 500;

    // retry for up to 5 times, with duration not exceeding 4s:
    const retry = (s) => s.index < 5 && s.duration <= 4000;

    const error = (s) => {
      const info = {
        index: s.index,
        duration: s.duration,
        error: s.error.message,
      };
      console.error("Handling:", info);
    };

    const result = await retryAsync(makeRequest, { retry, delay, error });
    expect(result).toContain("Request succeeded after ");
    expect(result).toContain("ms and 5 attempt(s)");

    // Check if error handler was called 4 times:
    expect(console.error).toHaveBeenCalledTimes(failCount);
  }, 10_000);
});
