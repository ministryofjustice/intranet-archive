#!/usr/bin/env node
/**
 * Intranet Archive - NodeJS Form Processing
 * -
 *************************************************/

// node packages
import path from "node:path";

// npm packages
import cors from "cors";
import express from "express";

// Relative
import { corsOptions, jwt, port } from "./constants.js";
import { parseBody } from "./middleware.js";
import { checkAccess as checkS3Access } from "./controllers/s3.js";
import {
  getCdnUrl,
  getKeyPairId,
  getCookies,
  getDateLessThan,
} from "./controllers/cloudfront.js";
import { main } from "./controllers/main.js";

const app = express();

/**
 * Middleware
 */

app.use(express.static("/usr/share/nginx/html"));

// Middleware to parse incoming POST requests
app.use(express.urlencoded({ extended: true }));

// Middleware to enable CORS
app.use(cors(corsOptions));

// Middleware to parse the url and agency
app.use(parseBody);

/**
 * Routes
 */

app.post("/fetch-test", async function (req, res, next) {
  try {
    const { status } = await fetch(req.mirror.url, {
      redirect: "manual",
      headers: { Cookie: `jwt=${jwt}` },
    });
    res.status(200).send({ status });
  } catch (err) {
    // Handling errors like this will send the error to the defaule Express error handler.
    // It will log the error to the console, return a 500 error page,
    // and show the error message on dev environments, but hide it on production.
    next(err);
  }
});

app.post("/bucket-test", async function (_req, res, next) {
  try {
    const canAccess = await checkS3Access();
    res.status(200).send({ canAccess });
  } catch (err) {
    next(err);
  }
});

app.post("/set-cf-cookie", async function (request, response) {
  try {
    // Get the current domain from the request
    const appHost = request.get("X-Forwarded-Host") || request.get("host");

    const cdnUrl = getCdnUrl(appHost);

    const cookies = getCookies({
      resource: `${cdnUrl.origin}/*`,
      dateLessThan: getDateLessThan(),
    });

    // Set the cookies on the response
    Object.entries(cookies).forEach(([name, value]) => {
      response.cookie(name, value, {
        domain: cdnUrl.host,
        secure: true,
        sameSite: "None",
        httpOnly: true,
      });
    });
  } catch (err) {
    next(err);
  }

  response.status(200).send({ appHost, cdnHost });
});

app.post("/spider", function (request, response) {
  // Start the main function - without awiting for the result.
  main(request.mirror);
  // Handle the response
  response
    .status(200)
    .sendFile(path.join("/usr/share/nginx/html/working.html"));
});

app.listen(port);
