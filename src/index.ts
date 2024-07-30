import * as dotenv from "dotenv";
dotenv.config();

import { App, ExpressReceiver } from "@slack/bolt";
import axios from "axios";
import colors from "colors";
import express from "express";
import moment from "moment";
import responseTime from "response-time";
import { CronJob } from "cron";

import { indexEndpoint } from "./endpoints";
import { healthEndpoint } from "./endpoints/health";
import { newDomainEndpoint } from "./endpoints/newDomain";
import { sendNewDomainMessage } from "./functions/domain";
import { t } from "./lib/templates";
import { blog, slog } from "./util/Logger";
import metrics from "./ metrics";

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

app.event(/.*/, async ({ event, client }) => {
  metrics.increment(`slack.event.${event.type}`);
});

app.action(/.*?/, async (args) => {
  // @ts-expect-error
  metrics.increment(`slack.action.${args.payload.action_id}`);
  try {
    const { ack, respond, payload, client, body } = args;
    let actionUser = body.user.id!;

    await ack();

    // @ts-ignore
    switch (payload.action_id) {
      case "domain_classification":
        // @ts-expect-error
        let rawData = payload.selected_option.value;
        let data = JSON.parse(rawData);

        let domain = data.domain;
        let ts = data.ts;
        let classification = data.classification;

        await client.chat
          .delete({
            token: process.env.SLACK_BOT_TOKEN,
            channel: reviewChannel,
            ts: ts,
          })
          .catch((error) =>
            blog(`Error deleting chat message: ${error}`, "error"),
          );

        let baseUrl: string;

        if (process.env.NODE_ENV === "production") {
          baseUrl = "https://api.phish.directory";
        } else {
          baseUrl = "http://localhost:3000";
        }

        let rsp = await axios.post(
          `${baseUrl}/domain/verdict?key=${process.env.SECRET_KEY}&domain=${domain}&suser=${actionUser}&verdict=${classification}`,
        );

        let classmsg = await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: feedChannel,
          text: `> *Domain:* _${domain}_ has been *classified* as _${classification}_ by _<@${actionUser}>_`,
        });

        if (actionUser === "U05NX48GL3T") {
          client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "jasper",
            channel: feedChannel,
            timestamp: classmsg.ts,
          });
        } else if (actionUser === "U0616280E6P") {
          client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "aram-sq",
            channel: feedChannel,
            timestamp: classmsg.ts,
          });
        } else {
          client.reactions.add({
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

        client.reactions.add({
          token: process.env.SLACK_BOT_TOKEN,
          name: classificationEmoji,
          channel: feedChannel,
          timestamp: classTs,
        });

        if (rsp.data === "Verdict added") {
          client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: feedChannel,
            text: `API Successfully responded with: ${rsp.data}`,
            thread_ts: classTs,
          });

          // react to the top level message
          client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "white_check_mark",
            channel: feedChannel,
            timestamp: classTs,
          });
        } else {
          client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: feedChannel,
            text: `API responded with: ${rsp.data}`,
            thread_ts: classTs,
          });

          client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "x",
            channel: feedChannel,
            timestamp: classTs,
          });
        }

        break;
      case "reject_domain":
        // @ts-expect-error
        const rawRData = payload.value;

        let rData = JSON.parse(rawRData);
        let rdomain = rData.domain;
        let rts = rData.ts;

        await client.chat
          .delete({
            token: process.env.SLACK_BOT_TOKEN,
            channel: reviewChannel,
            ts: rts,
          })
          .catch((error) =>
            blog(`Error deleting chat message: ${error}`, "error"),
          );

        let rclassmsg = await client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: feedChannel,
          text: `> *Domain:* _${rdomain}_ has been *marked* as _Safe_ by _<@${actionUser}>_`,
        });

        if (actionUser === "U05NX48GL3T") {
          client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "jasper",
            channel: feedChannel,
            timestamp: rclassmsg.ts,
          });
        } else if (actionUser === "U0616280E6P") {
          client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: "aram-sq",
            channel: feedChannel,
            timestamp: rclassmsg.ts,
          });
        } else {
          client.reactions.add({
            token: process.env.SLACK_BOT_TOKEN,
            name: ":bust_in_silhouette:",
            channel: feedChannel,
            timestamp: rclassmsg.ts,
          });
        }

        client.reactions.add({
          token: process.env.SLACK_BOT_TOKEN,
          name: "large_green_circle",
          channel: feedChannel,
          timestamp: rclassmsg.ts,
        });

        break;
      case "scan_domain":
        // @ts-expect-error
        const rawSData = payload.value;

        let sData = JSON.parse(rawSData);
        let sdomain = sData.domain;
        let sts = sData.ts;

        let scanurl;

        try {
          const scan = await axios.post(
            "https://urlscan.io/api/v1/scan/",
            {
              url: sdomain,
              visibility: "public", // Ensure visibility is set if required
              tags: ["https://phish.directory", "api.phish.directory"],
            },
            {
              headers: {
                "Content-Type": "application/json",
                "API-Key": process.env.URLSCAN_API_KEY!,
                Referer: "https://phish.directory",
              },
            },
          );

          scanurl = scan.data.result;
          await scanurl;

          await client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: reviewChannel,
            thread_ts: sts,
            text: `Yo <@${actionUser}>, I've started scanning _${sdomain}_ for you. You can view the results *<${scanurl}|here>*! (${scanurl})`,
          });

          await client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: feedChannel,
            text: `> Domain _${sdomain}_ has been *scanned* by _<@${actionUser}>_. View the results *<${scanurl}|here>* (${scanurl})`,
          });
        } catch (error) {
          await client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: reviewChannel,
            thread_ts: sts,
            text: `Heya <@${actionUser}>, I tried scanning _${sdomain}_ but it failed. Here's the error: ${error}`,
          });
        }

        break;
      default:
        console.log("Unknown action");
        break;
    }
  } catch (error) {
    metrics.increment("slack.actions.error");
    blog(
      `Error in action handler: ${JSON.stringify(
        error,
        Object.getOwnPropertyNames(error),
      )}`,
      "error",
    );
  }
});

