import { createHmac } from "node:crypto";
import { jest } from "@jest/globals";

import { rateLimitConfig, sharedSecret } from "./constants.js";
import { rateLimiter, checkSignature } from "./middleware.js";

describe("rateLimiter middleware", () => {
  let req, res, next;

  const { maxRequests, timeWindow } = rateLimitConfig;

  jest.useFakeTimers();

  afterAll(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    req = {
      ip: "192.168.1.1",
    };
    res = {};
    next = jest.fn();
  });

  it("should call next if ip is not in the map", () => {
    rateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("should call next if ip is in the map and count is less than maxRequests", () => {
    req.ip = "192.168.1.2";
    rateLimiter(req, res, next);
    rateLimiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it("should call next with HttpError 429 if ip is in the map and count is greater than or equal to maxRequests", () => {
    for (let i = 0; i <= maxRequests; i++) {
      rateLimiter(req, res, next);
    }
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[20][0].status).toBe(429);
  });

  it("should call next if time since last request is greater than timeWindow", () => {
    req.ip = "192.168.1.3";
    for (let i = 0; i <= maxRequests; i++) {
      rateLimiter(req, res, next);
    }
    expect(next).toHaveBeenCalledWith(expect.any(Error));

    // Wait for 60.001 seconds
    jest.advanceTimersByTime(timeWindow + 1);
    next.mockClear();

    rateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("checkSignature middleware", () => {
  let req, res, next;

  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    req = {
      path: "/access",
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    next = jest.fn();
  });

  it("should call next if path is not /access", () => {
    req.path = "/other-path";
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("should call next with HttpError 400 if sig or payload is missing", () => {
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(400);
  });

  it("should call next with HttpError 400 if payload is not valid base64", () => {
    req.body = { sig: "signature", payload: "invalid-base64" };
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(400);
  });

  it("should call next with HttpError 400 if hostname is not found", () => {
    const payload = Buffer.from(
      JSON.stringify({ expiry: Date.now() / 1000 + 10, hostname: "invalid" }),
    ).toString("base64");
    req.body = { sig: "signature", payload };
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(400);
  });

  it("should call next with HttpError 400 if request has expired", () => {
    const payload = Buffer.from(
      JSON.stringify({ expiry: Date.now() / 1000 - 10 }),
    ).toString("base64");
    req.body = { sig: "signature", payload };
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(400);
  });

  it("should call next with HttpError 400 if signature does not match", () => {
    const payload = Buffer.from(
      JSON.stringify({ expiry: Date.now() / 1000 + 10 }),
    ).toString("base64");
    req.body = { sig: "invalid-signature", payload };
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(400);
  });

  it("should call next with HttpError 403 if sig is invalid", () => {
    const payload = Buffer.from(
      JSON.stringify({
        expiry: Date.now() / 1000 + 10,
        agency: "hmcts",
        hostname: "intranet.docker",
      }),
    ).toString("base64");
    const hmac = createHmac("sha256", sharedSecret);
    const sig = hmac.update(`${payload}-invalid`).digest("base64");
    req.body = { sig, payload };
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  it("should call next if signature matches", () => {
    const payload = Buffer.from(
      JSON.stringify({
        expiry: Date.now() / 1000 + 10,
        agency: "hmcts",
        hostname: "intranet.docker",
      }),
    ).toString("base64");
    const hmac = createHmac("sha256", sharedSecret);
    const sig = hmac.update(payload).digest("base64");
    req.body = { sig, payload };
    checkSignature(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.isValid).toBe(true);
  });
});
