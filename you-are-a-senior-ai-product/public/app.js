const topics = [
  "World News",
  "Business",
  "Money",
  "Movies",
  "Comics",
  "Culture",
  "Productivity",
  "Daily Life",
  "Technology",
  "Motivation"
];

const defaultState = {
  activeTopic: "Daily Life",
  autoListening: true,
  soundOn: true,
  onboarded: false,
  preferredEngine: "browser",
  voicePermission: "unknown",
  sessionActive: false,
  startedAt: null,
  elapsedSeconds: 0,
  memory: {
    name: "",
    level: "Intermediate",
    goals: "",
    favoriteTopics: ["Daily Life"],
    recurringMistakes: [],
    conversationHistory: []
  },
  progress: {
    streak: 0,
    lastPracticeDate: "",
    minutes: 0,
    vocabulary: [],
    confidence: 72,
    fluency: 40
  },
  transcript: []
};

const els = {
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  timerText: document.querySelector("#timerText"),
  bootSplash: document.querySelector("#bootSplash"),
  enginePill: document.querySelector("#enginePill"),
  installButton: document.querySelector("#installButton"),
  permissionPanel: document.querySelector("#permissionPanel"),
  permissionButton: document.querySelector("#permissionButton"),
  permissionText: document.querySelector("#permissionText"),
  networkPanel: document.querySelector("#networkPanel"),
  networkText: document.querySelector("#networkText"),
  topicRail: document.querySelector("#topicRail"),
  modeLabel: document.querySelector("#modeLabel"),
  listenLabel: document.querySelector("#listenLabel"),
  autoButton: document.querySelector("#autoButton"),
  autoState: document.querySelector("#autoState"),
  muteButton: document.querySelector("#muteButton"),
  muteState: document.querySelector("#muteState"),
  talkButton: document.querySelector("#talkButton"),
  correctionText: document.querySelector("#correctionText"),
  confidencePill: document.querySelector("#confidencePill"),
  transcriptList: document.querySelector("#transcriptList"),
  clearButton: document.querySelector("#clearButton"),
  streakValue: document.querySelector("#streakValue"),
  minutesValue: document.querySelector("#minutesValue"),
  vocabValue: document.querySelector("#vocabValue"),
  fluencyValue: document.querySelector("#fluencyValue"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsSheet: document.querySelector("#settingsSheet"),
  closeSettings: document.querySelector("#closeSettings"),
  saveSettings: document.querySelector("#saveSettings"),
  nameInput: document.querySelector("#nameInput"),
  levelInput: document.querySelector("#levelInput"),
  goalInput: document.querySelector("#goalInput"),
  onboardingSheet: document.querySelector("#onboardingSheet"),
  startOnboarding: document.querySelector("#startOnboarding"),
  skipOnboarding: document.querySelector("#skipOnboarding"),
  remoteAudio: document.querySelector("#remoteAudio"),
  canvas: document.querySelector("#voiceCanvas")
};

let state = loadState();
let pc = null;
let dc = null;
let localStream = null;
let demoRecognition = null;
let timerId = null;
let animationId = null;
let analyser = null;
let audioCtx = null;
let audioData = new Uint8Array(128);
let speakingEnergy = 0;
let capabilities = {
  realtimeConfigured: false,
  textAiConfigured: false,
  freeBrowserVoice: true
};
let deferredInstallPrompt = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("fluentflow-state"));
    return structuredClone({ ...defaultState, ...saved, memory: { ...defaultState.memory, ...saved?.memory }, progress: { ...defaultState.progress, ...saved?.progress } });
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem("fluentflow-state", JSON.stringify({
    activeTopic: state.activeTopic,
    autoListening: state.autoListening,
    soundOn: state.soundOn,
    onboarded: state.onboarded,
    preferredEngine: state.preferredEngine,
    voicePermission: state.voicePermission,
    memory: state.memory,
    progress: state.progress,
    transcript: state.transcript.slice(-24)
  }));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function updateStreak() {
  const today = todayKey();
  if (state.progress.lastPracticeDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  state.progress.streak = state.progress.lastPracticeDate === yesterdayKey
    ? state.progress.streak + 1
    : 1;
  state.progress.lastPracticeDate = today;
}

function setStatus(label, live = false) {
  els.statusText.textContent = label;
  els.statusDot.classList.toggle("live", live);
}

function updateEnginePill() {
  if (!navigator.onLine) {
    els.enginePill.textContent = "Offline ready";
    return;
  }

  if (capabilities.realtimeConfigured && state.preferredEngine === "realtime") {
    els.enginePill.textContent = "Realtime voice";
    return;
  }

  els.enginePill.textContent = capabilities.textAiConfigured
    ? "Free voice + AI"
    : "Free web voice";
}

function syncNetworkState() {
  const online = navigator.onLine;
  els.networkPanel.hidden = online;
  if (!online) {
    els.networkText.textContent = "Connection is unstable. Your streak and session notes stay saved.";
    setStatus("Offline", false);
  } else if (!state.sessionActive) {
    setStatus("Ready", false);
  }
  updateEnginePill();
}

function updatePermissionPanel() {
  if (state.voicePermission === "granted") {
    els.permissionPanel.hidden = true;
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!navigator.mediaDevices?.getUserMedia && !SpeechRecognition) {
    els.permissionPanel.hidden = false;
    els.permissionText.textContent = "This browser has limited voice support. Try Chrome or Safari on mobile.";
    return;
  }

  els.permissionPanel.hidden = state.sessionActive || state.voicePermission === "prompted";
}

function renderTopics() {
  els.topicRail.innerHTML = "";
  topics.forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `topic-pill${topic === state.activeTopic ? " active" : ""}`;
    button.textContent = topic;
    button.addEventListener("click", () => selectTopic(topic));
    els.topicRail.append(button);
  });
}

