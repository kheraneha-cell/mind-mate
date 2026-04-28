const STORAGE_KEY = "mind-mate-v1";
const CATEGORY_COLORS = { Positive: "#3fa96b", Negative: "#d66b6b", Waste: "#e0a84f", Unnecessary: "#7b8bbd" };

const contentCards = [
  "Walk barefoot for 10 minutes to release mental tension.",
  "A light dinner can improve sleep and next-day clarity.",
  "Drink water before coffee and notice your energy shift.",
  "Pause for three slow breaths before checking your phone.",
  "Write one thing you handled better than yesterday.",
  "Sunlight in the morning can support a calmer mood.",
  "Stretch your neck and shoulders when thoughts feel crowded.",
  "Name one worry and one action you can actually take.",
  "A short evening tidy can reduce mental noise.",
  "Replace one self-criticism with a fact-based statement.",
  "Take a 5-minute walk when repetitive thinking starts.",
  "Quiet music can help slow fast mental loops.",
  "Eat one mindful meal without scrolling.",
  "Notice one helpful thought you usually ignore.",
  "Text one sincere thank-you to someone today.",
  "Close your day by writing one lesson and one release.",
  "Keep your phone out of reach for your first 10 minutes.",
  "Natural light and open air can lower stress buildup.",
  "A gentle bedtime routine often supports clearer mornings.",
  "Say no once today to protect your attention."
];

const counsellors = [
  { name: "Dr. Maya Tan", title: "Counselling Psychologist", bio: "Supports emotional regulation, self-esteem, and thought reframing.", contact: "maya.tan@example.com" },
  { name: "Arjun Lee", title: "Mindfulness Coach", bio: "Focuses on stress reduction, awareness habits, and daily consistency.", contact: "Coming soon" },
  { name: "Sarah Lim", title: "Youth & Family Therapist", bio: "Helps with anxiety, communication patterns, and mindset tools.", contact: "sarah.lim@example.com" }
];

const state = loadState();
let selectedJourneyDay = "";
const els = {
  screens: [...document.querySelectorAll(".screen")],
  nav: document.getElementById("bottomNav"),
  navItems: [...document.querySelectorAll(".nav-item")],
  logoutBtn: document.getElementById("logoutBtn"),
  loginForm: document.getElementById("loginForm"),
  goalForm: document.getElementById("goalForm"),
  thoughtForm: document.getElementById("thoughtForm"),
  communityForm: document.getElementById("communityForm"),
  quickLogBtn: document.getElementById("quickLogBtn"),
  goalEditBtn: document.getElementById("goalEditBtn"),
  sampleDataBtn: document.getElementById("sampleDataBtn"),
  notificationToggle: document.getElementById("notificationToggle"),
  notificationStatus: document.getElementById("notificationStatus"),
  thoughtText: document.getElementById("thoughtText"),
  imageInput: document.getElementById("imageInput"),
  imagePreviewWrap: document.getElementById("imagePreviewWrap"),
  imagePreview: document.getElementById("imagePreview"),
  ocrStatus: document.getElementById("ocrStatus"),
  categoryOverride: document.getElementById("categoryOverride"),
  recentThoughts: document.getElementById("recentThoughts"),
  positiveCount: document.getElementById("positiveCount"),
  negativeCount: document.getElementById("negativeCount"),
  wasteCount: document.getElementById("wasteCount"),
  unnecessaryCount: document.getElementById("unnecessaryCount"),
  dashboardEmpty: document.getElementById("dashboardEmpty"),
  dashboardContent: document.getElementById("dashboardContent"),
  pieChart: document.getElementById("pieChart"),
  chartLegend: document.getElementById("chartLegend"),
  calendarDurationLabel: document.getElementById("calendarDurationLabel"),
  dashboardDayGrid: document.getElementById("dashboardDayGrid"),
  dashboardDayDetail: document.getElementById("dashboardDayDetail"),
  meditationScript: document.getElementById("meditationScript"),
  goalProgressLabel: document.getElementById("goalProgressLabel"),
  goalProgressBar: document.getElementById("goalProgressBar"),
  dashboardInsight: document.getElementById("dashboardInsight"),
  dailyRateMetric: document.getElementById("dailyRateMetric"),
  dashboardMetric: document.getElementById("dashboardMetric"),
  completionMetric: document.getElementById("completionMetric"),
  dailyContentText: document.getElementById("dailyContentText"),
  contentDay: document.getElementById("contentDay"),
  welcomeTitle: document.getElementById("welcomeTitle"),
  journeyMeta: document.getElementById("journeyMeta"),
  communityText: document.getElementById("communityText"),
  communityImage: document.getElementById("communityImage"),
  communityFeed: document.getElementById("communityFeed"),
  counsellorList: document.getElementById("counsellorList"),
  positiveTargetInput: document.getElementById("positiveTargetInput"),
  otherTargetInput: document.getElementById("otherTargetInput"),
  durationInput: document.getElementById("durationInput"),
  contactDialog: document.getElementById("contactDialog"),
  contactText: document.getElementById("contactText"),
  closeDialogBtn: document.getElementById("closeDialogBtn")
};
let deferredInstallPrompt = null;

