export const port = 2000;
export const baseUrl = process.env.BASE_URL;
export const jwt = process.env.JWT;

/**
 * Auth
 */

export const skipAuth = process.env.OAUTH_SKIP_AUTH === 'true';
export const oauthClientId = process.env.OAUTH_CLIENT_ID;
export const oauthTenantId = process.env.OAUTH_TENANT_ID;
export const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;
export const oauthRedirectUri = `${process.env.BASE_URL}/auth/redirect`;
export const oauthLogoutRedirectUri = `${process.env.BASE_URL}/auth/login-screen?logged-out=true`;
export const expressSessionSectet = process.env.EXPRESS_SESSION_SECRET;

/**
 * S3
 */

export const s3Region = "eu-west-2";
export const s3BucketName = process.env.S3_BUCKET_NAME;
export const s3Credentials = process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY && {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };

/**
 * CloudFront
 */

export const cloudFrontKeysObject = process.env.AWS_CLOUDFRONT_PUBLIC_KEYS_OBJECT;
export const cloudFrontPublicKey = process.env.AWS_CLOUDFRONT_PUBLIC_KEY;
export const cloudFrontPrivateKey = process.env.AWS_CLOUDFRONT_PRIVATE_KEY;

/**
 * Options
 */

export const corsOptions = {
  methods: ["POST"],
  origin: [
    "http://spider.intranet.docker/",
    "https://dev-intranet-archive.apps.live.cloud-platform.service.justice.gov.uk/",
  ],
};

/**
 * Defaults
 */

export const defaultAgency = "hq";
export const defaultUrl = "https://intranet.justice.gov.uk/";

/**
 * Validation
 */

export const allowedTargetHosts = [
  "intranet.docker",
  "intranet.justice.gov.uk",
  "dev.intranet.justice.gov.uk",
  "staging.intranet.justice.gov.uk",
  "demo.intranet.justice.gov.uk",
];

export const allowedTargetAgencies =
  process.env.ALLOWED_AGENCIES?.split(",") ?? [];

/**
 * Httrack
 */

export const sensitiveFiles = [
  "cookies.txt", // Contains the JWT and CloudFront cookies.
  "hts-in_progress.lock", // Contains the JWT.
  "hts-log.txt", // Has the httrack command line arguments - this includes the JWT.
  `hts-cache/doit.log`, // Has the httrack command line arguments - this includes the JWT.
  `hts-cache/new.zip`,
];