async function selectTopic(topic) {
  state.activeTopic = topic;
  state.memory.favoriteTopics = [topic, ...state.memory.favoriteTopics.filter((item) => item !== topic)].slice(0, 4);
  els.modeLabel.textContent = topic;
  renderTopics();
  saveState();

  try {
    const r = await fetch("/api/topic-context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic })
    });
    const data = await r.json();
    if (data.brief && dc?.readyState === "open") {
      sendRealtimeText(`Use this topic context quietly for the next turn: ${data.brief}`);
    }
  } catch {
    // Topic context is optional; the conversation can continue without it.
  }
}

function renderProgress() {
  els.streakValue.textContent = String(state.progress.streak);
  els.minutesValue.textContent = String(state.progress.minutes);
  els.vocabValue.textContent = String(state.progress.vocabulary.length);
  els.fluencyValue.textContent = `${state.progress.fluency}%`;
  els.confidencePill.textContent = `${state.progress.confidence}%`;
}

function renderTranscript() {
  els.transcriptList.innerHTML = "";
  if (!state.transcript.length) {
    const empty = document.createElement("div");
    empty.className = "message ai";
    empty.innerHTML = "<span>Coach</span><p>Choose a topic and start speaking.</p>";
    els.transcriptList.append(empty);
    return;
  }

  state.transcript.slice(-10).forEach((message) => {
    const item = document.createElement("div");
    item.className = `message ${message.role}`;
    const role = message.role === "user" ? "You" : "FluentFlow";
    item.innerHTML = `<span>${role}</span><p></p>`;
    item.querySelector("p").textContent = message.text;
    els.transcriptList.append(item);
  });
  els.transcriptList.scrollTop = els.transcriptList.scrollHeight;
}

function renderSettings() {
  els.nameInput.value = state.memory.name || "";
  els.levelInput.value = state.memory.level || "Intermediate";
  els.goalInput.value = state.memory.goals || "";
}

