import metrics from "../ metrics";
import { blog } from "./Logger";

export function sleep(ms) {
  try {
    metrics.increment("sleep");
    blog(`Sleeping for ${ms}ms`, "info");
    return new Promise((resolve) => setTimeout(resolve, ms));
  } catch (error) {
    metrics.increment("sleep.error");
    blog(`Error in sleep: ${error}`, "error");
  }
}
