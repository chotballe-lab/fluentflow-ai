import { handleHealth } from "../lib/fluentflow-core.js";

export default function handler(req, res) {
  return handleHealth(req, res);
}
