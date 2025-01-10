import {
  skipAuth,
  oauthClientId,
  oauthTenantId,
  oauthClientSecret,
  oauthRedirectUri,
  expressSessionSectet,
} from "../constants.js";

let msalConfig = {};

if (!skipAuth) {
  if (!oauthClientId) {
    throw new Error("Missing OAUTH_CLIENT_ID environment variable");
  }
  if (!oauthTenantId) {
    throw new Error("Missing OAUTH_TENANT_ID environment variable");
  }
  if (!oauthClientSecret) {
    throw new Error("Missing OAUTH_CLIENT_SECRET environment variable");
  }
  if (!expressSessionSectet) {
    throw new Error("Missing EXPRESS_SESSION_SECRET environment variable");
  }

  /**
   * Configuration object to be passed to MSAL instance on creation.
   * For a full list of MSAL Node configuration parameters, visit:
   * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
   */
  msalConfig = {
    auth: {
      clientId: oauthClientId,
      authority: "https://login.microsoftonline.com/" + oauthTenantId,
      clientSecret: oauthClientSecret,
    },
    system: {
      loggerOptions: {
        loggerCallback(loglevel, message, containsPii) {
          console.log(message);
        },
        piiLoggingEnabled: false,
        logLevel: 3,
      },
    },
  };
}

export { msalConfig };
