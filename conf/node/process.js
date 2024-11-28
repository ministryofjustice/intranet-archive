#!/usr/bin/env node
/**
 * Intranet Archive - NodeJS Form Processing
 * -
 *************************************************/

// node packages
const { exec, spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

// npm packages
const cors = require("cors");
const express = require("express");

const app = express();
const port = 2000;

const defaultUrl = "https://intranet.justice.gov.uk/";
const defaultAgency = "hq";

const allowedTargetHosts = [
  "intranet.docker",
  "intranet.justice.gov.uk",
  "dev.intranet.justice.gov.uk",
  "staging.intranet.justice.gov.uk",
  "demo.intranet.justice.gov.uk",
];

const allowedTargetAgencies = process.env.ALLOWED_AGENCIES?.split(",") ?? [];

/**
 * Middleware
 */

app.use(express.static("/usr/share/nginx/html"));

// Middleware to parse incoming POST requests
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    methods: ["POST"],
    origin: [
      "http://spider.intranet.docker/",
      "https://dev-intranet-archive.apps.live.cloud-platform.service.justice.gov.uk/",
    ],
  }),
);

// Middleware to validate the url and agency
app.use((request, response, next) => {
  // If get request, return next
  if (request.method !== "POST") {
    return next();
  }

  try {
    request.mirror = {
      url: new URL(request.body.url || defaultUrl),
      agency: request.body.agency || defaultAgency,
    };

    if (!allowedTargetHosts.includes(request.mirror.url.host)) {
      throw new Error("Host not allowed");
    }

    if (!allowedTargetAgencies.includes(request.mirror.agency)) {
      throw new Error("Agency not allowed");
    }
  } catch (error) {
    console.error("Error:", error);
    response.status(400).send({ status: 400 });
    return;
  }

  next();
});

/**
 * Endpoints
 */

app.post("/fetch-test", async function (request, response) {
  // Fetch the url and log the result.
  const { status } = await fetch(request.mirror.url, {
    redirect: "manual",
    headers: {
      Cookie: `jwt=${process.env.JWT}`,
    },
  }).catch((error) => console.error("Error:", error));

  response.status(200).send({ status });
});

app.post("/bucket-test", async function (request, response) {
  // Test the S3 bucket connection
  const listener = spawn("aws", [
    "s3",
    "ls",
    `s3://${process.env.S3_BUCKET_NAME}`,
  ]);
  listener.stdout.on("data", (data) => console.log(`stdout: ${data}`));
  listener.stderr.on("data", (data) => console.log(`stderr: ${data}`));
  listener.on("error", (error) => console.log(`error: ${error.message}`));

  listener.on("close", (code) => {
    console.log(`child process exited with code ${code}`);
    response.status(200).send({ code });
  });
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
  // response.cookie('jwt', process.env.JWT, {
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
 * @param body form payload
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
    `Cookie: dw_agency=${mirror.agency}; jwt=${process.env.JWT}`,
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
    options.map((entry) => entry.replace(process.env.JWT, "***")),
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