init();

function init() {
  attachEvents();
  renderCounsellors();
  routeInitialScreen();
  renderAll();
}

function attachEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.goalForm.addEventListener("submit", handleGoalSave);
  els.thoughtForm.addEventListener("submit", handleThoughtSave);
  els.communityForm.addEventListener("submit", handleCommunityPost);
  els.quickLogBtn.addEventListener("click", () => showScreen("logScreen"));
  els.goalEditBtn.addEventListener("click", () => showScreen("goalScreen"));
  els.sampleDataBtn.addEventListener("click", loadSampleJourney);
  document.getElementById("installBtn").addEventListener("click", handleInstallClick);
  els.imageInput.addEventListener("change", handleImageUpload);
  els.notificationToggle.addEventListener("change", handleNotificationToggle);
  els.logoutBtn.addEventListener("click", handleLogout);
  els.navItems.forEach((item) => item.addEventListener("click", () => showScreen(item.dataset.screen)));
  els.closeDialogBtn.addEventListener("click", () => els.contactDialog.close());
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleInstalled);
  unregisterServiceWorkers();
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("emailInput").value.trim();
  const name = document.getElementById("nameInput").value.trim() || "Friend";
  state.profile = { email, name };
  ensureConnectedMember(name, email);
  saveState();
  showScreen(state.goal ? "homeScreen" : "goalScreen");
  renderAll();
}

function handleGoalSave(event) {
  event.preventDefault();
  state.goal = {
    positiveTarget: Number(els.positiveTargetInput.value),
    otherTarget: Number(els.otherTargetInput.value),
    duration: Number(els.durationInput.value),
    startDate: state.goal?.startDate || todayKey()
  };
  saveState();
  showScreen("homeScreen");
  renderAll();
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const dataUrl = await fileToDataUrl(file);
  els.imagePreview.src = dataUrl;
  els.imagePreviewWrap.classList.remove("hidden");

  if (!window.Tesseract) {
    setOcrStatus("Could not read clearly, please edit manually", "warn");
    return;
  }

  setOcrStatus("Reading handwriting...", "neutral");
  try {
    const result = await window.Tesseract.recognize(file, "eng");
    const extractedText = result?.data?.text?.trim();
    if (!extractedText) throw new Error("No text extracted");
    els.thoughtText.value = extractedText;
    setOcrStatus("Text extracted. You can edit before submission.", "good");
  } catch (error) {
    setOcrStatus("Could not read clearly, please edit manually", "warn");
  }
}

function handleThoughtSave(event) {
  event.preventDefault();
  const text = els.thoughtText.value.trim();
  const image = els.imagePreview.src || "";
  if (!text && !image) {
    setOcrStatus("Add text or an image to continue.", "warn");
    return;
  }

  const repeated = state.thoughts.some((item) => item.text.trim().toLowerCase() === text.toLowerCase() && text);
  const autoCategory = classifyThought(text);
  const category = els.categoryOverride.value || autoCategory;
  state.thoughts.unshift({
    id: crypto.randomUUID(),
    text: text || "[Image note]",
    image,
    category,
    autoCategory,
    repeated,
    createdAt: new Date().toISOString()
  });
  state.metrics.logDays = uniqueLogDays(state.thoughts).length;
  saveState();

  els.thoughtForm.reset();
  els.imagePreview.src = "";
  els.imagePreviewWrap.classList.add("hidden");
  els.categoryOverride.value = "";
  setOcrStatus("Thought saved.", "good");
  showScreen("dashboardScreen");
  renderAll();
}

