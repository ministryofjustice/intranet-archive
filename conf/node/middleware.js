import { createHmac } from "node:crypto";

import {
  intranetUrls,
  sharedSecret,
  defaultEnv,
  defaultAgency,
  allowedTargetHosts,
  allowedTargetAgencies,
} from "./constants.js";

/**
 * @typedef {import('express').Request & { mirror: { env: string, agency: string, depth: number } }} SpiderRequest
 * @typedef {import('express').Request & { isValid: ?boolean, agency: string, env: string }} AccessRequest
 */

/**
 * Middleware to parse the url and agency from the incoming request body
 *
 * @param {SpiderRequest} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns  {void}
 */

export const parseBody = (req, res, next) => {
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
      throw new Error("Env not allowed");
    }

    if (!allowedTargetAgencies.includes(req.mirror.agency)) {
      throw new Error("Agency not allowed");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).send({ status: 400 });
    return;
  }

  next();
};

/**
 * Midleware to make sure that `/access` requests are validated & signed with the shared secret
 *
 * @param {AccessRequest} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */

export const checkSignature = (req, res, next) => {
  // Only validate /access requests
  if (req.path !== "/access") {
    return next();
  }

  // Make sure the request has a signature & payload
  const { sig, ...body } = req.body;

  if (!sig || !body.payload) {
    console.error("Error: Missing signature or payload");
    res.status(403).send({ status: 403 });
    return;
  }

  let payloadObject;

  try {
    // Decode and parse the payload
    payloadObject = JSON.parse(Buffer.from(body.payload, "base64").toString());
  } catch (error) {
    console.error("Error:", error);
    res.status(400).send({ status: 400 });
    return;
  }

  // Make sure the request has not expired
  const expiry = parseInt(payloadObject.expiry, 10) * 1000;

  if (expiry < Date.now()) {
    console.error("Error: Request expired");
    res.status(403).send({ status: 403 });
    return;
  }

  // Make sure the request is for an allowed agency
  req.agency = payloadObject.agency;

  if (!allowedTargetAgencies.includes(req.agency)) {
    console.error("Error: Agency not allowed");
    res.status(403).send({ status: 403 });
    return;
  }

  // Make sure the request is for an allowed hostname
  req.env = Object.keys(intranetUrls).find(
    (env) =>
      intranetUrls[env] &&
      new URL(intranetUrls[env]).hostname === payloadObject.hostname,
  );

  if (!req.env) {
    console.error("Error: Env not found");
    res.status(403).send({ status: 403 });
    return;
  }

  // Make sure the request is signed with the shared secret using hash_hmac and sha256
  const hmac = createHmac("sha256", sharedSecret);
  const expectedSig = hmac.update(body.payload).digest("base64");

  if (sig !== expectedSig) {
    console.error("Error: Invalid signature");
    res.status(403).send({ status: 403 });
    return;
  }

  console.log("Request is valid");

  req.isValid = true;
  next();
};
