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
                  text: "Class 1",
                  emoji: true,
                },
                value: "value-0",
              },
              {
                text: {
                  type: "plain_text",
                  text: "Class 2",
                  emoji: true,
                },
                value: "value-1",
              },
              {
                text: {
                  type: "plain_text",
                  text: "Class 3",
                  emoji: true,
                },
                value: "value-2",
              },
            ],
            action_id: "static_select-action",
          },
        },
        {
          type: "divider",
        },
      ],
    });
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}
