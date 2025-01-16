import { parseSchduleString } from "./controllers/schedule.js";

export const ordinalNumber = process.env.ORDINAL_NUMBER;
export const port = 2000;
export const jwt = process.env.JWT;

/**
 * Access
 */

export const sharedSecret = process.env.INTRANET_ARCHIVE_SHARED_SECRET;

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

export const cloudFrontKeysObject =
  process.env.AWS_CLOUDFRONT_PUBLIC_KEYS_OBJECT;
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
 * Schedule
 */

export const snapshotSchedule = parseSchduleString(
  process.env.SNAPSHOT_SCHEDULE,
);

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

/**
 * Intranet application
 */

export const heartbeatEndpoint = "auth/heartbeat";

/**
 * Index pages
 */

export const indexCss = `
  main{display:block}a{background-color:transparent;color:#337ab7;text-decoration:none;text-shadow:#fff 1px 0 10px;}
  .list-group-item,body{background-color:#fff}a:active,a:hover{outline:0}h1{font-size:2em;margin:.67em 0}
  *,:after,:before{-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}
  html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;font-size:10px;-webkit-tap-highlight-color:transparent}
  body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px;line-height:1.42857143;color:#333}
  a:focus,a:hover{color:#23527c;text-decoration:underline}
  a:focus{outline:-webkit-focus-ring-color auto 5px;outline-offset:-2px}
  .container{padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}
  @media (min-width:768px){.container{width:750px}}@media (min-width:992px){.container{width:970px}}
  @media (min-width:1200px){.container{width:1170px}}
  .list-group{padding-left:0;margin-bottom:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
  .list-group-item{position:relative;display:block;padding:14px 18px;margin:0 20px 25px 0;background: #fff;
    -webkit-box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3), 0 0 40px rgba(0, 0, 0, 0.1) inset;
    -moz-box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3), 0 0 40px rgba(0, 0, 0, 0.1) inset;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3), 0 0 40px rgba(0, 0, 0, 0.1) inset;
  }
  .container:after,.container:before{display:table;content:" "}
  .container:after{clear:both}.list-group{-webkit-box-shadow:0 1px 2px rgba(0,0,0,.075);box-shadow:0 1px 2px rgba(0,0,0,.075)}
`;
