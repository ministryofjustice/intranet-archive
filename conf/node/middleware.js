import { createHmac } from "node:crypto";

import {
  rateLimitConfig,
  intranetUrls,
  sharedSecret,
  defaultEnv,
  defaultAgency,
  allowedTargetAgencies,
} from "./constants.js";

const __dirname = import.meta.dirname;

/**
 * Custom error class to represent HTTP errors.
 *
 * @class HttpError
 * @extends {Error}
 *
 * @param {string} message - The error message.
 * @param {number} status - The HTTP status code associated with the error.
 */

export class HttpError extends Error {
  /**
   * Creates an instance of HttpError.
   *
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code associated with the error.
   */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// A map to store the IP addresses of the clients and the number of requests they have made
const ipAddresses = new Map();

/**
 * In memory rate limiter
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */

export const rateLimiter = ({ ip }, _res, next) => {
  const { maxRequests, timeWindow } = rateLimitConfig;
  const now = Date.now();

  // If the ip is not in the map, then add it with a count of 1
  if (!ipAddresses.has(ip)) {
    ipAddresses.set(ip, { lastRequest: now, count: 1 });
    return next();
  }

  // Time since the last request in milliseconds
  const timeSinceLastRequest = now - ipAddresses.get(ip).lastRequest;

  // If the time since the last request is greater than the time window, reset the count
  if (timeSinceLastRequest > timeWindow) {
    ipAddresses.set(ip, { lastRequest: now, count: 1 });
    return next();
  }

  // If the count is less than the maximum requests, increment the count and update the last request time
  if (ipAddresses.get(ip).count < maxRequests) {
    ipAddresses.set(ip, {
      lastRequest: now,
      count: ++ipAddresses.get(ip).count,
    });
    return next();
  }

  // If the count is greater than the maximum requests, return a 429 error
  return next(new HttpError("Rate limit exceeded", 429));
};

/**
 * @typedef {import('express').Request & { mirror: { env: string, agency: string, depth: number } }} SpiderRequest
 * @typedef {import('express').Request & { isValid: ?boolean, agency: string, env: string }} AccessRequest
 */

/**
 * Middleware to parse the url and agency from the incoming request body
 *
 * @param {SpiderRequest} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns  {void}
 */

export const parseBody = (req, _res, next) => {
  if (req.method !== "POST") {
    return next();
  }

  try {
    req.mirror = {
      env: req.body.env || defaultEnv,
      agency: req.body.agency || defaultAgency,
      // Optionally add the depth parameter, if it can be parsed as an integer
      depth: parseInt(req.body.depth, 10) || undefined,
    };

    if (undefined === intranetUrls[req.mirror.env]) {
      return next(new HttpError("Env not allowed", 400));
    }

    if (!allowedTargetAgencies.includes(req.mirror.agency)) {
      return next(new HttpError("Agency not allowed", 400));
    }
  } catch (error) {
    error.status = 400;
    return next(error);
  }

  next();
};

/**
 * Middleware to make sure that `/access` requests are validated & signed with the shared secret
 *
 * @param {AccessRequest} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */

export const checkSignature = (req, _res, next) => {
  // Only validate /access requests
  if (req.path !== "/access") {
    return next();
  }

  // Make sure the request has a signature & payload
  const { sig, ...body } = req.body;

  if (!sig || !body.payload) {
    return next(new HttpError("Missing signature or payload", 400));
  }

  let payloadObject;

  try {
    // Decode and parse the payload
    payloadObject = JSON.parse(Buffer.from(body.payload, "base64").toString());
  } catch (error) {
    console.error("Error:", error);
    return next(new HttpError("Invalid payload", 400));
  }

  // Make sure the request has not expired
  const expiry = parseInt(payloadObject.expiry, 10) * 1000;

  if (expiry < Date.now()) {
    return next(new HttpError("Request expired", 400));
  }

  // Make sure the request is for an allowed agency
  req.agency = payloadObject.agency;

  if (!allowedTargetAgencies.includes(req.agency)) {
    return next(new HttpError("Agency not allowed", 400));
  }

  // Make sure the request is for an allowed hostname
  req.env = Object.keys(intranetUrls).find(
    (env) =>
      intranetUrls[env] &&
      new URL(intranetUrls[env]).hostname === payloadObject.hostname,
  );

  if (!req.env) {
    return next(new HttpError("Hostname not found in intranetUrls", 400));
  }

  // Make sure the request is signed with the shared secret using hash_hmac and sha256
  const hmac = createHmac("sha256", sharedSecret);
  const expectedSig = hmac.update(body.payload).digest("base64");

  if (sig !== expectedSig) {
    return next(new HttpError("Invalid signature", 403));
  }

  console.log("Request is valid");

  // Explicitly set the request as valid - so we know that this middleware has run.
  req.isValid = true;
  next();
};

/**
 * Error handler middleware to handle different HTTP error statuses.
 *
 * @typedef {Object} ErrorHandler
 * @property {number} [status] - The HTTP status code of the error.
 *
 * @param {ErrorHandler} err - The error object containing the status code.
 * @param {Object} _req - The request object (unused).
 * @param {Object} res - The response object used to send the error page.
 * @param {Object} _next - The next function (unused but required as a parameter).
 * @returns {void}
 */

export const errorHandler = (err, _req, res, _next) => {
  // Log the error to the console - will be available in Kibana logs.
  console.error(err);

  if (err.status === 400) {
    res
      .status(400)
      .sendFile("static/error-pages/400.html", { root: __dirname });
    return;
  }

  if (err.status === 403) {
    res
      .status(403)
      .sendFile("static/error-pages/403.html", { root: __dirname });
    return;
  }

  // For everything else, return a 500 error
  res.status(500).sendFile("static/error-pages/500.html", { root: __dirname });
};
