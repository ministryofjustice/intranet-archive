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
  // Get the current domain from the request
  const appHost = request.get("X-Forwarded-Host") || request.get("host");

  if (!appHost.startsWith("app.")) {
    console.error("Invalid host");
    response.status(400).send({ status: 400 });
    return;
  }

  // Use regex to replace the initial app. with an empty string.
  // e.g. app.archive.intranet.docker -> archive.intranet.docker
  const cdnHost = appHost.replace(/^app\./, "");

  // TODO Generate CloudFront cookies.

  // Set the cookie on the response
  // response.cookie('jwt', jwt, {
  //   domain: cdnHost,
  //   secure: true,
  //   sameSite: 'None',
  //   httpOnly: true,
  // });

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
