export function buildRealtimeInstructions({ topic, memory }) {
  const name = memory?.name || "friend";
  const level = memory?.level || "intermediate";
  const goals = memory?.goals || "speak naturally and confidently";
  const recurring = Array.isArray(memory?.recurringMistakes)
    ? memory.recurringMistakes.slice(0, 5).join(", ")
    : "";

  return `You are FluentFlow AI, a premium English fluency companion.

Personality:
- Calm, intelligent, concise, emotionally supportive.
- Warm masculine-neutral tone: confident, smooth, never childish.
- Speak like a smart friend and mentor, not like a school teacher.
- Keep replies short enough for live voice: usually 1 to 3 sentences.

User:
- Name: ${name}
- English level: ${level}
- Goal: ${goals}
- Favorite/current topic: ${topic || "Daily Life"}
- Recurring mistakes to watch: ${recurring || "none recorded yet"}

Conversation behavior:
- Start naturally. Ask one thoughtful question about the selected topic.
- Adapt vocabulary and pace to the user's level.
- If the user makes a grammar, pronunciation, or phrasing mistake, correct it gently and briefly.
- Use this correction style: "Small correction: say '...' Good. Continue..."
- Do not overcorrect. Prioritize the most important mistake in the moment.
- If the user is flowing well, let them speak and encourage them.
- Interrupt only when the correction prevents repeated confusion or the user asks for coaching.
- After any correction, continue the conversation naturally.
- Never sound robotic, patronizing, cringe, or overly excited.
- If the user asks for current news or facts and you do not have fresh context in the session, say so briefly and invite a general discussion angle.

Output:
- Speak naturally in English.
- Avoid long lectures, quizzes, flashcards, or school-like exercises.
- When helpful, mention one better phrase and return to the topic.`;
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    const value = req.body.toString("utf8");
    return value ? JSON.parse(value) : {};
  }

  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }

  const body = await new Promise((resolve, reject) => {
    let value = "";
    req.setEncoding?.("utf8");
    req.on?.("data", (chunk) => {
      value += chunk;
      if (value.length > 2_000_000) {
        reject(new Error("Body too large"));
        req.destroy?.();
      }
    });
    req.on?.("end", () => resolve(value));
    req.on?.("error", reject);
  });

  return body ? JSON.parse(body) : {};
}

export function sendJson(res, status, payload) {
  if (typeof res.status === "function") {
    return res.status(status).json(payload);
  }

  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

export function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  if (typeof res.status === "function") {
    res.status(status);
    res.setHeader("content-type", contentType);
    res.send(text);
    return;
  }

  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(text);
}

export function getCapabilities() {
  const realtimeConfigured = Boolean(
    process.env.OPENAI_API_KEY && process.env.OPENAI_REALTIME_ENABLED === "true"
  );
  const textAiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);

  return {
    ok: true,
    realtimeConfigured,
    textAiConfigured,
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    freeBrowserVoice: true,
    installablePwa: true
  };
}

function localCorrection(text) {
  const lower = text.toLowerCase();
  if (lower.includes("i go yesterday")) {
    return "Small correction: say 'I went to the market yesterday.' Good. Continue with what happened there.";
  }
  if (lower.includes("she don't") || lower.includes("he don't")) {
    return "Small correction: say 'she doesn't' or 'he doesn't.' Nice. Keep your sentence going.";
  }
  if (lower.includes("more better")) {
    return "Small correction: say 'better,' not 'more better.' Simple and clean. Continue.";
  }
  if (lower.includes("discuss about")) {
    return "Small correction: say 'discuss the topic,' not 'discuss about the topic.' Good phrasing upgrade.";
  }
  if (lower.includes("depend of")) {
    return "Small correction: say 'depends on,' not 'depends of.' Good. Keep your idea moving.";
  }
  return "";
}

export function localCoachReply({ text = "", topic = "Daily Life", memory = {} }) {
  const correction = localCorrection(text);
  if (correction) return correction;

  const name = memory.name ? `${memory.name}, ` : "";
  const prompts = {
    "World News": "give me your opinion in one clear sentence.",
    Business: "tell me how this connects to real work.",
    Money: "explain what a smart decision would look like.",
    Movies: "describe the scene or character you have in mind.",
    Comics: "tell me what makes that story memorable.",
    Culture: "compare it with something from your own life.",
    Productivity: "say one habit you want to improve.",
    "Daily Life": "tell me one detail from today.",
    Technology: "explain whether it feels useful or distracting.",
    Motivation: "say the next small step out loud."
  };

  return `${name}good. ${prompts[topic] || "keep going with one more natural sentence."}`;
}