function renderAll() {
  els.modeLabel.textContent = state.activeTopic;
  els.autoState.textContent = state.autoListening ? "On" : "Off";
  els.muteState.textContent = state.soundOn ? "On" : "Off";
  els.remoteAudio.muted = !state.soundOn;
  updateEnginePill();
  updatePermissionPanel();
  renderTopics();
  renderProgress();
  renderTranscript();
  renderSettings();
}

function addMessage(role, text) {
  const clean = text.trim();
  if (!clean) return;
  state.transcript.push({ role, text: clean, at: Date.now() });
  state.memory.conversationHistory = state.transcript.slice(-12);
  harvestLearningSignals(clean);
  renderTranscript();
  saveState();
}

function harvestLearningSignals(text) {
  const correctionMatch = text.match(/(?:small correction|say this|you should say|better phrasing)[:\s-]+["']?([^"'.]+(?:\.[^"']*)?)/i);
  if (correctionMatch) {
    els.correctionText.textContent = text;
    const phrase = correctionMatch[1].replace(/[.?!]+$/, "").trim();
    if (phrase.length > 3 && !state.memory.recurringMistakes.includes(phrase)) {
      state.memory.recurringMistakes.unshift(phrase);
      state.memory.recurringMistakes = state.memory.recurringMistakes.slice(0, 8);
    }
    state.progress.confidence = Math.max(45, state.progress.confidence - 1);
  } else if (text.length > 18 && !text.startsWith("Use this topic")) {
    state.progress.confidence = Math.min(96, state.progress.confidence + 1);
  }

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 6);

  words.slice(0, 2).forEach((word) => {
    if (!state.progress.vocabulary.includes(word)) {
      state.progress.vocabulary.push(word);
    }
  });
  state.progress.vocabulary = state.progress.vocabulary.slice(-99);
  state.progress.fluency = Math.min(99, Math.round(38 + state.progress.minutes * 1.2 + state.progress.vocabulary.length * 0.45 + state.progress.streak * 2));
  renderProgress();
}

function startTimer() {
  stopTimer();
  state.startedAt = Date.now();
  timerId = window.setInterval(() => {
    const seconds = state.elapsedSeconds + Math.floor((Date.now() - state.startedAt) / 1000);
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const rest = String(seconds % 60).padStart(2, "0");
    els.timerText.textContent = `${minutes}:${rest}`;
  }, 500);
}

function stopTimer(commit = false) {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }

  if (commit && state.startedAt) {
    const sessionSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    state.elapsedSeconds += sessionSeconds;
    const newMinutes = Math.floor(state.elapsedSeconds / 60);
    if (newMinutes > state.progress.minutes) {
      state.progress.minutes = newMinutes;
    }
    renderProgress();
    saveState();
  }
}

function setInputEnabled(enabled) {
  localStream?.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
  els.talkButton.classList.toggle("listening", enabled && state.sessionActive);
  els.listenLabel.textContent = state.sessionActive
    ? enabled ? "Listening" : "Paused"
    : "Tap to begin";
}

async function prepareAudioMeter(stream) {
  try {
    audioCtx = audioCtx || new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
  } catch {
    analyser = null;
  }
}

async function ensureVoicePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    state.voicePermission = "prompted";
    updatePermissionPanel();
    saveState();
    return true;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    state.voicePermission = "granted";
    updatePermissionPanel();
    saveState();
    return true;
  } catch (error) {
    state.voicePermission = "denied";
    els.permissionPanel.hidden = false;
    els.permissionText.textContent = "Microphone access is blocked. Enable it in your browser settings to speak.";
    setStatus("Mic blocked", false);
    saveState();
    throw error;
  }
}

