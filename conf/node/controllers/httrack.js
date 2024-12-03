import { spawn, execSync } from "node:child_process";
import fs from "node:fs";

import { jwt } from "../constants.js";

/**
 * A helper function to get the directory for the snapshot.
 *
 * @param {props} props
 * @param {string} props.host
 * @param {string} props.agency
 * @returns {string}
 */

export const getSnapshotDir = ({ host, agency }) => {
  // Get date in format: 2023-01-17
  const dateString = new Date().toISOString().slice(0, 10);

  // Return directory for the snapshot
  return `/tmp/snapshots/${host}/${agency}/${dateString}`;
};

/**
 * Get arguments for httrack cli.
 *
 * @param {Object} props
 * @param {URL} props.url
 * @param {string} props.dest
 * @param {string} props.agency
 * @param {string} props.jwt
 * @param {number} props.depth
 *
 * @returns {string[]}
 */

export const getHttrackArgs = ({ url, dest, agency, jwt, depth }) => {
  /** @type {string[]} */
  let options = ["-%W", "/archiver/strip_x_amz_query_param.so", url.href];

  /** @type {string[]} */
  const rules = [
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
    "+*intranet.justice.gov.uk/?*agency=" + agency,
  ];

  /** @type {string[]} */
  const settings = [
    "-s0", // never follow robots.txt and meta robots tags: https://www.mankier.com/1/httrack#-sN
    "-V", // execute system command after each file: https://www.mankier.com/1/httrack#-V
    '"sed -i \'s/srcset="[^"]*"//g\' $0"',
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
    cliArgs.map((entry) => entry.replace(jwt, "***")),
  );

  // return;
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
 * Get httrack progress from destination folder
 *
 * @param {string} dest
 * @returns {Object} object
 * @returns {number} object.requestCount - the number of requests made
 * @returns {number} object.rate - the requests per second over the last 10 seconds
 * @returns {bool} object.complete - true if the mirror is complete
 */

export const getHttrackProgress = async (dest) => {
  // Validate dest, ensure it is a string and cannot execute arbitary commands.
  if (typeof dest !== "string" || dest.includes(";")) {
    throw new Error("Invalid destination");
  }

  const files = {
    log: `${dest}/hts-cache/new.txt`,
    lock: `${dest}/hts-in_progress.lock`,
  };

  const response = {
    requestCount: 0,
    rate: 0,
    complete: !fs.existsSync(files.lock),
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

  // If the time is 23:59:55 - 00:00:05, await 5 seconds.

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
 * @param {number} timeOut
 * @returns {Promise<boolean>}
 */

export const waitForHttrackComplete = async (
  dest,
  timeOutSeconds = 12 * 60 * 60 /* 12 hours */,
) => {
  const intervalSeconds = 1;
  const maxIterations = timeOutSeconds / intervalSeconds;
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
    console.log("Waiting for httrack to complete ... ");
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    iterations++;
  }

  return {
    timedOut: iterations >= maxIterations,
  };
};
