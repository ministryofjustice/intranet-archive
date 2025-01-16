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
import { corsOptions, intranetJwt, port, snapshotSchedule } from "./constants.js";
import { parseBody, checkSignature } from "./middleware.js";
import { checkAccess as checkS3Access } from "./controllers/s3.js";
import {
  getCdnUrl,
  getCookies,
  getDateLessThan,
  getCookiesToClear,
} from "./controllers/cloudfront.js";
import { main } from "./controllers/main.js";
import { scheduleFunction } from "./controllers/schedule.js";

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
app.use(parseBody, checkSignature);

/**
 * Routes
 */

app.post("/fetch-test", async function (req, res, next) {
  try {
    const { status } = await fetch(req.mirror.url, {
      redirect: "manual",
      headers: { Cookie: `jwt=${intranetJwt}` },
    });
    res.status(200).send({ status });
  } catch (err) {
    // Handling errors like this will send the error to the default Express error handler.
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

app.post("/access", async function (req, res, next) {
  // Check if the request is valid
  if (!req.isValid) {
    res.status(403).send({ status: 403 });
    return;
  }

  try {
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
      clientIp: Array.isArray(req.headers["x-real-ip"])
        ? req.headers["x-real-ip"][0]
        : req.headers["x-real-ip"],
    });

    // Set the cookies on the response
    Object.entries(cookies).forEach(([name, value]) => {
      res.cookie(name, value, {
        domain: cdnUrl.host,
        secure: cdnUrl.protocol === "https:",
        sameSite: "lax",
        httpOnly: true,
      });
    });

    // Clear CloudFront cookies from parent domains
    getCookiesToClear(cdnUrl.host).forEach(({ domain, name }) => {
      res.clearCookie(name, { domain });
    });

    // Redirect to the CDN URL.
    res.redirect(`${cdnUrl.origin}/${req._hostname}/${req.agency}`);
  } catch (err) {
    next(err);
  }
});

app.listen(port);

// Schedule the main function to run at the specified times
snapshotSchedule.forEach(({ agency, ...schedule }) => {
  scheduleFunction(schedule, () => {
    main({ url: new URL("https://intranet.gov.uk"), agency });
  });
  console.log('Scheduled', agency, schedule);
});
