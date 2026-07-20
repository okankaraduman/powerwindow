const ANALYTICS_MEASUREMENT_ID = "G-E1DP7E2REY";
const ANALYTICS_CONSENT_KEY = "power-window:analytics-consent";

initAnalyticsConsent();

function initAnalyticsConsent() {
  const consent = readAnalyticsConsent();
  if (consent === "accepted") {
    loadGoogleAnalytics();
    return;
  }

  if (consent === "declined") return;
  renderAnalyticsPrompt();
}

function readAnalyticsConsent() {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_KEY);
  } catch {
    return null;
  }
}

function writeAnalyticsConsent(value) {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  } catch {
    // If storage is unavailable, keep the preference for this page load only.
  }
}

function loadGoogleAnalytics() {
  if (window.gtag || document.querySelector("[data-power-window-analytics]")) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("consent", "default", {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "granted"
  });
  window.gtag("js", new Date());
  window.gtag("config", ANALYTICS_MEASUREMENT_ID, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_MEASUREMENT_ID}`;
  script.dataset.powerWindowAnalytics = "true";
  document.head.append(script);
}

function renderAnalyticsPrompt() {
  if (document.querySelector(".analytics-consent")) return;

  const prompt = document.createElement("section");
  prompt.className = "analytics-consent";
  prompt.setAttribute("role", "dialog");
  prompt.setAttribute("aria-label", "Analytics preference");
  prompt.innerHTML = `
    <div>
      <strong>Help improve Power Window?</strong>
      <p>Allow anonymous Google Analytics usage measurement. No ads personalization. <a href="/en/privacy">Privacy</a></p>
    </div>
    <div class="analytics-consent__actions">
      <button class="secondary-button" type="button" data-analytics-choice="declined">No thanks</button>
      <button class="primary-button" type="button" data-analytics-choice="accepted">Allow</button>
    </div>
  `;

  prompt.addEventListener("click", (event) => {
    const button = event.target.closest("[data-analytics-choice]");
    if (!button) return;

    const choice = button.dataset.analyticsChoice;
    writeAnalyticsConsent(choice);
    prompt.remove();

    if (choice === "accepted") loadGoogleAnalytics();
  });

  document.body.append(prompt);
}
