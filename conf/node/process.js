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

app.post("/spider", async function (request, response, next) {
  // handle the response
  response
    .status(200)
    .sendFile(path.join("/usr/share/nginx/html/working.html"));
  await spider(request.body);
});

/**
 * Spider the intranet and take a snapshot of the given agency, if no agency is supplied in
 * body, the spider focuses on HQ only.
 *
 * @param body form payload
 **/
async function spider(body) {
  await new Promise((resolve) => setTimeout(resolve, 1));

  const mirror = {
    url: new URL(body.url || "https://intranet.justice.gov.uk/"),
    agency: body.agency || "hq",
  };

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
    options,
  );

  // launch HTTrack with options
  const listener = spawn("httrack", options);
  listener.stdout.on("data", (data) => console.log(`stdout: ${data}`));
  listener.stderr.on("data", (data) => console.log(`stderr: ${data}`));
  listener.on("error", (error) => console.log(`error: ${error.message}`));
  listener.on("close", (code) =>
    console.log(`child process exited with code ${code}`),
  );
}

app.listen(port);
