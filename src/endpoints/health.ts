import { Request, Response } from "express";
import { blog } from "../util/Logger";

export async function healthEndpoint(req: Request, res: Response) {
  try {
    blog("Health check Hit", "info");

    if (req.path === "/up") {
      res.status(200).json({ message: "ok" });
    } else if (req.path === "/ping") {
      res.status(200).json({ message: "pong" });
    }
  } catch (error) {
    blog(`error with healthEndpoint: \n${error}`, "error");
    res.status(500).json({ error: "Internal Server Error" });
  }
}
