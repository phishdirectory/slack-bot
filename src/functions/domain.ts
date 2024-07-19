import { App } from "@slack/bolt";

export async function sendNewDomainMessage(app: App, domain: String) {
  try {
    const result = await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: "C069N64PW4A",
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
                value: "postal",
              },
              {
                text: {
                  type: "plain_text",
                  text: "Banking",
                  emoji: true,
                },
                value: "banking",
              },
              {
                text: {
                  type: "plain_text",
                  text: "Item Scams",
                  emoji: true,
                },
                value: "item-scams",
              },
              {
                text: {
                  type: "plain_text",
                  text: "Other",
                  emoji: true,
                },
                value: "other",
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
  } catch (error) {
    console.error(error);
  }
}
