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
import { getAgencyPath } from "./controllers/paths.js";
import {
  checkAccess as checkS3Access,
  syncErrorPages,
} from "./controllers/s3.js";
import { scheduleFunction } from "./controllers/schedule.js";

const __dirname = import.meta.dirname;

const app = express();

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
app.use(parseBody, checkSignature);

/**
 * Routes
 */

app.get("/health", function (_req, res) {
  res.status(200).send("OK");
});

app.get("/status", async function (_req, res, next) {
  try {
    // Get envs where a JWT has been set.
    const envs = Object.entries(intranetJwts)
      .filter(([, jwt]) => jwt)
      .map(([env]) => env);

    if(isLocal) {
      envs.push("local");
    }

    const fetchStatuses = await Promise.all(
      envs.map(async (env) => {
        const url = intranetUrls[env];
        const { status } = await fetch(url, {
          redirect: "manual",
          headers: { Cookie: `jwt=${intranetJwts[env]}` },
        });
        return { env, status };
      }),
    );

    const data = { fetchStatuses, s3Status: await checkS3Access() };

    cache.status = {
      expiry: Date.now() + 1000 * 60 * 5, // 5 minutes
      data,
    };

    res.status(200).send(data);
  } catch (err) {
    // Handling errors like this will send the error to the default Express error handler.
    // It will log the error to the console, return a 500 error page.
    next(err);
  }
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

// For now, only schedule to run on the first instance.
if (ordinalNumber === 0) {
  // Schedule the main function to run at the specified times
  getSnapshotSchedule().forEach(({ env, agency, depth, ...schedule }) => {
    scheduleFunction(schedule, () => {
      main({ env, agency, depth });
    });
    console.log("Scheduled", env, agency, schedule, depth ?? "");
  });
}

// Schedule the deleteOldSnapshots function to run at 1:45 AM every day
scheduleFunction({ min: 45, hour: 1 }, deleteOldSnapshots);

/**
 * Other Function(s)
 */

syncErrorPages();
