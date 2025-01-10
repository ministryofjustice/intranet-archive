import expressSession from "express-session";

import { baseUrl, expressSessionSectet } from "../constants.js";

const session = expressSession({
  secret: expressSessionSectet,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: baseUrl.startsWith("https://"),
  },
});

/**
 * @typedef {{ isAuthenticated: boolean }} SessionData
 * @typedef {import('express').Request & { session: SessionData }} RequestWithSession
 */

/**
 * Middleware to parse the url and agency from the incoming request body
 *
 * @param {RequestWithSession} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns  {void}
 */

const isAuthenticated = (req, res, next) => {
  if (req.path.startsWith("/auth/")) {
    return next();
  }

  if (!req.session.isAuthenticated) {
    return res.redirect("/auth/login-screen"); // redirect to sign-in route
  }

  next();
};

export { session, isAuthenticated };
