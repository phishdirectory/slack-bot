import { App } from "@slack/bolt";
import { getGitSha } from "../gitSha";
import { Classification } from "../types";

let reviewChannel;
let feedChannel;

if (process.env.NODE_ENV === "production") {
  reviewChannel = "C07DP360WDP"; // phish-classification
  feedChannel = "C07CX5WELQ6"; // fish-feed
} else {
  reviewChannel = "C069N64PW4A";
  feedChannel = "C07DACVT0HG";
}

export async function sendNewDomainMessage(app: App, domain: String) {
  try {
    const result = await app.client.chat
      .postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: reviewChannel,
        text: "reading this? be paitent, im under heavy stress",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":mag: New Domain Classification Needed!",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Domain*: _${domain}_`,
            },
          },
          {
            type: "divider",
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Pick a classification for this domain (${domain})`,
            },
            accessory: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Select an item",
                emoji: true,
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "Postal",
                    emoji: true,
                  },
                  value: `${domain}`,
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Banking",
                    emoji: true,
                  },
                  value: `${domain}`,
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Item Scams",
                    emoji: true,
                  },
                  value: `${domain}`,
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Other",
                    emoji: true,
                  },
                  value: `${domain}`,
                },
              ],
              action_id: "domain_classification",
            },
          },
          {
            type: "divider",
          },
        ],
      })
      .then(async (result) => {
        // console.log(result);

        let ts = result.ts!;
        // @ts-expect-error
        let domain = result.message!.blocks[1].text.text.split("_")[1];
        let environment = process.env.NODE_ENV;
        let gitSha = await getGitSha();
        let npmVersion = process.env.npm_package_version;

        // create a function that takes in domain and ts, as well as the classification and then returns the json data
        async function createData(
          domain: String,
          ts: String,
          classification: Classification
        ) {
          let data = {
            domain: domain,
            ts: ts,
            classification: classification,
          };
          return JSON.stringify(data);
        }

        await app.client.chat.update({
          token: process.env.SLACK_BOT_TOKEN,
          channel: reviewChannel,
          ts: ts,
          text: "reading this? be paitent, im under heavy stress",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: ":mag: New Domain Classification Needed!",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Domain*: _${domain}_`,
              },
            },
            {
              type: "divider",
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Pick a classification for this domain (${domain})`,
              },
              accessory: {
                type: "static_select",
                placeholder: {
                  type: "plain_text",
                  text: "Select an item",
                  emoji: true,
                },
                options: [
                  {
                    text: {
                      type: "plain_text",
                      text: "Postal",
                      emoji: true,
                    },
                    value: `${await createData(domain, ts, "postal")}`,
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Banking",
                      emoji: true,
                    },
                    value: `${await createData(domain, ts, "banking")}`,
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Item Scams",
                      emoji: true,
                    },
                    value: `${await createData(domain, ts, "item_scams")}`,
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Other",
                      emoji: true,
                    },
                    value: `${await createData(domain, ts, "other")}`,
                  },
                ],
                action_id: "domain_classification",
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
              type: "divider",
            },
          ],
        });
      });
  } catch (error) {
    console.error(error);
  }
}
