import crypto from "node:crypto";
import { getSignedCookies } from "@aws-sdk/cloudfront-signer";

import {
  cloudFrontKeysObject as keysObject,
  cloudFrontPublicKey as publicKey,
  cloudFrontPrivateKey as privateKey,
} from "../constants.js";

/**
 * @typedef {Object} CookieSet
 * @property {import('@aws-sdk/cloudfront-signer').CloudfrontSignedCookiesOutput} value
 * @property {number} dateLessThan - epoch in milliseconds
 */

/**
 * @typedef {Object} Cache
 * @property {string|null} keyPairId - will only change on server restart
 * @property {[key: string]: CookieSet} cookieSets
 */

/** @type {Cache} */
const cache = {
  keyPairId: null,
  cookieSets: {},
};

/**
 * Infer the CloudFront CDN URL from the app host
 *
 * @param {string} appHost
 * @returns {URL} cdnURL - The CloudFront CDN URL
 * @throws {Error} If the host is invalid
 */

export const getCdnUrl = (appHost) => {
  // Check appHost starts with `app.`
  if (!appHost.startsWith("app.")) {
    throw new Error("Invalid host");
  }

  const cdnHost = appHost.replace(/^app\./, "");

  // Use regex to replace the initial app. with an empty string.
  return new URL(`https://${cdnHost}`);
};

/**
 * Get the CloudFront key pair ID from the public key and keys object
 *
 * @returns {string} keyPairId - The CloudFront key pair ID
 */

export const getKeyPairId = () => {
  // Return the cached value if it exists
  if (cache.keyPairId) {
    return cache.keyPairId;
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

  cache.keyPairId = keyPairId;

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
    return parseInt(new Date(date.setHours(24, 0, 0, 0)).getTime() / 1000);
  }

  // This should be midnight tomorrow.
  date.setDate(date.getDate() + 1);
  return parseInt(new Date(date.setHours(0, 0, 0, 0)).getTime() / 1000);
};

/**
 * Get signed CloudFront cookies
 *
 * @param {Object} props
 * @param {string} props.resource
 * @param {number} props.dateLessThan
 * @returns {import('@aws-sdk/cloudfront-signer').CloudfrontSignedCookiesOutput} cookies - The signed CloudFront cookies
 */

export const getCookies = ({ resource, dateLessThan }) => {
  // Check if the cache has a value for the resource
  const cachedValue =
    cache.cookieSets?.[resource]?.dateLessThan === dateLessThan;

  // Return the cached value if it exists
  if (cachedValue) {
    return cachedValue;
  }

  const policy = {
    Statement: [
      {
        Resource: resource,
        Condition: {
          DateLessThan: {
            "AWS:EpochTime": new Date(dateLessThan).getTime() / 1000, // time in seconds
          },
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

  // Set the cache
  cache.cookieSets[resource] = {
    dateLessThan,
    value: signedCookies,
  };

  return signedCookies;
};
