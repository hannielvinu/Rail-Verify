import { items, sources, verifyPurchase, reportText } from "./engine.mjs";
const $ = (id) => document.getElementById(id);
const icons = {
  shield:
    '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  chart: '<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/>',
  book: '<path d="M3 4h6c2 0 3 1 3 3v14c0-2-1-3-3-3H3V4Zm18 0h-6c-2 0-3 1-3 3v14c0-2 1-3 3-3h6V4Z"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  ticket:
    '<path d="M4 4h16v6c-4 0-4 4 0 4v6H4v-6c4 0 4-4 0-4V4Z"/><path d="M14 5v3m0 3v2m0 3v3"/>',
  meal: '<path d="M4 3v6c0 3 5 3 5 0V3M6.5 3v18M18 3c-4 4-5 10 0 10V3Zm0 10v8"/>',
  water: '<path d="M9 3h6v4l3 4v10H6V11l3-4V3Zm0 4h6M6 13h12"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 9h10M7 13h10M7 17h6"/>',
  document: '<path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6"/>',
  speaker:
    '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  pin: '<path d="M12 22s8-9 8-14a8 8 0 0 0-16 0c0 5 8 14 8 14Z"/><circle cx="12" cy="8" r="2.5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
};
function drawIcons() {
  document
    .querySelectorAll("[data-icon]")
    .forEach(
      (el) =>
        (el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[el.dataset.icon] || ""}</svg>`),
    );
}
drawIcons();
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
let lastResult = null,
  lastInput = null,
  currentReport = null,
  reportId = null,
  locationValue = null,
  currentKind = "meal",
  language = "en",
  dataset = "demo",
  adminKey = "",
  rows = [];
let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 6500);
}
async function api(path, { method = "GET", data, headers = {}, body } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : body,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return result;
}
function setKind(kind, selected) {
  currentKind = kind;
  $("meal-tab").classList.toggle("selected", kind === "meal");
  $("water-tab").classList.toggle("selected", kind === "water");
  $("meal-tab").setAttribute("aria-selected", String(kind === "meal"));
  $("water-tab").setAttribute("aria-selected", String(kind === "water"));
  $("category-field").hidden = kind !== "meal";
  $("brand-field").hidden = kind !== "water";
  $("item").innerHTML = items
    .filter((x) => x.kind === kind)
    .map((x) => `<option value="${x.id}">${escape(x.name)}</option>`)
    .join("");
  if (selected) $("item").value = selected;
}
$("meal-tab").onclick = () => setKind("meal");
$("water-tab").onclick = () => setKind("water");
setKind("meal");
$("source-link").href = sources.meal.url;
const translations = {
  en: {
    headline: "Know the price.<br><em>Enjoy the journey.</em>",
    intro:
      'Your meal. Your money. Check the published tariff<br class="desktop-only"> before deciding what to do next.',
    meals: "Train meals",
    water: "Bottled water",
    item: "What did you buy?",
    paid: "Total amount paid",
    quantity: "Quantity",
    verify: "Check the listed price",
    prepare: "Prepare a report",
    paidLabel: "YOU PAID",
    listedLabel: "LISTED TOTAL",
  },
  hi: {
    headline: "सही कीमत जानें।<br><em>सुकून से सफ़र करें।</em>",
    intro: "खाने या पानी की कीमत को प्रकाशित रेलवे दर से मिलाएँ।",
    meals: "ट्रेन का खाना",
    water: "बोतलबंद पानी",
    item: "आपने क्या खरीदा?",
    paid: "कुल भुगतान",
    quantity: "मात्रा",
    verify: "प्रकाशित कीमत जाँचें",
    prepare: "रिपोर्ट तैयार करें",
    paidLabel: "आपने दिया",
    listedLabel: "प्रकाशित कुल",
  },
  ta: {
    headline: "சரியான விலையை அறியுங்கள்.<br><em>நிம்மதியாகப் பயணியுங்கள்.</em>",
    intro:
      "உணவு அல்லது தண்ணீரின் விலையை வெளியிடப்பட்ட ரயில்வே கட்டணத்துடன் ஒப்பிடுங்கள்.",
    meals: "ரயில் உணவு",
    water: "பாட்டில் தண்ணீர்",
    item: "என்ன வாங்கினீர்கள்?",
    paid: "செலுத்திய மொத்தம்",
    quantity: "எண்ணிக்கை",
    verify: "விலையைச் சரிபார்க்கவும்",
    prepare: "அறிக்கை தயாரிக்கவும்",
    paidLabel: "செலுத்தியது",
    listedLabel: "பட்டியல் மொத்தம்",
  },
};
function localizedAnswer(r) {
  if (language === "hi")
    return r.status === "review"
      ? "इस खरीद की दर की पुष्टि करनी होगी।"
      : r.status === "above"
        ? `आपने ${r.amount} रुपये दिए। प्रकाशित कुल ${r.expected} रुपये है। अंतर ${r.difference} रुपये है।`
        : `आपने ${r.amount} रुपये दिए। यह प्रकाशित कुल ${r.expected} रुपये के भीतर है।`;
  if (language === "ta")
    return r.status === "review"
      ? "இந்தக் கொள்முதலுக்கான கட்டணத்தை உறுதிப்படுத்த வேண்டும்."
      : r.status === "above"
        ? `நீங்கள் ${r.amount} ரூபாய் செலுத்தினீர்கள். பட்டியல் மொத்தம் ${r.expected} ரூபாய். வித்தியாசம் ${r.difference} ரூபாய்.`
        : `நீங்கள் ${r.amount} ரூபாய் செலுத்தினீர்கள். பட்டியல் மொத்தம் ${r.expected} ரூபாய்க்குள் உள்ளது.`;
  return r.status === "review"
    ? r.title
    : r.status === "above"
      ? `That is ₹${r.difference} above the listed tariff.`
      : "Your payment is within the listed tariff.";
}
$("language").onchange = () => {
  language = $("language").value;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = translations[language][el.dataset.i18n];
  });
  if (lastResult) $("difference").textContent = localizedAnswer(lastResult);
};
function renderResult(result, mode = "live") {
  lastResult = result;
  $("preview-badge").textContent =
    mode === "sample"
      ? "SAMPLE PURCHASE"
      : navigator.onLine
        ? "YOUR CONFIRMED DETAILS"
        : "OFFLINE REFERENCE CHECK";
  $("sent-message").innerHTML =
    `${escape(result.itemName)}. Paid ₹${escape(result.amount)} for ${result.quantity}.<small>YOUR CONFIRMED INPUT</small>`;
  $("paid-value").textContent = `₹${result.amount}`;
  $("listed-value").textContent =
    result.expected !== undefined ? `₹${result.expected}` : "Review";
  $("answer-status").textContent =
    result.status === "above"
      ? "Above the listed tariff"
      : result.status === "within"
        ? "Within the listed tariff"
        : "Manual review needed";
  $("answer-symbol").textContent =
    result.status === "above" ? "↗" : result.status === "within" ? "✓" : "?";
  $("difference").textContent = localizedAnswer(result);
  $("answer-note").textContent = result.reason;
  $("source-link").href = result.source.url;
  $("prepare-report").disabled = false;
  $("result-disclosure").textContent =
    "This comparison uses your confirmed details. A local report is prepared only with your approval.";
}
$("check-form").onsubmit = async (event) => {
  event.preventDefault();
  $("check-error").textContent = "";
  lastInput = {
    itemId: $("item").value,
    amount: $("amount").value,
    quantity: Number($("quantity").value),
    category: $("category").value,
    brand: $("brand").value,
  };
  try {
    const result = verifyPurchase(lastInput);
    renderResult(result);
    reportId = null;
    if (!navigator.onLine)
      toast(
        "Checked against the locally stored tariff references. Confirm current prices when connected.",
      );
  } catch (error) {
    $("check-error").textContent = error.message;
  }
};
$("sample-example").onclick = () => {
  setKind("meal", "veg-meal");
  $("amount").value = "150";
  $("quantity").value = "1";
  $("category").value = "mail-express";
  $("check-form").requestSubmit();
};
$("bill-file").onchange = async () => {
  const file = $("bill-file").files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast("Choose an image under 5 MB.");
    return;
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    toast("Choose a JPG, PNG or WebP image.");
    return;
  }
  if (!navigator.onLine) {
    toast(
      "Bill scanning needs the local server connection. You can enter the purchase details offline.",
    );
    return;
  }
  $("upload-title").textContent = "Reading your bill…";
  $("scan-note").textContent =
    "The image is processed for OCR and is not retained in the reports database.";
  $("bill-file").disabled = true;
  try {
    const result = await api("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (result.itemId) {
      const item = items.find((x) => x.id === result.itemId);
      setKind(item.kind, item.id);
    }
    if (result.amount) $("amount").value = String(result.amount);
    $("ocr-text").textContent = result.text;
    $("ocr-details").hidden = false;
    $("scan-note").textContent =
      "Bill text extracted. Confirm the item, amount, quantity and service before checking.";
    toast("Bill scanned. Please confirm the suggested details.");
  } catch (error) {
    $("scan-note").textContent = error.message;
    toast(error.message);
  } finally {
    $("upload-title").textContent = "Upload a bill photo";
    $("bill-file").disabled = false;
    $("bill-file").value = "";
  }
};
$("read-answer").onclick = () => {
  if (!("speechSynthesis" in window)) {
    toast("This browser does not support spoken answers.");
    return;
  }
  const r =
    lastResult ||
    verifyPurchase({
      itemId: "veg-meal",
      amount: 150,
      quantity: 1,
      category: "mail-express",
      brand: "rail-neer",
    });
  const lang = { en: "en-IN", hi: "hi-IN", ta: "ta-IN" }[language];
  const voices = speechSynthesis.getVoices();
  const voice =
    voices.find((x) => x.lang === lang) ||
    voices.find((x) => x.lang.startsWith(lang.slice(0, 2)));
  if (!voice) {
    toast(
      "A voice for this language is not installed on this device. The text answer remains available.",
    );
    return;
  }
  speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(
    language === "en"
      ? `${r.itemName}. You paid ${r.amount} rupees. ${localizedAnswer(r)}`
      : localizedAnswer(r),
  );
  speech.lang = lang;
  speech.voice = voice;
  speech.rate = 0.92;
  speechSynthesis.speak(speech);
};
$("prepare-report").onclick = () => {
  if (!lastResult) return;
  currentReport = null;
  locationValue = null;
  reportId ??= crypto.randomUUID();
  $("report-form").reset();
  $("report-form").hidden = false;
  $("report-success").hidden = true;
  $("location-state").textContent = "";
  $("report-error").textContent = "";
  $("report-dialog").showModal();
};
$("close-report").onclick = () => $("report-dialog").close();
$("add-location").onclick = () => {
  if (!navigator.geolocation) {
    toast("Location is unavailable. You can continue without it.");
    return;
  }
  $("location-state").textContent = "Waiting for your location permission…";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locationValue = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      $("location-state").textContent =
        `Location added. Accuracy about ${Math.round(locationValue.accuracy)} m. It will be included only when you approve the report.`;
    },
    () => {
      $("location-state").textContent =
        "Location was not shared. You can continue without it.";
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
};
function queue() {
  try {
    return JSON.parse(localStorage.getItem("railverify-queue") || "[]");
  } catch {
    return [];
  }
}
function saveQueue(list) {
  localStorage.setItem("railverify-queue", JSON.stringify(list));
  updateQueue();
}
function updateQueue() {
  $("queue-state").hidden = queue().length === 0;
  $("sync-queue").textContent =
    `Sync ${queue().length} saved report${queue().length === 1 ? "" : "s"}`;
}
function showSaved(report, offline) {
  currentReport = report;
  $("report-form").hidden = true;
  $("report-success").hidden = false;
  $("report-success-title").textContent = offline
    ? "Saved on this device"
    : "Your report is prepared";
  $("report-success-copy").textContent = offline
    ? "Your report will sync when a connection returns. It has not been officially filed."
    : "Your local evidence summary is ready. Complete the official RailMadad process to lodge a grievance.";
  $("report-reference").textContent = report.id;
  $("open-railmadad").href = sources.complaint.url;
  reportId = null;
}
$("report-form").onsubmit = async (event) => {
  event.preventDefault();
  if (!lastInput) return;
  const input = {
    ...lastInput,
    id: reportId || crypto.randomUUID(),
    trainNumber: $("train-number").value.trim(),
    vendorId: $("vendor-id").value.trim(),
    description: $("report-description").value.trim(),
    consent: $("consent").checked,
    location: locationValue,
  };
  $("save-report").disabled = true;
  $("report-error").textContent = "";
  try {
    if (!navigator.onLine) throw new TypeError("Offline");
    const report = await api("/api/reports", { method: "POST", data: input });
    showSaved(report, false);
  } catch (error) {
    if (error instanceof TypeError) {
      const pending = queue();
      if (!pending.some((x) => x.id === input.id)) pending.push(input);
      saveQueue(pending);
      showSaved(
        {
          id: input.id,
          trainNumber: input.trainNumber,
          vendorId: input.vendorId,
          description: input.description,
          location: input.location,
          verification: verifyPurchase(input),
          createdAt: new Date().toISOString(),
          officiallyFiled: false,
        },
        true,
      );
    } else $("report-error").textContent = error.message;
  } finally {
    $("save-report").disabled = false;
  }
};
let syncing = false;
async function syncQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  const pending = queue();
  const retained = [];
  for (const report of pending) {
    try {
      await api("/api/reports", { method: "POST", data: report });
    } catch {
      retained.push(report);
    }
  }
  const attempted = new Set(pending.map((x) => x.id));
  const added = queue().filter((x) => !attempted.has(x.id));
  saveQueue([...retained, ...added]);
  syncing = false;
  if (pending.length > retained.length)
    toast(
      `${pending.length - retained.length} local report(s) synced. Official filing remains a separate step.`,
    );
  if (retained.length)
    toast(
      "Some saved reports could not sync. Retry when connected or discard them.",
    );
}
$("sync-queue").onclick = syncQueue;
$("clear-queue").onclick = () => {
  saveQueue([]);
  toast("Saved report drafts removed from this device.");
};
function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("download-report").onclick = () => {
  if (currentReport)
    download(`RailVerify-${currentReport.id}.txt`, reportText(currentReport));
};
const demoRows = Array.from({ length: 24 }, (_, i) => {
  const item = items[i % 3 === 0 ? 5 : 0];
  const amount = item.rate + (i % 4 === 0 ? 0 : item.kind === "water" ? 6 : 70);
  return {
    id: `DEMO-${String(i + 1).padStart(3, "0")}`,
    trainNumber: ["12622", "12621", "12623", "12624", "12625"][i % 5],
    vendorId: `DEMO-V${(i % 4) + 1}`,
    verification: verifyPurchase({
      itemId: item.id,
      amount,
      quantity: 1,
      category: "mail-express",
      brand: "rail-neer",
    }),
    createdAt: new Date(Date.UTC(2026, 10, 1 + (i % 7))).toISOString(),
    status: "prepared",
    officiallyFiled: false,
  };
});
function filteredRows() {
  const query = $("report-search").value.trim().toLowerCase(),
    status = $("report-status").value;
  return rows.filter(
    (r) =>
      (!query ||
        `${r.trainNumber} ${r.vendorId}`.toLowerCase().includes(query)) &&
      (status === "all" || r.verification.status === status),
  );
}
function renderDashboard() {
  const view = filteredRows();
  $("metric-reports").textContent = view.length;
  $("metric-above").textContent = view.filter(
    (r) => r.verification.status === "above",
  ).length;
  $("metric-value").textContent =
    `₹${view.reduce((sum, r) => sum + Math.max(0, r.verification.difference || 0), 0).toLocaleString("en-IN")}`;
  const counts = new Map();
  view.forEach((r) =>
    counts.set(r.trainNumber, (counts.get(r.trainNumber) || 0) + 1),
  );
  const trains = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = Math.max(...trains.map((x) => x[1]), 1);
  $("train-bars").innerHTML =
    trains
      .map(
        ([train, count]) =>
          `<div class="train-bar"><span>${escape(train)}</span><div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div><strong>${count}</strong></div>`,
      )
      .join("") || '<p class="empty-state">No train patterns to show yet.</p>';
  $("reports-body").innerHTML = view
    .map(
      (r) =>
        `<tr><td><strong>${escape(r.trainNumber)}</strong><small>${escape(r.vendorId || "Vendor reference not supplied")}</small></td><td>${escape(r.verification.itemName)}<small>${new Date(r.createdAt).toLocaleDateString("en-IN")}</small></td><td>₹${r.verification.amount} / ${r.verification.expected !== undefined ? "₹" + r.verification.expected : "Review"}</td><td><span class="status-pill ${r.verification.status}">${r.verification.status === "above" ? "₹" + r.verification.difference + " above" : r.verification.status === "within" ? "Within tariff" : "Needs review"}</span></td><td><small>${escape(r.id.slice(0, 18))}</small>Prepared only</td></tr>`,
    )
    .join("");
  $("empty-reports").hidden = view.length > 0;
}
async function setDataset(value) {
  dataset = value;
  $("demo-data").classList.toggle("selected", value === "demo");
  $("local-data").classList.toggle("selected", value === "local");
  $("dataset-label").textContent =
    value === "demo"
      ? "DEMO RECORDS · NOT REAL INCIDENTS"
      : "LOCAL RECORDS · NOT OFFICIAL GRIEVANCES";
  $("admin-login").hidden = value === "demo" || !!adminKey;
  if (value === "demo") {
    rows = demoRows;
    renderDashboard();
    return;
  }
  rows = [];
  renderDashboard();
  if (adminKey) {
    try {
      const data = await api("/api/admin/reports", {
        headers: { Authorization: "Bearer " + adminKey },
      });
      rows = data.reports;
      $("admin-login").hidden = true;
      renderDashboard();
    } catch (error) {
      adminKey = "";
      $("admin-login").hidden = false;
      $("admin-error").textContent = error.message;
    }
  }
}
$("demo-data").onclick = () => setDataset("demo");
$("local-data").onclick = () => setDataset("local");
$("admin-login").onsubmit = async (event) => {
  event.preventDefault();
  $("admin-error").textContent = "";
  adminKey = $("admin-key").value;
  await setDataset("local");
};
$("report-search").oninput = renderDashboard;
$("report-status").onchange = renderDashboard;
$("export-csv").onclick = () => {
  const csvCell = (value) =>
    '"' +
    String(/^[=+@\-\t\r]/.test(String(value)) ? "'" + value : value).replaceAll(
      '"',
      '""',
    ) +
    '"';
  const data = [
    [
      "Dataset",
      "Train",
      "Vendor",
      "Item",
      "Paid",
      "Listed",
      "Comparison",
      "Local ID",
    ],
    ...filteredRows().map((r) => [
      dataset,
      r.trainNumber,
      r.vendorId,
      r.verification.itemName,
      r.verification.amount,
      r.verification.expected ?? "",
      r.verification.status,
      r.id,
    ]),
  ];
  download(
    `RailVerify-${dataset}-reports.csv`,
    data.map((row) => row.map(csvCell).join(",")).join("\r\n"),
    "text/csv",
  );
};
function route() {
  const dashboard = location.pathname === "/dashboard";
  $("passenger-page").hidden = dashboard;
  $("dashboard-page").hidden = !dashboard;
  $("breadcrumb").innerHTML = dashboard
    ? "Railway tools <span>/</span> Compliance desk"
    : "Passenger tools <span>/</span> Price check";
  document
    .querySelectorAll("[data-nav]")
    .forEach((el) =>
      el.classList.toggle(
        "active",
        el.dataset.nav === (dashboard ? "dashboard" : "check"),
      ),
    );
  if (dashboard) setDataset(dataset);
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-nav]").forEach(
  (el) =>
    (el.onclick = (event) => {
      event.preventDefault();
      history.pushState({}, "", el.getAttribute("href"));
      route();
    }),
);
window.onpopstate = route;
$("mobile-home").onclick = () => {
  history.pushState({}, "", "/");
  route();
};
function showSources() {
  $("sources-dialog").showModal();
}
$("sources-nav").onclick = showSources;
$("footer-sources").onclick = showSources;
$("close-sources").onclick = () => $("sources-dialog").close();
$("sources-list").innerHTML = Object.values(sources)
  .map(
    (s) =>
      `<div class="sources-entry"><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)} ↗</a><p>${escape(s.note || s.effective || "Public reference")}</p></div>`,
  )
  .join("");
function connection() {
  const online = navigator.onLine;
  $("connection").classList.toggle("offline", !online);
  $("connection").innerHTML = `<i></i> ${online ? "Online" : "Offline"}`;
  if (online) syncQueue();
}
window.addEventListener("online", connection);
window.addEventListener("offline", connection);
updateQueue();
connection();
route();
api("/api/health")
  .then((health) => {
    if (health.demoAdmin)
      $("demo-admin-hint").textContent =
        "Local development key: railverify-local-demo. Set ADMIN_TOKEN before exposing this server.";
  })
  .catch(() => {});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