async function startRealtimeSession() {
  setStatus("Connecting", true);
  els.listenLabel.textContent = "Connecting";

  const health = await fetch("/api/health").then((r) => r.json()).catch(() => ({ realtimeConfigured: false }));
  if (!health.realtimeConfigured) {
    throw new Error("Live Realtime mode is not configured");
  }

  await ensureVoicePermission();

  pc = new RTCPeerConnection();
  pc.addEventListener("connectionstatechange", () => {
    if (["failed", "disconnected"].includes(pc.connectionState)) {
      setStatus("Reconnecting", true);
      window.setTimeout(() => {
        if (state.sessionActive && pc && pc.connectionState !== "connected") {
          stopRealtimeSession();
          startBrowserVoiceSession();
        }
      }, 1400);
    }
  });
  dc = pc.createDataChannel("oai-events");
  dc.addEventListener("open", () => {
    setStatus("Live coaching", true);
    sendRealtimeText(`Start a ${state.activeTopic} conversation. Greet ${state.memory.name || "me"} naturally and ask one concise question.`);
  });
  dc.addEventListener("message", handleRealtimeEvent);

  pc.addEventListener("track", (event) => {
    els.remoteAudio.srcObject = event.streams[0];
  });

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  await prepareAudioMeter(localStream);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const response = await fetch("/api/realtime/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sdp: offer.sdp,
      topic: state.activeTopic,
      memory: state.memory
    })
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json()).error;
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || "Realtime session unavailable");
  }

  await pc.setRemoteDescription({
    type: "answer",
    sdp: await response.text()
  });

  state.sessionActive = true;
  updateStreak();
  startTimer();
  setInputEnabled(state.autoListening);
  renderProgress();
  saveState();
}

function sendRealtimeText(text) {
  if (dc?.readyState !== "open") return;
  dc.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }]
    }
  }));
  dc.send(JSON.stringify({ type: "response.create" }));
}

function handleRealtimeEvent(event) {
  let data;
  try {
    data = JSON.parse(event.data);
  } catch {
    return;
  }

  if (data.type === "conversation.item.input_audio_transcription.completed" && data.transcript) {
    addMessage("user", data.transcript);
  }

  if (data.type === "response.audio_transcript.done" && data.transcript) {
    addMessage("ai", data.transcript);
  }

  if (data.type === "input_audio_buffer.speech_started") {
    els.listenLabel.textContent = "Listening";
  }

  if (data.type === "response.audio.done") {
    els.listenLabel.textContent = state.autoListening ? "Listening" : "Hold to talk";
  }
}

function stopRealtimeSession() {
  stopTimer(true);
  dc?.close();
  pc?.close();
  localStream?.getTracks().forEach((track) => track.stop());
  pc = null;
  dc = null;
  localStream = null;
  state.sessionActive = false;
  setInputEnabled(false);
  setStatus("Ready", false);
  saveState();
}

async function startBrowserVoiceSession() {
  await ensureVoicePermission();
  state.sessionActive = true;
  updateStreak();
  startTimer();
  setStatus("Voice coaching", true);
  els.listenLabel.textContent = state.autoListening ? "Listening" : "Hold to talk";
  updateEnginePill();
  addMessage("ai", `Let's talk about ${state.activeTopic}. Tell me one thought in English, and I will keep it smooth.`);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    demoRecognition = new SpeechRecognition();
    demoRecognition.lang = "en-US";
    demoRecognition.interimResults = false;
    demoRecognition.continuous = state.autoListening;
    demoRecognition.onresult = async (event) => {
  const text = event.results[event.results.length - 1][0].transcript?.trim();

  if (!text || text.length < 2) return;

  demoRecognition.stop();

  addMessage("user", text);

  setStatus("Thinking...", true);

  await coachReply(text);

  setTimeout(() => {
    if (state.sessionActive && state.autoListening) {
      demoRecognition.start();
    }
  }, 600);
};
    demoRecognition.onerror = () => {
      if (state.sessionActive) {
        setStatus(navigator.onLine ? "Voice paused" : "Offline", false);
      }
    };
    demoRecognition.onend = () => {
      if (state.sessionActive && state.autoListening) demoRecognition.start();
    };
    demoRecognition.start();
  } else {
    coachReply("I go yesterday to market.");
  }

  renderProgress();
  saveState();
}