function handleCommunityPost(event) {
  event.preventDefault();
  const text = els.communityText.value.trim();
  if (!text) return;

  const file = els.communityImage.files?.[0];
  const pushPost = (image = "") => {
    state.community.unshift({
      id: crypto.randomUUID(),
      text,
      image,
      likes: 0,
      loves: 0,
      authorName: state.profile?.name || "Community Member",
      authorEmail: state.profile?.email || "",
      createdAt: new Date().toISOString()
    });
    saveState();
    els.communityForm.reset();
    renderCommunity();
  };

  if (file) {
    fileToDataUrl(file).then(pushPost);
  } else {
    pushPost();
  }
}

async function handleNotificationToggle(event) {
  const enabled = event.target.checked;
  state.notifications.enabled = enabled;

  if (enabled && "Notification" in window) {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      state.notifications.permission = permission;
      new Notification("Mind Mate", { body: "Morning reminder enabled. Return tonight to log your day." });
      els.notificationStatus.textContent = "Notifications enabled. Browser reminders work while the app is open.";
    } else {
      state.notifications.enabled = false;
      els.notificationToggle.checked = false;
      els.notificationStatus.textContent = "Notification permission was not granted.";
    }
  } else {
    els.notificationStatus.textContent = enabled ? "Notifications are not supported on this device." : "Notifications are off.";
  }

  saveState();
}

function handleLogout() {
  state.profile = null;
  saveState();
  showScreen("loginScreen");
  renderAll();
}

function loadSampleJourney() {
  const days = 15;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));

  state.notifications = {
    enabled: Boolean(state.notifications?.enabled),
    permission: state.notifications?.permission || "default"
  };
  state.metrics = {
    logDays: Number(state.metrics?.logDays || 0),
    dashboardViews: Number(state.metrics?.dashboardViews || 0)
  };
  state.members = Array.isArray(state.members) ? state.members : [];
  state.community = Array.isArray(state.community) ? state.community : [];
  state.thoughts = Array.isArray(state.thoughts) ? state.thoughts : [];
  state.profile = state.profile || { email: "demo@mindmate.app", name: "Demo User" };
  state.goal = {
    positiveTarget: 60,
    otherTarget: 40,
    duration: 15,
    startDate: startDate.toISOString().slice(0, 10)
  };
  state.thoughts = buildSampleThoughts(startDate);
  state.community = buildSampleCommunity(startDate);
  ensureConnectedMember(state.profile.name, state.profile.email);
  state.notifications = { enabled: true, permission: state.notifications.permission || "default" };
  state.metrics.logDays = 15;
  state.metrics.dashboardViews = 18;
  saveState();
  showScreen("dashboardScreen");
  renderAll();
  setOcrStatus("Loaded a 15-day sample journey for testing.", "good");
}

function routeInitialScreen() {
  if (!state.profile) return showScreen("loginScreen");
  if (!state.goal) return showScreen("goalScreen");
  showScreen("homeScreen");
}

function showScreen(screenId) {
  els.screens.forEach((screen) => screen.classList.toggle("active", screen.id === screenId));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.screen === screenId));
  if (screenId === "dashboardScreen") {
    state.metrics.dashboardViews += 1;
    saveState();
  }
}

function renderAll() {
  els.logoutBtn.classList.toggle("hidden", !state.profile);
  els.nav.classList.toggle("hidden", !state.profile || !state.goal);
  updateInstallButton();
  renderGoalForm();
  renderHome();
  renderThoughts();
  renderDashboard();
  renderCommunity();
}

