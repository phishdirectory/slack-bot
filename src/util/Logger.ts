import * as dotenv from "dotenv";
dotenv.config();

import { getGitSha } from "../gitSha";
import { client } from "../index";

import async from "async";
import Bottleneck from "bottleneck";
import colors from "colors";

// Create a rate limiter with Bottleneck
const limiter = new Bottleneck({
  minTime: 1000, // 1 second between each request
});

const messageQueue = async.queue(async (task, callback) => {
  try {
    await limiter.schedule(() => client.chat.postMessage(task));
    callback();
  } catch (error) {
    console.error("Error posting message:", error);
    // @ts-ignore
    callback(error);
  }
}, 1); // Only one worker to ensure order and rate limit

async function slog(logMessage, type) {
  let environment = process.env.NODE_ENV;
  let gitSha = await getGitSha();
  let npmVersion = process.env.npm_package_version;

  const message = {
    channel: process.env.SLACK_LOG_CHANNEL,
    text: logMessage,
    blocks: [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: logMessage
            .split("\n")
            .map((a) => `> ${a}`)
            .join("\n"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Running environment:* _${environment}_`,
          },
          {
            type: "mrkdwn",
            text: `*Git SHA:* _${gitSha}_`,
          },
          {
            type: "mrkdwn",
            text: `*NPM Version:* _${npmVersion}_`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${new Date().toString()}`,
          },
        ],
      },
      {
        type: "divider",
      },
    ],
  };

  messageQueue.push(message, (error) => {
    if (error) {
      console.error("Failed to send message:", error);
    }
  });
}

type LogType = "info" | "start" | "cron" | "error";

export const clog = async (logMessage, type: LogType) => {
  switch (type) {
    case "info":
      console.log(colors.blue(logMessage));
      break;
    case "start":
      console.log(colors.bgBlue(logMessage));
      break;
    case "cron":
      console.log(colors.magenta(`[CRON]: ${logMessage}`));
      break;
    case "error":
      console.error(colors.red.bold(logMessage));
      break;
    default:
      console.log(logMessage);
  }
};

export const blog = async (logMessage, type: LogType) => {
  slog(logMessage, type);
  clog(logMessage, type);
};

export { clog as default, slog };
