import { handleRealtimeSession } from "../../lib/fluentflow-core.js";

export default function handler(req, res) {
  return handleRealtimeSession(req, res);
}
