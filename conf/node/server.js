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

app.post("/spider", function (req, res) {
  // Start the main function - without awiting for the result.
  main(req.mirror);
  // Handle the response
  res.status(200).sendFile(path.join("/usr/share/nginx/html/working.html"));
});

app.get("/access-archive", async function (req, res, next) {
  try {
    const clientIp = req.headers["x-forwarded-for"] || req.ip;

    // Get the current domain from the request
    const appUrl = new URL(
      `${req.headers["x-forwarded-proto"] || req.protocol}://${
        req.headers["x-forwarded-host"] || req.headers["host"]
      }`,
    );

    // Get the CloudFront CDN URL
    const cdnUrl = getCdnUrl(appUrl);

    // Get the CloudFront cookies
    const cookies = getCookies({
      resource: `${cdnUrl.origin}/*`,
      dateLessThan: getDateLessThan(),
      clientIp,
    });

    // Set the cookies on the response
    Object.entries(cookies).forEach(([name, value]) => {
      res.cookie(name, value, {
        domain: cdnUrl.host,
        secure: cdnUrl.protocol === "https:",
        sameSite: "Lax",
        httpOnly: true,
      });
    });

    // Send a metadata html tag to redirect to the cdnUrl
    const html = `<html><head><meta http-equiv="refresh" content="0; url=${cdnUrl.origin}" /></head></html>`;

    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
});

app.listen(port);
