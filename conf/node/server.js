#!/usr/bin/env node
/**
 * Intranet Archive - NodeJS Form Processing
 * -
 *************************************************/

// node packages
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

// npm packages
import cors from "cors";
import express from "express";

// Relative
import { corsOptions, jwt, port } from "./constants.js";
import { parseBody } from "./middleware.js";
import { checkAccess as checkS3Access } from "./controllers/s3.js";

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

app.post("/spider", async function (request, response) {
  // handle the response
  response
    .status(200)
    .sendFile(path.join("/usr/share/nginx/html/working.html"));
  await spider(request.mirror);
});

/**
 * Spider the intranet and take a snapshot of the given agency, if no agency is supplied in
 * body, the spider focuses on HQ only.
 *
 * @param mirror form payload
 **/
async function spider(mirror) {
  await new Promise((resolve) => setTimeout(resolve, 1));

  // Get date in format: 2023-01-17-18-00
  const dateString = new Date().toISOString().slice(0, 16).replace(/T|:/g, "-");

  // Create directory for snapshots
  const directory = `/archiver/snapshots/${mirror.url.host}/${mirror.agency}/${dateString}`;

  await fs.mkdir(directory, { recursive: true }, (err) => {
    if (err) {
      return console.log("Error creating directory: ", err);
    }
  });

  let options, rules, settings;

  options = [
    "-%W",
    "/archiver/strip_x_amz_query_param.so",
    mirror.url.origin + "/?agency=" + mirror.agency,
  ];

  rules = [
    "+*.png",
    "+*.gif",
    "+*.jpg",
    "+*.jpeg",
    "+*.css",
    "+*.js",
    "-ad.doubleclick.net/*",
    "-*intranet.justice.gov.uk/agency-switcher/",
    "-*intranet.justice.gov.uk/?*agency=*",
    "-*intranet.justice.gov.uk/?p=*",
    "-*intranet.justice.gov.uk/?page_id=*",
    "-*intranet.justice.gov.uk/wp-json/*/embed*",
    "-*intranet.justice.gov.uk/wp/*",
    "+*intranet.justice.gov.uk/?*agency=" + mirror.agency,
  ];

  settings = [
    "-s0", // never follow robots.txt and meta robots tags: https://www.mankier.com/1/httrack#-sN
    "-V", // execute system command after each file: https://www.mankier.com/1/httrack#-V
    '"sed -i \'s/srcset="[^"]*"//g\' $0"',
    "-%k", // keep-alive if possible https://www.mankier.com/1/httrack#-%25k
    "-F",
    "intranet-archive",
    "-%X",
    `Cookie: dw_agency=${mirror.agency}; jwt=${jwt}`,
    "-O", // path for snapshot/logfiles+cache: https://www.mankier.com/1/httrack#-O
    directory,
  ];

  // combine: push rules into options
  options = options.concat(rules);
  // combine: push settings into options
  options = options.concat(settings);
  // verify options array
  console.log(
    "Launching Intranet Spider with the following options: ",
    options.map((entry) => entry.replace(jwt, "***")),
  );

  // launch HTTrack with options
  const listener = spawn("httrack", options);
  listener.stdout.on("data", (data) => console.log(`stdout: ${data}`));
  listener.stderr.on("data", (data) => console.log(`stderr: ${data}`));
  listener.on("error", (error) => console.log(`error: ${error.message}`));
  listener.on("close", (code) =>
    console.log(`child process exited with code ${code}`),
  );

  // TODO get progress somehow.
  // The only way to get progress is to read the 2 files:
  // 1. hts-cache/new.txt
  // 2. hts-cache/new.lst

  // The /hts-in_progress.lock also shows some interesting information, like:
  // PID and start time of the process.

  // TODO upload to S3
}

app.listen(port);
