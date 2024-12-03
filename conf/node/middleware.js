import {
  defaultUrl,
  defaultAgency,
  allowedTargetHosts,
  allowedTargetAgencies,
} from "./constants.js";

/**
 * Middleware to parse the url and agency from the incoming request body
 *
 * @param {import('express').Request} req
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
      url: new URL(req.body.url || defaultUrl),
      agency: req.body.agency || defaultAgency,
      // Optionally add the depth parameter, if it can be parsed as an integer
      depth: parseInt(req.body.depth, 10) || undefined,
    };

    if (!allowedTargetHosts.includes(req.mirror.url.host)) {
      throw new Error("Host not allowed");
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