function stopBrowserVoiceSession() {
  stopTimer(true);
  demoRecognition?.stop();
  demoRecognition = null;
  state.sessionActive = false;
  setStatus("Ready", false);
  els.listenLabel.textContent = "Tap to begin";
  saveState();
}

async function coachReply(text) {
  setStatus("Thinking", true);
  const reply = await fetchCoachReply(text);
  window.setTimeout(() => {
    addMessage("ai", reply);
    setStatus("Voice coaching", true);
    els.listenLabel.textContent = state.autoListening ? "Listening" : "Hold to talk";
    if (state.soundOn && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.rate = 0.94;
      utterance.pitch = 0.88;
      speechSynthesis.speak(utterance);
    }
  }, 450);
}

async function fetchCoachReply(text) {
  if (!navigator.onLine) return gentleCorrection(text) || "You are offline, but your session is saved. Keep one sentence ready for when connection returns.";

  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        topic: state.activeTopic,
        memory: state.memory,
        recent: state.transcript.slice(-8)
      })
    });
    const data = await response.json();
    return data.reply || gentleCorrection(text) || `Good. Keep going. What makes ${state.activeTopic.toLowerCase()} interesting to you right now?`;
  } catch {
    return gentleCorrection(text) || `Good. Keep going. What makes ${state.activeTopic.toLowerCase()} interesting to you right now?`;
  }
}

function gentleCorrection(text) {
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
  return "";
}

async function toggleSession() {
  if (state.sessionActive) {
    if (pc) stopRealtimeSession();
    else stopBrowserVoiceSession();
    return;
  }

  if (capabilities.realtimeConfigured && state.preferredEngine === "realtime") {
    try {
      await startRealtimeSession();
      return;
    } catch (error) {
      console.warn(error);
      setStatus("Fallback voice", true);
    }
  }

  try {
    await startBrowserVoiceSession();
  } catch (error) {
    console.warn(error);
    stopTimer(true);
    state.sessionActive = false;
    setStatus("Ready", false);
    els.listenLabel.textContent = "Tap to begin";
  }
}

function toggleAuto() {
  state.autoListening = !state.autoListening;
  els.autoState.textContent = state.autoListening ? "On" : "Off";
  if (demoRecognition) {
    demoRecognition.continuous = state.autoListening;
  }
  setInputEnabled(state.sessionActive && state.autoListening);
  saveState();
}

function setupInteractions() {
  els.talkButton.addEventListener("click", toggleSession);
  els.permissionButton.addEventListener("click", async () => {
    try {
      await ensureVoicePermission();
      setStatus("Ready", false);
    } catch {
      // The permission panel already explains the state.
    }
  });
  els.autoButton.addEventListener("click", toggleAuto);
  els.muteButton.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    els.muteState.textContent = state.soundOn ? "On" : "Off";
    els.remoteAudio.muted = !state.soundOn;
    saveState();
  });

  ["pointerdown", "touchstart"].forEach((type) => {
    els.talkButton.addEventListener(type, () => {
      if (state.sessionActive && !state.autoListening) setInputEnabled(true);
    }, { passive: true });
  });

  ["pointerup", "pointercancel", "touchend"].forEach((type) => {
    els.talkButton.addEventListener(type, () => {
      if (state.sessionActive && !state.autoListening) setInputEnabled(false);
    }, { passive: true });
  });

  els.clearButton.addEventListener("click", () => {
    state.transcript = [];
    renderTranscript();
    saveState();
  });

  els.settingsButton.addEventListener("click", () => {
    els.settingsSheet.classList.add("open");
    els.settingsSheet.setAttribute("aria-hidden", "false");
  });

  els.closeSettings.addEventListener("click", closeSettings);
  els.settingsSheet.addEventListener("click", (event) => {
    if (event.target === els.settingsSheet) closeSettings();
  });

  els.saveSettings.addEventListener("click", () => {
    state.memory.name = els.nameInput.value.trim();
    state.memory.level = els.levelInput.value;
    state.memory.goals = els.goalInput.value.trim();
    saveState();
    closeSettings();
  });

  els.startOnboarding.addEventListener("click", async () => {
    state.onboarded = true;
    saveState();
    closeOnboarding();
    try {
      await ensureVoicePermission();
    } catch {
      // Permission can be restored from browser settings.
    }
  });

  els.skipOnboarding.addEventListener("click", () => {
    state.onboarded = true;
    saveState();
    closeOnboarding();
  });

  els.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });

  window.addEventListener("online", syncNetworkState);
  window.addEventListener("offline", syncNetworkState);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });
}

