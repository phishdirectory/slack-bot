import { App } from "@slack/bolt";

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
        console.log(result);

        let ts = result.ts!;
        // @ts-expect-error
        let domain = result.message!.blocks[1].text.text.split("_")[1];

        console.log(ts);
        console.log(domain);

        let data = {
          domain: domain,
          ts: ts,
        };

        let dataString = JSON.stringify(data);

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
                    value: `${dataString}`,
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Banking",
                      emoji: true,
                    },
                    value: `${dataString}`,
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Item Scams",
                      emoji: true,
                    },
                    value: `${dataString}`,
                  },
                  {
                    text: {
                      type: "plain_text",
                      text: "Other",
                      emoji: true,
                    },
                    value: `${dataString}`,
                  },
                ],
                action_id: "domain_classification",
              },
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