function renderGoalForm() {
  els.positiveTargetInput.value = state.goal?.positiveTarget ?? 60;
  els.otherTargetInput.value = state.goal?.otherTarget ?? 40;
  els.durationInput.value = String(state.goal?.duration ?? 15);
}

function renderHome() {
  const name = state.profile?.name || "Friend";
  const day = currentJourneyDay();
  const duration = state.goal?.duration ?? 15;
  const usage = calculateMetrics();

  els.welcomeTitle.textContent = `Welcome, ${name}`;
  els.journeyMeta.textContent = state.goal ? `Day ${Math.min(day, duration)} of ${duration}. Keep it simple and honest.` : "Set a goal to start your journey.";
  els.contentDay.textContent = `Day ${Math.min(day, contentCards.length)}`;
  els.dailyContentText.textContent = contentCards[(Math.max(day, 1) - 1) % contentCards.length];
  els.dailyRateMetric.textContent = `${usage.dailyLoggingRate}%`;
  els.dashboardMetric.textContent = `${usage.dashboardUsage}%`;
  els.completionMetric.textContent = `Day ${Math.min(day, duration)}`;
  els.notificationToggle.checked = Boolean(state.notifications.enabled);
  els.notificationStatus.textContent = state.notifications.enabled ? "Morning and evening reminders are ready when supported." : "Notifications are off.";
}

function renderThoughts() {
  if (!state.thoughts.length) {
    els.recentThoughts.className = "list-block empty-state";
    els.recentThoughts.textContent = "Start logging your thoughts";
    return;
  }

  els.recentThoughts.className = "list-block";
  els.recentThoughts.innerHTML = state.thoughts.slice(0, 5).map((thought) => `
    <article class="thought-row">
      <div class="thought-meta">
        <span>${formatDate(thought.createdAt)}</span>
        <span class="badge ${thought.category}">${thought.category}</span>
      </div>
      <p>${escapeHtml(thought.text)}</p>
      ${thought.repeated ? '<span class="badge repeat">Repetitive</span>' : ""}
    </article>
  `).join("");
}

function renderDashboard() {
  if (!state.thoughts.length) {
    els.dashboardEmpty.classList.remove("hidden");
    els.dashboardContent.classList.add("hidden");
    return;
  }

  els.dashboardEmpty.classList.add("hidden");
  els.dashboardContent.classList.remove("hidden");

  const counts = countByCategory(state.thoughts);
  const total = state.thoughts.length;
  const positivePercent = Math.round((counts.Positive / total) * 100);
  const goalTarget = state.goal?.positiveTarget ?? 60;

  els.positiveCount.textContent = counts.Positive;
  els.negativeCount.textContent = counts.Negative;
  els.wasteCount.textContent = counts.Waste;
  els.unnecessaryCount.textContent = counts.Unnecessary;
  els.goalProgressLabel.textContent = `${positivePercent}% vs ${goalTarget}% target`;
  els.goalProgressBar.style.width = `${Math.min(positivePercent, 100)}%`;
  els.dashboardInsight.textContent = generateInsight(counts, total);

  drawPieChart(counts);
  els.chartLegend.innerHTML = Object.entries(counts).map(([category, count]) => `
    <div class="legend-row">
      <span class="legend-key"><span class="legend-dot" style="background:${CATEGORY_COLORS[category]}"></span>${category}</span>
      <strong>${Math.round((count / total) * 100)}%</strong>
    </div>
  `).join("");

  renderJourneyCalendar();
  renderMeditationScript();
}

