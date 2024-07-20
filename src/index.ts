import * as dotenv from "dotenv";
dotenv.config();

import { App, ExpressReceiver } from "@slack/bolt";
import axios from "axios";
import colors from "colors";
import express from "express";

import { indexEndpoint } from "./endpoints";
import { healthEndpoint } from "./endpoints/health";
import { newDomainEndpoint } from "./endpoints/newDomain";
import { t } from "./lib/templates";
import { blog, slog } from "./util/Logger";

type Classification = "postal" | "banking" | "item_scams" | "other";

let reviewChannel;
let feedChannel;

if (process.env.NODE_ENV === "production") {
  reviewChannel = "C07DP360WDP"; // phish-classification
  feedChannel = "C07CX5WELQ6"; // fish-feed
} else {
  reviewChannel = "C069N64PW4A";
  feedChannel = "C07DACVT0HG";
}

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN!,
  appToken: process.env.SLACK_APP_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  receiver,
});

app.event(/.*/, async ({ event, client }) => {});

app.action(/.*?/, async (args) => {
  try {
    const { ack, respond, payload, client, body } = args;
    const user = body.user.id;

    let actionUser = body.user.id!;

    await ack();

    // @ts-ignore
    switch (payload.action_id) {
      case "domain_classification":
        // console.log(payload);

        // @ts-expect-error
        let rawData = payload.selected_option.value;
        let data = JSON.parse(rawData);

        let domain = data.domain;
        let ts = data.ts;

        // @ts-expect-error
        let classif = payload.selected_option.text.text;
        classif = classif.toLowerCase();

        await client.chat.delete({
          token: process.env.SLACK_BOT_TOKEN,
          channel: reviewChannel,
          ts: ts,
        });

        let rsp = await axios.post(
          `http://localhost:3000/domain/verdict?key=${process.env.SECRET_KEY}&domain=${domain}&suser=${actionUser}&verdict=${classif}`
        );

        let classmsg = await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: feedChannel,
          text: `> Domain: ${domain} has been classified as ${classif} by <@${actionUser}>`,
        });

        let classTs = classmsg.ts;

        if (rsp.data === "Verdict added") {
          await client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: feedChannel,
            text: `API Successfully responded with: ${rsp.data}`,
            thread_ts: classTs,
          });

          // react to the top level message
          await client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "white_check_mark",
            channel: feedChannel,
            timestamp: classTs,
          });
        } else {
          await client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: feedChannel,
            text: `API responded with: ${rsp.data}`,
            thread_ts: classTs,
          });

          await client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "x",
            channel: feedChannel,
            timestamp: classTs,
          });
        }

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
