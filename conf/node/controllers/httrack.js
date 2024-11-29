import { spawn } from "node:child_process";
import fs from "node:fs";

import { jwt } from "../constants.js";

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
 * @returns {number} object.requests - the number of requests made
 * @returns {number} object.rate - the requests per second over the last 10 seconds
 * @returns {bool} object.complete - true if the mirror is complete
 */

export const getHttrackProgress = async (dest) => {
  const progressFile = `${dest}/hts-cache/new.txt`;

  if (!fs.existsSync(progressFile)) {
    return {
      requests: 0,
      rate: 0,
      complete: false,
    };
  }

  const progress = fs.readFileSync(progressFile, "utf8");

  console.log(progress);

};
