/**
 * Intranet Archive - NodeJS Form Processing
 * -
 *************************************************/

// npm packages
import express from "express";

// Relative
import {
  isLocal,
  ordinalNumber,
  intranetUrls,
  intranetJwts,
  port,
  getSnapshotSchedule,
} from "./constants.js";
import {
  rateLimiter,
  parseBody,
  checkSignature,
  HttpError,
  errorHandler,
} from "./middleware.js";
import {
  getCdnUrl,
  getCookies,
  getDateLessThan,
  getCookiesToClear,
} from "./controllers/cloudfront.js";
import { deleteOldSnapshots } from "./controllers/lifecycle.js";
import { main } from "./controllers/main.js";
import { getAllMetrics, getMetricsString } from "./controllers/metrics.js";
import { getAgencyPath } from "./controllers/paths.js";
import {
  checkAccess as checkS3Access,
  syncErrorPages,
} from "./controllers/s3.js";
import { scheduleFunction } from "./controllers/schedule.js";

const __dirname = import.meta.dirname;

const app = express();

// Trust the first proxy (Cloud Platform) to report the correct IP address. Used for to rate limiting middleware.
app.set("trust proxy", 1);

// An in-memory cache to store the status data (so this endpoint can be open).
const cache = {
  status: {
    expiry: 0,
    data: null,
  },
};

/**
 * Middleware
 */

// Middleware to parse incoming POST requests
app.use(express.urlencoded({ extended: true }));

// Middleware to parse the url and agency
app.use(rateLimiter, parseBody, checkSignature);

/**
 * Routes
 */

app.get("/health", function (_req, res) {
  res.status(200).send("OK");
});

app.get("/status", async function (_req, res, next) {
  const now = Date.now();
  // Return the cached data if it is still valid.
  if (cache.status.expiry > now) {
    res.status(200).send(cache.status.data);
    return;
  }

  try {
    // Get envs where a JWT has been set.
    const envs = Object.entries(intranetJwts)
      .filter(([, jwt]) => jwt)
      .map(([env]) => env);

    if (isLocal) {
      envs.push("local");
    }

    // Set an agency cookie so that we don't get a redirect status code to the agency switcher page.
    const defaultCookie = `dw_agency=hq`;

    const fetchStatuses = await Promise.all(
      envs.map(async (env) => {
        const url = intranetUrls[env];
        let cookie = defaultCookie;

        if (intranetJwts[env]) {
          cookie += `; jwt=${intranetJwts[env]}`;
        }

        try {
          const { status } = await fetch(url, {
            redirect: "manual",
            headers: { Cookie: cookie },
          });
          return { env, status };
        } catch (err) {
          console.error(`Error fetching ${url}`, err);
          return { env, status: err.message };
        }
      }),
    );

    const data = { fetchStatuses, s3Status: await checkS3Access() };

    cache.status = {
      expiry: now + 1000 * 60 * 5, // 5 minutes
      data,
    };

    res.status(200).send(data);
  } catch (err) {
    // Handling errors like this will send the error to the default Express error handler.
    // It will log the error to the console, return a 500 error page.
    next(err);
  }
});

app.get("/metrics", async function (_req, res) {
  let attempts = 0;
  const errors = [];

  while (attempts++ < 3) {
    try {
      const metrics = await getAllMetrics();
      const metricsString = getMetricsString(metrics);
      res
        .setHeader("Content-Type", "text/plain")
        .status(200)
        .send(metricsString);
      return;
    } catch (err) {
      errors.push(err);
      // Wait for before trying again
      await new Promise((resolve) => setTimeout(resolve, attempts * 1000));
    }
  }

  // Log the errors if we failed to get the metrics after 3 attempts
  console.error("Failed to get metrics after 3 attempts:");
  errors.forEach((err) => console.error(err));

  // Return a 500 error if the metrics could not be fetched.
  res
    .setHeader("Content-Type", "text/plain")
    .status(500)
    .send("Error fetching metrics, check logs");
});

app.post("/spider", function (req, res) {
  // Start the main function - without awaiting for the result.
  main(req.mirror);
  // Handle the response
  res.status(200).send({ status: 200 });
});

app.post("/access", async function (req, res, next) {
  const { isValid, env, agency } = req;

  // Check if the request is valid
  if (!isValid) {
    const error = new HttpError("Invalid request", 400);
    next(error);
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
        domain: cdnUrl.hostname,
        secure: cdnUrl.protocol === "https:",
        sameSite: "lax",
        httpOnly: true,
      });
    });

    // Clear CloudFront cookies from parent domains
    getCookiesToClear(cdnUrl.host).forEach(({ domain, name }) => {
      res.clearCookie(name, { domain });
    });

    // Clear the agency cookie from the CDN domain, it can cause a redirect loop.
    res.clearCookie("dw_agency", { domain: cdnUrl.hostname });

    // Redirect to the CDN URL.
    res.redirect(`${cdnUrl.origin}/${getAgencyPath(env, agency)}/index.html`);
  } catch (err) {
    next(err);
  }
});

app.use(function (_req, res) {
  // Return a 404 page if no route is matched
  res.status(404).sendFile("static/error-pages/404.html", { root: __dirname });
});

/**
 * Middleware - Error Handling
 */

app.use(errorHandler);

/**
 * Start the Server
 */

app.listen(port);

console.log("Server started on port", port);

/**
 * Schedule
 */

// Schedule the main function to run at the specified times
getSnapshotSchedule().forEach(({ env, agency, depth, ...schedule }) => {
  scheduleFunction(schedule, () => {
    main({ env, agency, depth });
  });
  console.log("Scheduled", env, agency, schedule, depth ?? "");
});

// Schedule the deleteOldSnapshots function to run at 1:45 AM every day
scheduleFunction({ min: 45, hour: 1 }, deleteOldSnapshots);

/**
 * Other Function(s)
 */

syncErrorPages();