function renderCommunity() {
  if (!state.community.length) {
    els.communityFeed.className = "list-block empty-state";
    els.communityFeed.textContent = "No posts yet. Share a gentle win.";
    return;
  }

  els.communityFeed.className = "list-block";
  els.communityFeed.innerHTML = state.community.map((post) => `
    <article class="post-card">
      <div class="post-meta">
        <span class="member-tag">${escapeHtml(post.authorName || "Community Member")} - Connected</span>
        <span>${formatDate(post.createdAt)}</span>
      </div>
      <p>${escapeHtml(post.text)}</p>
      ${post.image ? `<img src="${post.image}" alt="Community post image">` : ""}
      <div class="reaction-row">
        <button class="like-button" type="button" data-like-id="${post.id}" aria-label="Like post">👍 ${post.likes || 0}</button>
        <button class="like-button love" type="button" data-love-id="${post.id}" aria-label="Love post">❤ ${post.loves || 0}</button>
      </div>
    </article>
  `).join("");

  els.communityFeed.querySelectorAll("[data-like-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const post = state.community.find((item) => item.id === button.dataset.likeId);
      if (!post) return;
      post.likes += 1;
      saveState();
      renderCommunity();
    });
  });
  els.communityFeed.querySelectorAll("[data-love-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const post = state.community.find((item) => item.id === button.dataset.loveId);
      if (!post) return;
      post.loves = (post.loves || 0) + 1;
      saveState();
      renderCommunity();
    });
  });
}

function renderCounsellors() {
  els.counsellorList.innerHTML = counsellors.map((person, index) => `
    <article class="counsellor-card">
      <div>
        <h3>${person.name}</h3>
        <p><strong>${person.title}</strong></p>
        <p class="supporting">${person.bio}</p>
      </div>
      <button class="ghost-button" type="button" data-contact-index="${index}">Contact</button>
    </article>
  `).join("");

  els.counsellorList.querySelectorAll("[data-contact-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const person = counsellors[Number(button.dataset.contactIndex)];
      els.contactText.textContent = person.contact === "Coming soon" ? "Coming soon" : `Email ${person.name} at ${person.contact}`;
      els.contactDialog.showModal();
    });
  });
}

function buildJourneySummary() {
  const sorted = [...state.thoughts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const midpoint = Math.max(1, Math.floor(sorted.length / 2));
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);
  const repetitiveCount = sorted.filter((item) => item.repeated).length;
  const topNonPositive = topCategory(sorted.filter((item) => item.category !== "Positive"));
  const firstNegative = percentage(firstHalf, "Negative");
  const secondNegative = percentage(secondHalf, "Negative");

  return [
    `You completed a ${state.goal.duration}-day reflection journey with ${sorted.length} logged thoughts.`,
    `Negative thoughts moved from ${firstNegative}% early on to ${secondNegative}% later in the journey.`,
    `Repetitive thoughts appeared ${repetitiveCount} time${repetitiveCount === 1 ? "" : "s"}, showing where your mind loops.`,
    topNonPositive ? `Your strongest growth edge is reducing ${topNonPositive.toLowerCase()} thoughts with one small daily interruption.` : "Positive thoughts stayed steady and supportive across the journey.",
    "You improved your thought awareness. Keep consistency gentle and focus on one practical shift at a time."
  ];
}

