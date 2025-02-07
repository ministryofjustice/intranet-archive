import {
  isLocal,
  isCi,
  intranetUrls,
  intranetJwts,
  metricsProperties,
} from "../constants.js";
import { checkForbidden as checkCdnForbidden } from "./cloudfront.js";
import {
  checkAccess as checkS3Access,
  getAgenciesFromS3,
  getSnapshotsFromS3,
} from "./s3.js";

/**
 * Get the environments that have a JWT set (plus local if working locally).
 *
 * @returns {string[]} The environments that have a JWT set (plus local if working locally).
 */

export const getEnvsForMetrics = () => {
  const envs = Object.keys(intranetJwts).filter((env) => intranetJwts[env]);

  if (isLocal || isCi) {
    envs.push("local");
  }

  return envs;
};

/**
 * The metric object.
 *
 * @typedef {Object} Metric
 * @property {string} name The name of the metric e.g. snapshot_count
 * @property {number} [value] The value of the metric (can be undefined).
 * @property {Object[]} [facets] The facets of the metric.
 * @property {string} [facets.env] The environment the metric is for.
 * @property {string} [facets.agency] The agency the metric is for.
 * @property {number} facets.value The value of the metric.
 */

/**
 * Get the metrics for a specific environment & agency.
 *
 * @param {string} env - The environment for the intranet e.g. production or dev
 * @param {string} agency - The agency to get snapshots for e.g. hq, hmcts etc.
 * @returns {Promise<Metric[]>} The stats for the agency.
 * @throws {Error} If getSnapshotsFromS3 throws, or a date format is invalid.
 */
export const getAgencySnapshotMetrics = async (env, agency) => {
  const snapshots = await getSnapshotsFromS3(undefined, env, agency);

  if (!snapshots?.length) {
    return [
      {
        name: "snapshot_count",
        facets: [{ env, agency, value: 0 }],
      },
      {
        name: "most_recent_snapshot_age",
        facets: [{ env, agency, value: 0 }],
      },
    ];
  }

  const mostRecentSnapshot = snapshots.sort((a, b) => (a > b ? -1 : 1))[0];

  // Make sure it's in the format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mostRecentSnapshot)) {
    throw new Error(`Invalid date format: ${mostRecentSnapshot}`);
  }

  return [
    {
      name: "snapshot_count",
      facets: [{ env, agency, value: snapshots.length }],
    },
    {
      name: "most_recent_snapshot_age",
      facets: [
        {
          env,
          agency,
          value: Math.floor(
            (Date.now() - new Date(mostRecentSnapshot).getTime()) / 86400000,
          ),
        },
      ],
    },
  ];
};

/**
 * Get the metrics for all agencies and all environments.
 *
 * @param {string[]} [envs] - The environments to get metrics for.
 * @returns {Promise<Metric[]>} The metrics for all agencies.
 */

export const getAllMetrics = async (envs) => {
  envs = envs || getEnvsForMetrics();

  /** @type Metric[] */
  const metrics = [
    // The bucket access and CDN access metric can be calculated outside of any loop.
    { name: "bucket_access", value: +(await checkS3Access()) },
    { name: "cdn_forbidden", value: +(await checkCdnForbidden()) },
  ];

  // Map over all environments and check if the intranet is accessible.
  const intranetPromises = envs.map(async (env) => {
    const { status } = await fetch(intranetUrls[env], {
      redirect: "manual",
      headers: { Cookie: `dw_agengy=hq; jwt=${intranetJwts[env]}` },
    });
    return { env, value: +(status === 200) };
  });

  // Add the intranet access metric to the metrics array.
  metrics.push({
    name: "intranet_access",
    facets: await Promise.all(intranetPromises),
  });

  // 1️⃣ Nested loop part 1 - loop over all environments.
  for (const env of envs) {
    const agencies = await getAgenciesFromS3(undefined, env);

    // 2️⃣ Nested loop part 2 - loop over all agencies.
    for (const agency of agencies) {
      const snapshotMetrics = await getAgencySnapshotMetrics(env, agency);

      // 3️⃣ Nested loop part 3 - loop over all snapshot metrics for the agency.
      for (const metric of snapshotMetrics) {
        const metricName = metric.name;
        // Find the index in the metrics array where the metric name matches.
        const index = metrics.findIndex((m) => m.name === metricName);

        // If the metric doesn't exist, add it to the metrics array.
        if (index === -1) {
          metrics.push(metric);
          continue;
        }

        // If the metric exists, add the facets to the existing metric.
        metrics[index].facets.push(...metric.facets);
      }
    }
  }


  return metrics;
};

/**
 * Transform the metrics object to OpenTelemetry format.
 *
 * @param {Metric[]} metrics
 * @returns string The metrics in OpenTelemetry format.
 */

export const getMetricsString = (metrics) => {
  const lines = [];

  // Loop over each metricsProperty (from constants.js).
  Object.entries(metricsProperties).forEach(([key, propertyStaticValues]) => {
    // Find the metric from this functions parameter.
    const metric = metrics.find((metric) => metric.name === key);

    if (!metric?.facets?.length && typeof metric?.value === "undefined") {
      console.log(metric);
      throw new Error(`Metric ${key} has no value or facets.`);
    }

    if (metric?.facets && metric?.value) {
      throw new Error(
        `Metric ${key} has both a value and facets. It should only have one.`,
      );
    }

    // Start building up the output for the metric.
    lines.push(
      `# HELP ${key} ${propertyStaticValues.help}`,
      `# TYPE ${key} ${propertyStaticValues.type}`,
    );

    if (propertyStaticValues.unit) {
      lines.push(`# UNIT ${key} ${propertyStaticValues.unit}`);
    }

    // If the metric has a value, add it to the output, then add a blank line and return.
    if (typeof metric?.value !== "undefined") {
      return lines.push(`${key} ${metric.value}`, "");
    }

    // If the metric has facets, loop over each one and add it to the output.
    for (const { env, agency, value } of metric?.facets) {
      const envLabel = env && `env="${env}"`;
      const agencyLabel = agency && `agency="${agency}"`;

      const labels = [envLabel, agencyLabel].filter(Boolean).join(",");

      lines.push(`${key}{${labels}} ${value}`);
    }

    // Add a blank line between each metric.
    lines.push("");
  });

  lines.push("EOF", '');

  return lines.join("\n");
};