function buildCoachPrompt({ text, topic, memory, recent }) {
  const name = memory?.name || "friend";
  const level = memory?.level || "Intermediate";
  const goals = memory?.goals || "build natural spoken English";
  const recurring = Array.isArray(memory?.recurringMistakes)
    ? memory.recurringMistakes.slice(0, 5).join(", ")
    : "none";

  return `You are FluentFlow AI, a calm premium English speaking companion.

User name: ${name}
Level: ${level}
Goal: ${goals}
Topic: ${topic}
Recurring mistakes: ${recurring}
Recent conversation: ${JSON.stringify((recent || []).slice(-6))}

The user just said: "${text}"

Reply for browser text-to-speech:
- 1 or 2 short sentences only.
- If there is a clear English mistake, gently correct one mistake first.
- Correction style: "Small correction: say '...' Good. Continue..."
- If no major mistake, respond like a smart friend and ask one natural follow-up.
- No quiz, no lecture, no childish tone.`;
}

export async function createCoachReply(payload) {
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "http-referer": process.env.PUBLIC_APP_URL || "http://localhost:3000",
        "x-title": "FluentFlow AI"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL,
        messages: [{ role: "user", content: buildCoachPrompt(payload) }],
        temperature: 0.55,
        max_tokens: 90
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "OpenRouter request failed");
    return data?.choices?.[0]?.message?.content?.trim() || localCoachReply(payload);
  }

  if (process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
        input: buildCoachPrompt(payload),
        temperature: 0.55,
        max_output_tokens: 90
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed");
    return data.output_text?.trim() || localCoachReply(payload);
  }

  return localCoachReply(payload);
}

export async function handleCoach(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  try {
    const payload = await readJson(req);
    const reply = await createCoachReply(payload);
    return sendJson(res, 200, {
      reply,
      source: process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL
        ? "openrouter"
        : process.env.OPENAI_API_KEY
          ? "openai"
          : "local"
    });
  } catch (error) {
    return sendJson(res, 200, {
      reply: localCoachReply({ text: "", topic: "Daily Life" }),
      source: "local",
      warning: error.message
    });
  }
}

export async function handleRealtimeSession(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  if (!getCapabilities().realtimeConfigured) {
    return sendJson(res, 503, {
      error: "Realtime mode is disabled. Set OPENAI_REALTIME_ENABLED=true and OPENAI_API_KEY to use it.",
      freeBrowserVoice: true
    });
  }

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Expected JSON body with sdp, topic, and memory." });
  }

  if (!payload?.sdp) return sendJson(res, 400, { error: "Missing SDP offer." });

  const session = {
    type: "realtime",
    model: "gpt-realtime",
    instructions: buildRealtimeInstructions(payload),
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
          prompt: "English learning conversation with gentle fluency corrections."
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.55,
          prefix_padding_ms: 240,
          silence_duration_ms: 520,
          interrupt_response: true,
          create_response: true
        }
      },
      output: { voice: "marin" }
    }
  };

  const form = new FormData();
  form.set("sdp", payload.sdp);
  form.set("session", JSON.stringify(session));

  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });

    const answer = await upstream.text();
    if (!upstream.ok) {
      return sendJson(res, upstream.status, {
        error: "OpenAI Realtime session failed.",
        detail: answer
      });
    }

    return sendText(res, 200, answer, "application/sdp");
  } catch (error) {
    return sendJson(res, 500, {
      error: "Realtime session request failed.",
      detail: error.message
    });
  }
}

export async function handleTopicContext(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  let payload = {};
  try {
    payload = await readJson(req);
  } catch {
    return sendJson(res, 400, { error: "Expected JSON body." });
  }

  const topic = String(payload.topic || "Daily Life");
  const fallback = {
    topic,
    brief: `${topic} mode is ready. Keep the conversation natural, current where possible, and focused on confident spoken English.`,
    source: "local"
  };

  if (!process.env.NEWS_API_KEY || !["World News", "Business", "Technology", "Money"].includes(topic)) {
    return sendJson(res, 200, fallback);
  }

  try {
    const q = encodeURIComponent(topic === "Money" ? "personal finance economy" : topic);
    const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=5&q=${q}`;
    const r = await fetch(url, { headers: { "x-api-key": process.env.NEWS_API_KEY } });
    const data = await r.json();
    const titles = (data.articles || [])
      .map((article) => article.title)
      .filter(Boolean)
      .slice(0, 5);

    return sendJson(res, 200, {
      topic,
      brief: titles.length ? `Fresh discussion angles: ${titles.join(" | ")}` : fallback.brief,
      source: titles.length ? "newsapi" : "local"
    });
  } catch (error) {
    return sendJson(res, 200, { ...fallback, detail: error.message });
  }
}

export function handleHealth(_req, res) {
  return sendJson(res, 200, getCapabilities());
}
