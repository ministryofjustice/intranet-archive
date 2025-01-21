import { spawn, execSync } from "node:child_process";
import fs from "node:fs";

import { intranetJwts } from "../constants.js";

/**
 * A helper function to get the directory for the snapshot.
 *
 * @param {Object} props
 * @param {string} props.host
 * @param {string} props.agency
 * @returns {{s3: string, fs: string}} the s3 and fs paths
 */

export const getSnapshotPaths = ({ host, agency }) => {
  // Get date in format: 2023-01-17
  const dateString = new Date().toISOString().slice(0, 10);

  const s3Path = `${host}/${agency}/${dateString}`;

  const fsPath = `/tmp/snapshots/${s3Path}`;

  // Return directory for the snapshot
  return { s3: s3Path, fs: fsPath };
};

/**
 * Get arguments for httrack cli.
 *
 * @param {Object} props
 * @param {URL} props.url
 * @param {string} props.dest
 * @param {string} props.agency
 * @param {string} props.jwt
 * @param {number} [props.depth] - Optional depth parameter
 *
 * @returns {string[]}
 */

export const getHttrackArgs = ({ url, dest, agency, jwt, depth }) => {
  /** @type {string[]} */
  let options = [url.href];

  /** @type {string[]} */
  const rules = [
    "+*.png",
    "+*.gif",
    "+*.jpg",
    "+*.jpeg",
    "+*.css",
    "+*.js",
    // Fonts (including icon-fonts)
    "+*.eot",
    "+*.ttf",
    "+*.woff",
    "-ad.doubleclick.net/*",
    "-justiceuk.sharepoint.com/*",
    "-*intranet.justice.gov.uk/agency-switcher/",
    "-*intranet.justice.gov.uk/?*agency=*",
    "-*intranet.justice.gov.uk/?p=*",
    "-*intranet.justice.gov.uk/?page_id=*",
    "-*intranet.justice.gov.uk/wp-json/*/embed*",
    "-*intranet.justice.gov.uk/wp/*",
    "+*intranet.justice.gov.uk/?*agency=" + agency,
  ];

  const commands = {
    // Remove srcset attributes
    removeSrcset: `sed -i 's/srcset="[^"]*"//g' $0`,
    // Replace the agency switcher URL with '/'
    replaceAgencySwitcher: `sed -i 's|href="https://intranet.justice.gov.uk/agency-switcher/"|href="/"|g' $0`,
  };

  /** @type {string[]} */
  const settings = [
    "-s0", // never follow robots.txt and meta robots tags: https://www.mankier.com/1/httrack#-sN
    "-V", // execute system command after each file: https://www.mankier.com/1/httrack#-V
    `"${commands.removeSrcset} && ${commands.replaceAgencySwitcher}"`,
    "-%k", // keep-alive if possible https://www.mankier.com/1/httrack#-%25k
    "-F",
    "intranet-archive",
    "-%X",
    `Cookie: dw_agency=${agency}; jwt=${jwt}`,
    ...(depth ? [`-r${depth}`] : []), // set the mirror depth
    "-O", // path for snapshot/logfiles+cache: https://www.mankier.com/1/httrack#-O
    dest,
  ];

  // combine: push rules into options
  options = options.concat(rules);
  // combine: push settings into options
  options = options.concat(settings);

  return options;
};

/**
 * Run httrack with args
 *
 * @param {string[]} cliArgs
 *
 * @see https://manpages.debian.org/testing/httrack/httrack.1.en.html
 */

export const runHttrack = (cliArgs) => {
  console.log("Starting httrack");

  // verify options array
  console.log(
    "Launching Intranet Spider with the following options: ",
    cliArgs.map((entry) => {
      // Loop over all the JWTs and replace them with ***
      Object.values(intranetJwts).forEach((jwt) => {
        entry.replace(jwt, "***");
      });
      return entry;
    }),
  );

  const listener = spawn("httrack", cliArgs);

  const promise = new Promise((resolve, reject) => {
    // launch HTTrack with options
    listener.stdout.on("data", (data) => console.log(`stdout: ${data}`));
    listener.stderr.on("data", (data) => console.log(`stderr: ${data}`));
    listener.on("error", (error) => console.log(`error: ${error.message}`));
    listener.on("close", (code) => {
      console.log(`child process closed with code ${code}`);
    });
    listener.on("exit", (code) => {
      console.log(`child process exited with code ${code}`);
      resolve(code);
    });
  });

  return {
    promise,
    listener,
  };
};

