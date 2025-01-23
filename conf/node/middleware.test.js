import { createHmac } from "node:crypto";
import { jest } from "@jest/globals";

import { sharedSecret } from "./constants.js";
import { checkSignature } from "./middleware.js";

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

  it("should return 403 if sig or payload is missing", () => {
    checkSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({ status: 403 });
  });

  it("should return 400 if payload is not valid base64", () => {
    req.body = { sig: "signature", payload: "invalid-base64" };
    checkSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ status: 400 });
  });

  it("should return 403 if hostname is not found", () => {
    const payload = Buffer.from(
      JSON.stringify({ expiry: Date.now() / 1000 + 10, hostname: "invalid" }),
    ).toString("base64");
    req.body = { sig: "signature", payload };
    checkSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({ status: 403 });
  });

  it("should return 403 if request has expired", () => {
    const payload = Buffer.from(
      JSON.stringify({ expiry: Date.now() / 1000 - 10 }),
    ).toString("base64");
    req.body = { sig: "signature", payload };
    checkSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({ status: 403 });
  });

  it("should return 403 if signature does not match", () => {
    const payload = Buffer.from(
      JSON.stringify({ expiry: Date.now() / 1000 + 10 }),
    ).toString("base64");
    req.body = { sig: "invalid-signature", payload };
    checkSignature(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({ status: 403 });
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