app.command(/.*?/, async ({ ack, body, client }) => {
  metrics.increment("slack.commands.received");

  try {
    await ack();

    let user = body.user_id;
    let channel = body.channel_id;
    let command = body.command;

    metrics.increment(`slack.command.${command}`);

    switch (command) {
      case "/ping":
        let uptime = process.uptime();
        // format the uptime
        let uptimeString = new Date(uptime * 1000).toISOString().substr(11, 8);

        let dateStarted = new Date(Date.now() - uptime * 1000);
        // format the date started with moment
        let dateStartedFormatted =
          moment(dateStarted).format("MM-DD-YY H:m:s A Z");

        await client.chat
          .postEphemeral({
            token: process.env.SLACK_BOT_TOKEN,
            user: user,
            channel: body.channel_id,
            text: `Pong! 🏓 \n\n I've been awake for ${uptimeString}, I got up at ${dateStartedFormatted}!`,
          })
          .catch((error) =>
            blog(`Error posting ephemeral message: ${error}`, "error"),
          );
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
    metrics.increment("slack.commands.error");
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
    metrics.timing(timingStatKey, time);
    metrics.increment(codeStatKey, 1);
  }),
);

app.use(async ({ payload, next }) => {
  metrics.increment(`slack.request.${payload.type}`);
  await next();
});

// Add metric interceptors for axios
axios.interceptors.request.use((config: any) => {
  config.metadata = { startTs: performance.now() };
  return config;
});

axios.interceptors.response.use((res: any) => {
  const stat = (res.config.method + "/" + res.config.url?.split("/")[1])
    .toLowerCase()
    .replace(/[:.]/g, "")
    .replace(/\//g, "_");

  const httpCode = res.status;
  const timingStatKey = `http.request.${stat}`;
  const codeStatKey = `http.request.${stat}.${httpCode}`;
  metrics.timing(
    timingStatKey,
    performance.now() - res.config.metadata.startTs,
  );
  metrics.increment(codeStatKey, 1);

  return res;
});

const logStartup = async (app: App) => {
  let env = process.env.NODE_ENV;
  slog(t("app.startup", { environment: env }), "info");
};

app.start(process.env.PORT || 3000).then(async () => {
  metrics.increment("app.startup");
  await logStartup(app);
  console.log(
    colors.bgCyan(`⚡️ Bolt app is running in env ${process.env.NODE_ENV}`),
  );
});

// Heartbeat
new CronJob(
  "0 * * * * *",
  async function () {
    metrics.increment("heartbeat");
  },
  null,
  true,
  "America/New_York",
);

const client: any = app.client;
export { app, client };
