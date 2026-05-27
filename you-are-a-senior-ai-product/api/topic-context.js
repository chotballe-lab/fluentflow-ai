import { handleTopicContext } from "../lib/fluentflow-core.js";

export default function handler(req, res) {
  return handleTopicContext(req, res);
}
