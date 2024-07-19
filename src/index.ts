import * as dotenv from "dotenv";
dotenv.config();

import { App, ExpressReceiver } from "@slack/bolt";
import axios from "axios";
import colors from "colors";
import express from "express";
import responseTime from "response-time";

import { indexEndpoint } from "./endpoints";
import { healthEndpoint } from "./endpoints/health";
import { newDomainEndpoint } from "./endpoints/newDomain";
import { t } from "./lib/templates";
import { blog, slog } from "./util/Logger";

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  appToken: process.env.SLACK_APP_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  receiver,
});

app.event(/.*/, async ({ event, client }) => {
  try {
    switch (event.type) {
      case "team_join":
        break;
    }
  } catch (error) {
    blog(`Error in event handler: ${error}`, "error");
  }
});

app.action(/.*?/, async (args) => {
  try {
    const { ack, respond, payload, client, body } = args;
    const user = body.user.id;

    await ack();

    console.log(payload);

    // @ts-ignore
    switch (payload.action_id) {
      case "domain_classification":
        // todo: actually do stuff here
        break;
    }
  } catch (error) {
    blog(`Error in action handler: ${error}`, "error");
  }
});

app.command(/.*?/, async ({ ack, body, client }) => {
  try {
    await ack();
    // This is not used
  } catch (error) {
    blog(`Error in command handler: ${error}`, "error");
  }
});

receiver.router.use(express.json());
receiver.router.get("/", indexEndpoint);
receiver.router.get("/ping", healthEndpoint);
receiver.router.get("/up", healthEndpoint);
receiver.router.get("/newDomain", (req, res) => {
  newDomainEndpoint(req, res, app);
});

receiver.router.use(
  responseTime((req, res, time) => {
    const stat = (req.method + "/" + req.url?.split("/")[1])
      .toLowerCase()
      .replace(/[:.]/g, "")
      .replace(/\//g, "_");

    const httpCode = res.statusCode;
    const timingStatKey = `http.response.${stat}`;
    const codeStatKey = `http.response.${stat}.${httpCode}`;
  })
);

app.use(async ({ payload, next }) => {
  await next();
});

// Add metric interceptors for axios
axios.interceptors.request.use((config: any) => {
  config.metadata = { startTs: performance.now() };
  return config;
});

const logStartup = async (app: App) => {
  let env = process.env.NODE_ENV;
  slog(t("app.startup", { environment: env }), "info");
};

app.start(process.env.PORT || 3000).then(async () => {
  await logStartup(app);
  console.log(
    colors.bgCyan(`⚡️ Bolt app is running in env ${process.env.NODE_ENV}`)
  );
});

// new CronJob(
//   "0 * * * * *",
//   function()
//   null,
//   true,
//   "America/New_York"
// );

const client: any = app.client;
export { app, client };
