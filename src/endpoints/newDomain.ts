import { App } from "@slack/bolt";
import { Request, Response } from "express";

import { sendNewDomainMessage } from "../functions/domain";
import { blog } from "../util/Logger";

export async function newDomainEndpoint(req: Request, res: Response, app: App) {
  blog("New Domain Endpoint Hit", "info");
  try {
    const query = req.query;
    let { domain, key } = query;
    domain = domain as string;

    if (!key) {
      return res.status(400).json({ error: "Key is required" });
    }

    if (key !== process.env.SECRET_KEY) {
      return res.status(403).json({ error: "Unauthorized request" });
    }

    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    await sendNewDomainMessage(app, domain).then(() => {
      res.status(200).json({ message: "Message sent" });
    });

    // logic here
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
}
