/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import express from "express";

import authProvider from "./provider.js";
import { oauthRedirectUri, oauthLogoutRedirectUri } from "../constants.js";

const router = express.Router();

router.get("/login-screen", authProvider.prompt());

router.get(
  "/login",
  authProvider.login({
    scopes: [],
    redirectUri: oauthRedirectUri,
    successRedirect: "/",
  }),
);

router.post("/redirect", authProvider.handleRedirect());

router.get(
  "/signout",
  authProvider.logout({
    postLogoutRedirectUri: oauthLogoutRedirectUri,
  }),
);

export default router;