/**
 * @typedef {Object} HttrackProgress
 * @property {number} requestCount - the number of requests made
 * @property {number} rate - the requests per second over the last 10 seconds
 * @property {boolean} complete - true if the mirror is complete
 */

/**
 * Get httrack progress from destination folder
 *
 * @param {string} dest
 * @returns {Promise<HttrackProgress>}
 */

export const getHttrackProgress = async (dest) => {
  // Validate dest, ensure it is a string and cannot execute arbitary commands.
  if (typeof dest !== "string" || dest.includes(";")) {
    throw new Error("Invalid destination");
  }

  const files = {
    index: `${dest}/index.html`,
    log: `${dest}/hts-cache/new.txt`,
    lock: `${dest}/hts-in_progress.lock`,
  };

  const response = {
    requestCount: 0,
    rate: 0,
    complete: fs.existsSync(files.index) && !fs.existsSync(files.lock),
  };

  if (!fs.existsSync(files.log)) {
    return response;
  }

  // Efficienty, get the line count of the file. Witout reading it all into memory.
  const lineCount = parseInt(
    execSync(`wc -l < "${files.log}"`).toString().trim(),
  );

  if (!lineCount) {
    return response;
  }

  // The first line is a header, so we subtract 1.
  response.requestCount = lineCount - 1;

  // If the current time is between 00:00:00 and 00:00:05, wait for 5 seconds to avoid spanning requests across two days.
  // This prevents the recent requests in `/hts-cache/new.txt` from spanning 2 days.
  if (new Date().toTimeString().split(" ")[0] < "00:00:05") {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Get the last 20 lines from the file. Or all of them if there are less than 20.
  const lastLines = execSync(
    `tail -n ${Math.min(20, response.requestCount)} ${files.log}`,
  ).toString();

  const fiveSecondsAgo = new Date(Date.now() - 5000)
    .toTimeString()
    .split(" ")[0];

  /*
   * The lines in `/hts-cache/new.txt` are in the format:
   * 09:27:58  258/-1  ---M--  200     added ('OK') ...
   * 09:27:58  258/-1  ---M--  200     added ('OK') ...
   *
   * Filter out the lines that are not from the last 5 seconds.
   */

  const recentRequests = lastLines.split("\n").filter((line) => {
    const time = line.split(" ")[0];
    return time > fiveSecondsAgo;
  });

  // Calculate the rate of requests per second.
  response.rate = recentRequests.length / 5;

  return response;
};

/**
 * Wait for httrack to complete
 *
 * @param {string} dest
 * @param {number} timeOutSeconds
 * @returns {Promise<{timedOut: boolean}>}
 */

export const waitForHttrackComplete = async (
  dest,
  timeOutSeconds = 24 * 60 * 60 /* 24 hours */,
) => {
  const intervalSeconds = 1;
  const maxIterations = timeOutSeconds / intervalSeconds;
  const logFrequency = 5 * 60; // Log every 5 minutes
  let iterations = 0;

  // Wait for hts-cache/new.txt to exist.
  while (
    iterations++ < maxIterations &&
    !fs.existsSync(`${dest}/hts-cache/new.txt`)
  ) {
    console.log("Waiting for httrack to start ... ");
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }

  // Wait for the lock file to be removed.
  while (
    iterations++ < maxIterations &&
    fs.existsSync(`${dest}/hts-in_progress.lock`)
  ) {
    if (iterations < 10 || iterations % logFrequency === 0) {
      const elapsedTime = new Date(iterations * intervalSeconds * 1000)
        .toISOString()
        .substring(11, 19);
      console.log(`Waiting for httrack to complete ... ${elapsedTime} elapsed`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }

  return {
    timedOut: iterations >= maxIterations,
  };
};
