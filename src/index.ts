import * as dotenv from "dotenv";
dotenv.config();

import { App, ExpressReceiver } from "@slack/bolt";
import axios from "axios";
import colors from "colors";
import express from "express";
import moment from "moment";

import { indexEndpoint } from "./endpoints";
import { healthEndpoint } from "./endpoints/health";
import { newDomainEndpoint } from "./endpoints/newDomain";
import { sendNewDomainMessage } from "./functions/domain";
import { t } from "./lib/templates";
import { blog, slog } from "./util/Logger";

let reviewChannel: string;
let feedChannel: string;

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
        let classification = data.classification;

        await client.chat.delete({
          token: process.env.SLACK_BOT_TOKEN,
          channel: reviewChannel,
          ts: ts,
        });

        let baseUrl: string;

        if (process.env.NODE_ENV === "production") {
          baseUrl = "https://api.phish.directory";
        } else {
          baseUrl = "http://localhost:3000";
        }

        let rsp = await axios.post(
          `${baseUrl}/domain/verdict?key=${process.env.SECRET_KEY}&domain=${domain}&suser=${actionUser}&verdict=${classification}`
        );

        let classmsg = await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: feedChannel,
          text: `> Domain: ${domain} has been classified as ${classification} by <@${actionUser}>`,
        });

        if (actionUser === "U05NX48GL3T") {
          await client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "jasper",
            channel: feedChannel,
            timestamp: classmsg.ts,
          });
        } else if (actionUser === "U0616280E6P") {
          await client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "aram-sq",
            channel: feedChannel,
            timestamp: classmsg.ts,
          });
        } else {
          await client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: ":bust_in_silhouette:",
            channel: feedChannel,
            timestamp: classmsg.ts,
          });
        }

        let classTs = classmsg.ts;
        let classificationEmoji: string;

        switch (classification) {
          case "postal":
            classificationEmoji = "mailbox";
            break;
          case "banking":
            classificationEmoji = "bank";
            break;
          case "item_scams":
            classificationEmoji = "customs";
            break;
          case "other":
            classificationEmoji = "question";
            break;
          default:
            classificationEmoji = "grey_question";
            break;
        }

        try {
          await client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: classificationEmoji,
            channel: feedChannel,
            timestamp: classTs,
          });
        } catch (error) {
          blog(`Error adding emoji: ${error}`, "error");
        }

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

    let user = body.user_id;
    let channel = body.channel_id;
    let command = body.command;

    switch (command) {
      case "/ping":
        let uptime = process.uptime();
        // format the uptime
        let uptimeString = new Date(uptime * 1000).toISOString().substr(11, 8);

        let dateStarted = new Date(Date.now() - uptime * 1000);
        // format the date started with moment
        let dateStartedFormatted =
          moment(dateStarted).format("MM-DD-YY H:m:s A Z");

        await client.chat.postEphemeral({
          token: process.env.SLACK_BOT_TOKEN,
          user: user,
          channel: body.channel_id,
          text: `Pong! 🏓 \n\n I've been awake for ${uptimeString}, I got up at ${dateStartedFormatted}!`,
        });
        break;
      case "/report":
        let domain = body.text;

        if (!domain) {
          await client.chat.postEphemeral({
            token: process.env.SLACK_BOT_TOKEN,
            user: user,
            channel: channel,
            text: "Please provide a domain to report",
          });
          return;
        }

        // check if the domain is a valid domain, or if it has things like a protocol or spaces (which makes it a url)
        // evalueates using this regex: ^(?!http:\/\/|https:\/\/)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$
        // if it doesn't match, then it's not a valid domain
        if (
          !domain.match(/^(?!http:\/\/|https:\/\/)[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/)
        ) {
          await client.chat.postEphemeral({
            token: process.env.SLACK_BOT_TOKEN,
            user: user,
            channel: channel,
            text: "Please provide a valid domain to report (ex: google.com, not http://google.com or www.google.com or google.com/page)",
          });
          return;
        }

        let baseUrl: string;

        if (process.env.NODE_ENV === "production") {
          baseUrl = "https://api.phish.directory";
        } else {
          baseUrl = "http://localhost:3000";
        }

        // fixme: once api is ready send to api

        sendNewDomainMessage(app, domain).then(() => {
          client.chat.postEphemeral({
            token: process.env.SLACK_BOT_TOKEN,
            user: user,
            channel: channel,
            text: `Domain ${domain} has been reported for classification. Thank you!`,
          });
        });

        break;
    }
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