function buildSampleThoughts(startDate) {
  const journal = [
    ["I feel worried I might fail this week.", "I kept checking traffic updates for no reason.", "I still showed up and completed one useful task."],
    ["I can't handle everything perfectly.", "I spent too long on scroll breaks today.", "I finished the hardest task before lunch."],
    ["I am anxious about others opinion in the meeting.", "Weather might ruin the whole day.", "I paused and answered calmly anyway."],
    ["I kept thinking I might fail again.", "I wasted time on gossip during lunch.", "I noticed the pattern earlier today."],
    ["Traffic always ruins my mood.", "I am worried I am behind everyone else.", "A short walk helped me reset."],
    ["I doomscroll when I feel stressed.", "I can't get this wrong.", "I asked for help instead of spiraling."],
    ["Others opinion keeps sitting in my head.", "I am afraid I am not improving fast enough.", "I completed my journal before bed."],
    ["I felt stress rise, but I breathed through it.", "I avoided a long scroll session.", "One kind thought stayed with me today."],
    ["I started the day calmer and more focused.", "Traffic was there, but I did not carry it all day.", "I finished what mattered first."],
    ["I noticed the worried thought and let it pass.", "I kept my phone away during dinner.", "My energy was lighter this evening."],
    ["I handled a tense moment better than last week.", "I returned from a scroll urge quickly.", "I am building trust in myself."],
    ["I chose action instead of repeating fear.", "The meeting went better than I expected.", "I wrote down one honest win tonight."],
    ["I can improve without being perfect.", "I felt more present with my family.", "My mind looped less today."],
    ["I stayed steady even when stress showed up.", "I redirected a waste thought into a walk.", "I felt proud of my consistency."],
    ["I trust myself more than I did two weeks ago.", "I am able to reset faster now.", "Today felt clearer and kinder overall."]
  ];

  return journal.flatMap((entries, dayIndex) => entries.map((text, entryIndex) => {
    const created = new Date(startDate);
    created.setDate(startDate.getDate() + dayIndex);
    created.setHours(8 + entryIndex * 5, 15, 0, 0);
    const autoCategory = classifyThought(text);

    return {
      id: `${dayIndex + 1}-${entryIndex + 1}`,
      text,
      image: "",
      category: autoCategory,
      autoCategory,
      repeated: isSampleRepeated(text, dayIndex),
      createdAt: created.toISOString()
    };
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function buildSampleCommunity(startDate) {
  const posts = [
    ["Day 3 and I noticed my thoughts slow down when I walk without my phone.", "Nina"],
    ["Logging honestly for 10 minutes is helping more than I expected.", "Arjun"],
    ["Today I caught a repetitive worry before it took over the evening.", "Maya"],
    ["Small win: less scrolling, more breathing.", "Sara"]
  ];

  state.members = [
    { id: "m1", name: "Nina", email: "nina@example.com", connectedAt: startDate.toISOString() },
    { id: "m2", name: "Arjun", email: "arjun@example.com", connectedAt: startDate.toISOString() },
    { id: "m3", name: "Maya", email: "maya@example.com", connectedAt: startDate.toISOString() },
    { id: "m4", name: "Sara", email: "sara@example.com", connectedAt: startDate.toISOString() },
    { id: "m5", name: state.profile?.name || "Demo User", email: state.profile?.email || "demo@mindmate.app", connectedAt: startDate.toISOString() }
  ];

  return posts.map(([text, authorName], index) => {
    const created = new Date(startDate);
    created.setDate(startDate.getDate() + index * 4);
    created.setHours(19, 0, 0, 0);
    return {
      id: `community-${index + 1}`,
      text,
      image: "",
      likes: 3 + index * 2,
      loves: 1 + index,
      authorName,
      authorEmail: `${authorName.toLowerCase()}@example.com`,
      createdAt: created.toISOString()
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function isSampleRepeated(text, dayIndex) {
  const repeatedThoughts = [
    "I feel worried I might fail this week.",
    "I kept thinking I might fail again.",
    "Traffic always ruins my mood.",
    "Others opinion keeps sitting in my head."
  ];
  return dayIndex < 7 && repeatedThoughts.includes(text);
}

function calculateMetrics() {
  const duration = state.goal?.duration ?? 15;
  const day = currentJourneyDay();
  return {
    dailyLoggingRate: Math.min(100, Math.round((state.metrics.logDays / Math.max(1, Math.min(day, duration))) * 100)),
    dashboardUsage: Math.min(100, Math.round((state.metrics.dashboardViews / Math.max(1, state.metrics.logDays)) * 100))
  };
}

function renderJourneyCalendar() {
  const groupedDays = buildJourneyDays();
  const duration = state.goal?.duration ?? 15;
  els.calendarDurationLabel.textContent = `${duration} days`;

  if (!groupedDays.length) {
    els.dashboardDayGrid.innerHTML = "<p class='empty-state'>No journey data yet.</p>";
    els.dashboardDayDetail.innerHTML = "<p class='empty-state'>Log a thought to see day details.</p>";
    return;
  }

  if (!selectedJourneyDay || !groupedDays.some((day) => day.key === selectedJourneyDay)) {
    selectedJourneyDay = groupedDays[groupedDays.length - 1].key;
  }

  els.dashboardDayGrid.innerHTML = groupedDays.map((day, index) => `
    <button class="calendar-day ${day.tone} ${day.key === selectedJourneyDay ? "active" : ""}" type="button" data-day-key="${day.key}">
      <span>${index + 1}</span>
      <small>${day.total} thought${day.total === 1 ? "" : "s"}</small>
    </button>
  `).join("");

  els.dashboardDayGrid.querySelectorAll("[data-day-key]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedJourneyDay = button.dataset.dayKey;
      renderJourneyCalendar();
    });
  });

  const selectedDay = groupedDays.find((day) => day.key === selectedJourneyDay) || groupedDays[groupedDays.length - 1];
  renderJourneyDayDetail(selectedDay);
}

function renderJourneyDayDetail(day) {
  const sections = ["Negative", "Waste", "Unnecessary", "Positive"]
    .map((category) => {
      const items = day.entries.filter((entry) => entry.category === category);
      if (!items.length) return "";
      return `
        <div class="day-group">
          <p class="day-group-title">
            <span class="legend-dot" style="background:${CATEGORY_COLORS[category]}"></span>
            ${category} (${items.length})
          </p>
          ${items.map((entry) => `<div class="day-entry">${escapeHtml(entry.text)}</div>`).join("")}
        </div>
      `;
    })
    .join("");

  els.dashboardDayDetail.innerHTML = `
    <h4>${formatLongDate(day.key)}</h4>
    ${sections || "<p class='empty-state'>No thoughts logged for this day.</p>"}
  `;
}

function buildJourneyDays() {
  const duration = state.goal?.duration ?? 15;
  const startDate = state.goal?.startDate ? new Date(state.goal.startDate) : new Date();
  const map = new Map();

  state.thoughts.forEach((thought) => {
    const key = thought.createdAt.slice(0, 10);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(thought);
  });

  return Array.from({ length: duration }, (_, index) => {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + index);
    const key = dayDate.toISOString().slice(0, 10);
    const entries = (map.get(key) || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const counts = countByCategory(entries);
    return {
      key,
      entries,
      counts,
      total: entries.length,
      tone: dominantTone(counts, entries.length)
    };
  });
}

function dominantTone(counts, total) {
  if (!total) return "empty";
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function renderMeditationScript() {
  const steps = [
    "Sit comfortably and soften your shoulders. Inhale slowly for four counts and exhale for six.",
    "Notice one thought that feels heavy. Say quietly: I see this thought, and I do not need to fight it right now.",
    "Bring attention to the heart area. Breathe in steadiness, breathe out pressure.",
    "Repeat gently: I choose calm. I choose clarity. I choose one kind next thought.",
    "Before you return, set one small intention for the next hour and carry it lightly."
  ];

  els.meditationScript.innerHTML = steps.map((step, index) => `
    <div class="meditation-step"><strong>${index + 1}.</strong> ${step}</div>
  `).join("");
}

function classifyThought(text) {
  const lower = text.toLowerCase();
  const negativeWords = ["fail", "can't", "anxious", "worried", "afraid", "stress", "panic", "sad"];
  const wasteWords = ["scroll", "gossip", "waste time", "doomscroll", "binge"];
  const unnecessaryWords = ["weather", "traffic", "others opinion", "what people think", "others' opinion"];

  if (negativeWords.some((word) => lower.includes(word))) return "Negative";
  if (wasteWords.some((word) => lower.includes(word))) return "Waste";
  if (unnecessaryWords.some((word) => lower.includes(word))) return "Unnecessary";
  return "Positive";
}

function generateInsight(counts, total) {
  const top = Object.entries(counts)
    .map(([category, count]) => ({ category, ratio: count / total }))
    .sort((a, b) => b.ratio - a.ratio)[0];
  if (top.category === "Positive") return "Positive thoughts are leading today.";
  if (top.category === "Negative") return "High negative thoughts today.";
  if (top.category === "Waste") return "Waste thoughts are taking more space today.";
  return "Unnecessary thoughts are showing up often today.";
}

function drawPieChart(counts) {
  const ctx = els.pieChart.getContext("2d");
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  ctx.clearRect(0, 0, els.pieChart.width, els.pieChart.height);

  let startAngle = -Math.PI / 2;
  Object.entries(counts).forEach(([category, count]) => {
    const sliceAngle = total ? (count / total) * Math.PI * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(110, 110);
    ctx.arc(110, 110, 90, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CATEGORY_COLORS[category];
    ctx.fill();
    startAngle += sliceAngle;
  });

  ctx.beginPath();
  ctx.arc(110, 110, 42, 0, Math.PI * 2);
  ctx.fillStyle = "#f7fbf5";
  ctx.fill();

  ctx.fillStyle = "#193126";
  ctx.font = "700 16px DM Sans";
  ctx.textAlign = "center";
  ctx.fillText(`${total}`, 110, 106);
  ctx.font = "500 12px DM Sans";
  ctx.fillText("thoughts", 110, 124);
}

function drawSummaryChart(counts, total) {
  const canvas = document.getElementById("summaryChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let startAngle = -Math.PI / 2;
  Object.entries(counts).forEach(([category, count]) => {
    const sliceAngle = total ? (count / total) * Math.PI * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(110, 110);
    ctx.arc(110, 110, 92, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CATEGORY_COLORS[category];
    ctx.fill();
    startAngle += sliceAngle;
  });

  ctx.beginPath();
  ctx.arc(110, 110, 48, 0, Math.PI * 2);
  ctx.fillStyle = "#f7fbf5";
  ctx.fill();

  ctx.fillStyle = "#193126";
  ctx.font = "700 17px DM Sans";
  ctx.textAlign = "center";
  ctx.fillText(`${percentage(state.thoughts, "Positive")}%`, 110, 106);
  ctx.font = "500 11px DM Sans";
  ctx.fillText("positive", 110, 124);
}

function loadState() {
  const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  const defaults = {
    profile: null,
    goal: null,
    thoughts: [],
    community: [],
    members: [],
    notifications: { enabled: false, permission: "default" },
    metrics: { logDays: 0, dashboardViews: 0 }
  };

  if (!parsed) {
    return defaults;
  }

  return {
    ...defaults,
    ...parsed,
    thoughts: Array.isArray(parsed.thoughts) ? parsed.thoughts : [],
    community: Array.isArray(parsed.community) ? parsed.community : [],
    members: Array.isArray(parsed.members) ? parsed.members : [],
    notifications: {
      ...defaults.notifications,
      ...(parsed.notifications || {})
    },
    metrics: {
      ...defaults.metrics,
      ...(parsed.metrics || {})
    }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureConnectedMember(name, email) {
  state.members = state.members || [];
  const exists = state.members.some((member) => member.email === email || member.name === name);
  if (!exists) {
    state.members.push({
      id: crypto.randomUUID(),
      name,
      email,
      connectedAt: new Date().toISOString()
    });
  }
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
}

async function handleInstallClick() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  updateInstallButton();
}

function handleInstalled() {
  deferredInstallPrompt = null;
  updateInstallButton();
}

function updateInstallButton() {
  const installBtn = document.getElementById("installBtn");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  installBtn.classList.toggle("hidden", !deferredInstallPrompt || standalone || !state.profile || !state.goal);
}

function unregisterServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => {});
  });
}

function countByCategory(thoughts) {
  return thoughts.reduce((acc, thought) => {
    acc[thought.category] += 1;
    return acc;
  }, { Positive: 0, Negative: 0, Waste: 0, Unnecessary: 0 });
}

function percentage(thoughts, category) {
  if (!thoughts.length) return 0;
  return Math.round((thoughts.filter((item) => item.category === category).length / thoughts.length) * 100);
}

function topCategory(thoughts) {
  if (!thoughts.length) return "";
  const counts = countByCategory(thoughts);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function currentJourneyDay() {
  if (!state.goal?.startDate) return 1;
  return Math.floor((stripTime(new Date()) - stripTime(new Date(state.goal.startDate))) / 86400000) + 1;
}

function uniqueLogDays(thoughts) {
  return [...new Set(thoughts.map((thought) => thought.createdAt.slice(0, 10)))];
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDate(isoString) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(isoString));
}

function formatLongDate(dateKey) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(dateKey));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setOcrStatus(message, variant) {
  els.ocrStatus.textContent = message;
  els.ocrStatus.className = `status-banner ${variant}`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