function closeSettings() {
  els.settingsSheet.classList.remove("open");
  els.settingsSheet.setAttribute("aria-hidden", "true");
}

function openOnboarding() {
  els.onboardingSheet.classList.add("open");
  els.onboardingSheet.setAttribute("aria-hidden", "false");
}

function closeOnboarding() {
  els.onboardingSheet.classList.remove("open");
  els.onboardingSheet.setAttribute("aria-hidden", "true");
}

function drawOrb() {
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const now = performance.now() / 1000;

  if (analyser) {
    analyser.getByteFrequencyData(audioData);
    const sum = audioData.reduce((total, value) => total + value, 0) / audioData.length;
    speakingEnergy = speakingEnergy * 0.82 + (sum / 255) * 0.18;
  } else {
    speakingEnergy = speakingEnergy * 0.94 + (state.sessionActive ? 0.17 : 0.04) * 0.06;
  }

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(cx, cy, 18, cx, cy, 238);
  gradient.addColorStop(0, "rgba(244, 251, 247, 0.92)");
  gradient.addColorStop(0.2, "rgba(61, 242, 161, 0.72)");
  gradient.addColorStop(0.62, "rgba(15, 171, 115, 0.16)");
  gradient.addColorStop(1, "rgba(5, 7, 6, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 230, 0, Math.PI * 2);
  ctx.fill();

  for (let ring = 0; ring < 4; ring += 1) {
    const radius = 130 + ring * 24 + speakingEnergy * 42 + Math.sin(now * 1.4 + ring) * 5;
    ctx.beginPath();
    for (let i = 0; i <= 220; i += 1) {
      const angle = (i / 220) * Math.PI * 2;
      const wave = Math.sin(angle * (3 + ring) + now * (1.1 + ring * 0.18)) * (6 + speakingEnergy * 25);
      const r = radius + wave;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(61, 242, 161, ${0.25 - ring * 0.035})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 94 + speakingEnergy * 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(7, 17, 13, 0.74)";
  ctx.fill();
  ctx.strokeStyle = state.sessionActive ? "rgba(61, 242, 161, 0.72)" : "rgba(244, 251, 247, 0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();

  animationId = requestAnimationFrame(drawOrb);
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch {
      // PWA install support is a progressive enhancement.
    }
  }
}

async function loadCapabilities() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    capabilities = { ...capabilities, ...(await response.json()) };
  } catch {
    capabilities = { ...capabilities, freeBrowserVoice: true };
  }

  if (!capabilities.realtimeConfigured && state.preferredEngine === "realtime") {
    state.preferredEngine = "browser";
  }
  updateEnginePill();
}

function finishBoot() {
  window.setTimeout(() => {
    els.bootSplash?.classList.add("done");
  }, 320);
}

async function initApp() {
  renderAll();
  setupInteractions();
  drawOrb();
  syncNetworkState();
  await loadCapabilities();
  await registerServiceWorker();
  if (!state.onboarded) openOnboarding();
  finishBoot();
}

window.addEventListener("beforeunload", () => {
  if (state.sessionActive) {
    stopTimer(true);
  }
});

initApp();
