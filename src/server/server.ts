import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { CognitoError, unsupported, UnsupportedError } from "../errors";
import { Router } from "../targets/router";

export interface ServerStartOptions {
  port?: number;
  hostname?: string;
}

export interface Server {
  application: any; // eslint-disable-line
  start(options?: ServerStartOptions): Promise<ServerStartOptions>;
}

export const createServer = (router: Router): Server => {
  const app = express();

  app.use(
    cors({
      origin: "*",
    })
  );
  app.use(
    bodyParser.json({
      type: "application/x-amz-json-1.1",
    })
  );

  app.post("/", async (req, res) => {
    const xAmzTarget = req.headers["x-amz-target"];

    if (!xAmzTarget) {
      return res.status(400).json({ message: "Missing x-amz-target header" });
    } else if (xAmzTarget instanceof Array) {
      return res.status(400).json({ message: "Too many x-amz-target headers" });
    }

    const [, target] = xAmzTarget.split(".");
    if (!target) {
      return res.status(400).json({ message: "Invalid x-amz-target header" });
    }

    const route = router(target);

    try {
      const output = await route(req.body);

      return res.status(200).json(output);
    } catch (ex) {
      console.error(`Error handling target: ${target}`, ex);
      if (ex instanceof UnsupportedError) {
        return unsupported(ex.message, res);
      } else if (ex instanceof CognitoError) {
        return res.status(400).json({
          code: ex.code,
          message: ex.message,
        });
      } else {
        return res.status(500).json(ex);
      }
    }
  });

  return {
    application: app,
    start(options) {
      const actualOptions = {
        port: options?.port ?? 9229,
        hostname: options?.hostname ?? "localhost",
      };
      return new Promise((resolve, reject) => {
        app.listen(actualOptions.port, actualOptions.hostname, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(actualOptions);
          }
        });
      });
    },
  };
};