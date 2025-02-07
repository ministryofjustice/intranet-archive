import crypto from "node:crypto";
import { getSignedCookies } from "@aws-sdk/cloudfront-signer";

import {
  isLocal,
  cloudfrontAlias,
  cloudFrontKeysObject as keysObject,
  cloudFrontPublicKey as publicKey,
  cloudFrontPrivateKey as privateKey,
} from "../constants.js";

/** @type {string} */
let cachedKeyPairId = null;

/**
 * Check if the distribution is accessible by fetching the root object
 *
 * @param {string} url - The distributon URL, defaults to the s3BucketName constant
 * @returns {Promise<boolean>} - The status code
 *
 * @throws {Error}
 */

export const checkAccess = async (url = cloudfrontAlias) => {
  const response = await fetch(`${isLocal ? 'http://' : 'https://'}${url}`);

  return response.ok;
};


/**
 * Infer the CloudFront CDN URL from the app host
 *
 * @param {URL} appUrl - The app URL
 * @returns {URL} cdnURL - The CloudFront CDN URL
 * @throws {Error} If the host is invalid
 */

export const getCdnUrl = (appUrl) => {
  // Check appHost starts with `app.`
  if (!appUrl.host.startsWith("app.")) {
    throw new Error("Invalid host");
  }

  const cdnHost = appUrl.host.replace(/^app\./, "");

  // Use regex to replace the initial app. with an empty string.
  return new URL(`${appUrl.protocol}//${cdnHost}`);
};

/**
 * Get the CloudFront key pair ID from the public key and keys object
 *
 * @returns {string} keyPairId - The CloudFront key pair ID
 */

export const getKeyPairId = () => {
  // Return the cached value if it exists
  if (cachedKeyPairId) {
    return cachedKeyPairId;
  }

  // Get sha256 hash of the public key, and get the first 8 characters.
  const publicKeyShort = crypto
    .createHash("sha256")
    .update(`${publicKey.trim()}\n`, "utf8")
    .digest("hex")
    .substring(0, 8);

  const keyPairId = JSON.parse(keysObject).find(
    (key) => key.comment === publicKeyShort && key.id?.length,
  )?.id;

  if (!keyPairId) {
    throw new Error("Key pair ID not found");
  }

  cachedKeyPairId = keyPairId;

  return keyPairId;
};

/**
 * Return the epoch value for midnight today, or midnight tomorrow if past midday
 *
 * @returns {number} dateLessThan - The date in seconds
 */

export const getDateLessThan = () => {
  const date = new Date();
  const hours = date.getHours();

  if (hours >= 12) {
    return new Date(date.setHours(24, 0, 0, 0)).getTime() / 1000;
  }

  // This should be midnight tomorrow.
  date.setDate(date.getDate() + 1);
  return new Date(date.setHours(0, 0, 0, 0)).getTime() / 1000;
};

/**
 * Get signed CloudFront cookies
 *
 * @param {Object} props
 * @param {string} props.resource
 * @param {number} props.dateLessThan
 * @param {string} props.clientIp
 * @returns {import('@aws-sdk/cloudfront-signer').CloudfrontSignedCookiesOutput} cookies - The signed CloudFront cookies
 */

export const getCookies = ({ resource, dateLessThan, clientIp }) => {
  const policy = {
    Statement: [
      {
        Resource: resource,
        Condition: {
          DateLessThan: {
            "AWS:EpochTime": dateLessThan, // time in seconds
          },
          ...(clientIp?.length && {
            // Optional, only if the IP address is provided
            IpAddress: {
              "AWS:SourceIp": `${clientIp}/32`,
            },
          }),
        },
      },
    ],
  };

  const policyString = JSON.stringify(policy);

  const signedCookies = getSignedCookies({
    keyPairId: getKeyPairId(),
    privateKey,
    policy: policyString,
  });

  return signedCookies;
};

/**
 * Get a list of CloudFront cookies on parent domains.
 *
 * @param {string} cdnHostname - The hostname of the CDN
 * @returns {{domain: string, name: string}[]} - The cookies to clear
 */

export const getCookiesToClear = (cdnHostname) => {
  // Split the hostname into parts
  const parts = cdnHostname.split(".");

  /** @type {{domain: string, name: string}[]} */
  const cookies = [];

  // Clear cookies on parent domains
  for (let i = 1; i < parts.length; i++) {
    // Stop at docker or gov
    if (["docker", "gov"].includes(parts[i])) {
      break;
    }

    const domain = parts.slice(i).join(".");

    cookies.push({ domain, name: "CloudFront-Key-Pair-Id" });
    cookies.push({ domain, name: "CloudFront-Policy" });
    cookies.push({ domain, name: "CloudFront-Signature" });
  }

  return cookies;
};
