export const port = 2000;
export const jwt = process.env.JWT;

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
  "hts-log.txt", // Has the httrack command line arguments - this includes the JWT.
  `hts-cache/doit.log`, // Has the httrack command line arguments - this includes the JWT.
  `hts-cache/new.zip`,
];
