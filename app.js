(() => {
  "use strict";

  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];
  const UTM_STORAGE_KEY = "ztt_utm_attribution_v1";
  const WAITLIST_JOINED_KEY = "ztt_waitlist_joined_v1";

  const DEFAULT_CONFIG = {
    WEB_SANDBOX_URL: "https://zero-to-trillion-rho.vercel.app/",
    PLAY_STORE_LIVE: false,
    PLAY_STORE_PACKAGE_ID: "",
    SHOW_IOS_WAITLIST: true,
    GA4_MEASUREMENT_ID: "",
    WAITLIST_WEBHOOK_URL: "",
  };

  const config = Object.assign({}, DEFAULT_CONFIG, window.ZTT_CONFIG || {});

  const TELEMETRY_PHASES = {
    seed: {
      tag: "SANDBOX TELEMETRY • YR 1 Q2",
      cycle: "RECOVERY",
      tier: "TIER I • FOUNDER",
      netWorth: "$18.4M",
      progress: "1.8%",
      milestone: "1.8% TO TRILLION",
      leverage: "0.45x",
      leverageSub: "12% LTV • Seed Line",
      macro: "Recovery",
      macroSub: "Policy 2.50% • CPI 1.8%",
      fcf: "FCF +$4.2M/yr",
    },
    boom: {
      tag: "SANDBOX TELEMETRY • YR 14 Q3",
      cycle: "EXPANSION",
      tier: "TIER IV • CONGLOMERATE",
      netWorth: "$418.6B",
      progress: "41.9%",
      milestone: "41.9% TO TRILLION",
      leverage: "1.42x",
      leverageSub: "28% LTV • AAA Covenant",
      macro: "Expansion",
      macroSub: "Policy 3.25% • CPI 2.1%",
      fcf: "FCF +$14.8B/yr",
    },
    hegemon: {
      tag: "SOVEREIGN CONTROL • YR 30 Q4",
      cycle: "STAGFLATION",
      tier: "TIER VI • HEGEMON",
      netWorth: "$1.49T",
      progress: "100%",
      milestone: "100% GOAL REACHED",
      leverage: "1.85x",
      leverageSub: "31% LTV • Sovereign Tier",
      macro: "Tightening",
      macroSub: "Policy 10.25% • INF 10.2%",
      fcf: "Cash $52.4B",
    },
  };

  /**
   * Detect visitor OS: "android", "ios" (including iPadOS), or "desktop".
   */
  function detectOS() {
    const ua = navigator.userAgent || navigator.vendor || window.opera || "";
    const platform =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      "";

    if (/android/i.test(ua)) {
      return "android";
    }

    const isIOSUserAgent = /iPad|iPhone|iPod/i.test(ua) && !window.MSStream;
    const isIPadOS =
      (/Macintosh|MacIntel/i.test(platform) || /Macintosh/i.test(ua)) &&
      typeof navigator.maxTouchPoints === "number" &&
      navigator.maxTouchPoints > 1;

    if (isIOSUserAgent || isIPadOS) {
      return "ios";
    }

    return "desktop";
  }

  /**
   * Parse UTM parameters from URL and persist across reloads in sessionStorage.
   */
  function resolveUtmParams() {
    const searchParams = new URLSearchParams(window.location.search);
    const hasQueryUtm = UTM_KEYS.some((key) => {
      const value = searchParams.get(key);
      return value !== null && value.trim() !== "";
    });

    if (hasQueryUtm) {
      const fresh = {
        utm_source: (searchParams.get("utm_source") || "").trim() || "direct",
        utm_medium: (searchParams.get("utm_medium") || "").trim(),
        utm_campaign: (searchParams.get("utm_campaign") || "").trim(),
        utm_content: (searchParams.get("utm_content") || "").trim(),
      };
      persistUtmParams(fresh);
      return fresh;
    }

    const stored = readStoredUtmParams();
    if (stored) {
      return stored;
    }

    const fallback = {
      utm_source: "direct",
      utm_medium: "",
      utm_campaign: "",
      utm_content: "",
    };
    persistUtmParams(fallback);
    return fallback;
  }

  function readStoredUtmParams() {
    try {
      const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        utm_source:
          typeof parsed.utm_source === "string" && parsed.utm_source.trim()
            ? parsed.utm_source.trim()
            : "direct",
        utm_medium: typeof parsed.utm_medium === "string" ? parsed.utm_medium.trim() : "",
        utm_campaign: typeof parsed.utm_campaign === "string" ? parsed.utm_campaign.trim() : "",
        utm_content: typeof parsed.utm_content === "string" ? parsed.utm_content.trim() : "",
      };
    } catch (_) {
      return null;
    }
  }

  function persistUtmParams(utms) {
    try {
      window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utms));
    } catch (_) {
      // Ignore storage restrictions in strict private WebViews.
    }
  }

  function hasJoinedWaitlist() {
    try {
      return window.localStorage.getItem(WAITLIST_JOINED_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markWaitlistJoined() {
    try {
      window.localStorage.setItem(WAITLIST_JOINED_KEY, "1");
    } catch (_) {
      // Ignore storage restrictions in strict private WebViews.
    }
  }

  /**
   * Append active UTM parameters cleanly onto WEB_SANDBOX_URL.
   */
  function buildWebSandboxUrl(baseUrl, utms) {
    try {
      const url = new URL(baseUrl);
      UTM_KEYS.forEach((key) => {
        if (utms[key]) {
          url.searchParams.set(key, utms[key]);
        }
      });
      return url.toString();
    } catch (_) {
      return baseUrl;
    }
  }

  /**
   * Build Google Play URL with URL-encoded &referrer= UTM query string.
   */
  function buildGooglePlayUrl(packageId, utms) {
    const referrerParams = new URLSearchParams();
    UTM_KEYS.forEach((key) => {
      if (utms[key]) {
        referrerParams.set(key, utms[key]);
      }
    });
    const utmQueryString = referrerParams.toString();
    const safePackageId = encodeURIComponent((packageId || "").trim());
    return `https://play.google.com/store/apps/details?id=${safePackageId}&referrer=${encodeURIComponent(utmQueryString)}`;
  }

  /**
   * Dynamically initialize GA4 when a real measurement ID is configured.
   */
  function initAnalytics(measurementId) {
    const id = typeof measurementId === "string" ? measurementId.trim() : "";
    if (!id || id.startsWith("<")) {
      return false;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", id, { send_page_view: true });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
    return true;
  }

  /**
   * Emit a GA4 event with standardized attribution parameters.
   */
  function trackEvent(eventName, utms, detectedOS) {
    if (typeof window.gtag !== "function") {
      return;
    }
    window.gtag("event", eventName, {
      utm_source: utms.utm_source,
      utm_medium: utms.utm_medium,
      utm_campaign: utms.utm_campaign,
      detected_os: detectedOS,
      transport_type: "beacon",
    });
  }

  /**
   * Automatically swap built-in SVG/CSS visuals with drop-in WebP assets when present.
   */
  function bindAssetSwap(imgEl, fallbackEl) {
    if (!imgEl || !fallbackEl) return;

    const showImage = () => {
      imgEl.hidden = false;
      fallbackEl.hidden = true;
    };

    const keepFallback = () => {
      imgEl.hidden = true;
      fallbackEl.hidden = false;
    };

    if (imgEl.complete) {
      if (imgEl.naturalWidth > 0) {
        showImage();
      } else {
        keepFallback();
      }
      return;
    }

    imgEl.addEventListener("load", () => {
      if (imgEl.naturalWidth > 0) {
        showImage();
      } else {
        keepFallback();
      }
    });

    imgEl.addEventListener("error", keepFallback);
  }

  /**
   * Interactive 3-era telemetry switcher on the coded fallback card.
   */
  function setupPhaseSwitcher() {
    const buttons = document.querySelectorAll(".phase-btn[data-phase]");
    if (!buttons || !buttons.length) return;

    const els = {
      tag: document.getElementById("telemetry-tag"),
      cycle: document.getElementById("telemetry-cycle"),
      tier: document.getElementById("telemetry-tier"),
      netWorth: document.getElementById("telemetry-networth"),
      fill: document.getElementById("telemetry-progress-fill"),
      milestone: document.getElementById("telemetry-milestone"),
      leverage: document.getElementById("telemetry-leverage"),
      leverageSub: document.getElementById("telemetry-leverage-sub"),
      macro: document.getElementById("telemetry-macro"),
      macroSub: document.getElementById("telemetry-macro-sub"),
      fcf: document.getElementById("telemetry-fcf"),
    };

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.phase;
        const data = TELEMETRY_PHASES[key];
        if (!data) return;

        buttons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", active ? "true" : "false");
        });

        if (els.tag) els.tag.textContent = data.tag;
        if (els.cycle) els.cycle.textContent = data.cycle;
        if (els.tier) els.tier.textContent = data.tier;
        if (els.netWorth) els.netWorth.textContent = data.netWorth;
        if (els.fill) els.fill.style.width = data.progress;
        if (els.milestone) els.milestone.textContent = data.milestone;
        if (els.leverage) els.leverage.textContent = data.leverage;
        if (els.leverageSub) els.leverageSub.textContent = data.leverageSub;
        if (els.macro) els.macro.textContent = data.macro;
        if (els.macroSub) els.macroSub.textContent = data.macroSub;
        if (els.fcf) els.fcf.textContent = data.fcf;
      });
    });
  }

  /**
   * Configure primary/secondary CTAs based on detected OS and PLAY_STORE_LIVE flag.
   */
  function setupCtaStack(detectedOS, utms) {
    const primaryCta = document.getElementById("primary-cta");
    const primaryCtaLabel = document.getElementById("primary-cta-label");
    const primaryCtaIcon = document.getElementById("primary-cta-icon");
    const secondaryCta = document.getElementById("secondary-cta");
    const ctaCaption = document.getElementById("cta-caption");

    if (!primaryCta || !primaryCtaLabel) return;

    const webSandboxUrl = buildWebSandboxUrl(config.WEB_SANDBOX_URL, utms);
    const showGooglePlayPrimary =
      Boolean(config.PLAY_STORE_LIVE) && detectedOS === "android";

    if (showGooglePlayPrimary) {
      const playUrl = buildGooglePlayUrl(config.PLAY_STORE_PACKAGE_ID, utms);
      primaryCta.href = playUrl;
      primaryCtaLabel.textContent = "Get it on Google Play";

      if (primaryCtaIcon) {
        primaryCtaIcon.innerHTML =
          '<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M4.2 2.9c-.25.24-.4.6-.4 1.07v12.06c0 .47.15.83.4 1.07l.06.05 6.76-6.76v-.16L4.26 2.85l-.06.05zm9.01 9.02-2.25-2.25v-.16l2.25-2.25.05.03 2.67 1.52c.76.43.76 1.14 0 1.57l-2.67 1.51-.05.03zm-1.01 1.01L9.9 10.63l-5.64 5.64c.24.25.63.28 1.07.03l6.87-3.37zm0-5.86L5.33 3.7c-.44-.25-.83-.22-1.07.03l5.64 5.64 2.3-2.3z"/>' +
          "</svg>";
      }

      primaryCta.addEventListener("click", () => {
        trackEvent("cta_click_google_play", utms, detectedOS);
      });

      if (secondaryCta) {
        secondaryCta.href = webSandboxUrl;
        secondaryCta.hidden = false;
        secondaryCta.addEventListener("click", () => {
          trackEvent("cta_click_web_sandbox", utms, detectedOS);
        });
      }

      if (ctaCaption) {
        ctaCaption.hidden = true;
      }
    } else {
      primaryCta.href = webSandboxUrl;
      primaryCtaLabel.textContent = "Play Instant Web Sandbox";

      primaryCta.addEventListener("click", () => {
        trackEvent("cta_click_web_sandbox", utms, detectedOS);
      });

      if (secondaryCta) {
        secondaryCta.hidden = true;
      }

      if (ctaCaption) {
        ctaCaption.hidden = false;
      }
    }
  }

  /**
   * Basic client-side email validation.
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  /**
   * Submit waitlist email to Google Apps Script using text/plain to avoid CORS preflight.
   * Includes a graceful no-cors fallback for strict in-app WebViews.
   */
  async function postWaitlistPayload(webhookUrl, payload) {
    const serialized = JSON.stringify(payload);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        redirect: "follow",
        body: serialized,
      });

      if (response.ok || response.type === "opaque") {
        return true;
      }

      return false;
    } catch (_) {
      // Strict in-app WebViews can block reading Google Apps Script's 302 redirect response
      // even when the POST executes cleanly; retry in no-cors mode with the same text/plain payload.
      if (navigator.onLine === false) {
        return false;
      }

      try {
        await fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          redirect: "follow",
          body: serialized,
        });
        return true;
      } catch (_fallbackErr) {
        if (typeof navigator.sendBeacon === "function") {
          try {
            const blob = new Blob([serialized], {
              type: "text/plain;charset=utf-8",
            });
            return navigator.sendBeacon(webhookUrl, blob);
          } catch (_beaconErr) {
            return false;
          }
        }
        return false;
      }
    }
  }

  /**
   * Setup compact iOS waitlist strip, OS highlighting, validation, and submission flow.
   */
  function setupWaitlist(detectedOS, utms) {
    const strip = document.getElementById("waitlist-strip");
    const eyebrow = document.getElementById("waitlist-eyebrow");
    const form = document.getElementById("waitlist-form");
    const input = document.getElementById("waitlist-email");
    const submitBtn = document.getElementById("waitlist-submit");
    const statusEl = document.getElementById("waitlist-status");

    if (!strip || !form || !input || !submitBtn || !statusEl) return;

    if (!config.SHOW_IOS_WAITLIST) {
      strip.hidden = true;
      return;
    }

    strip.hidden = false;

    if (detectedOS === "ios") {
      strip.classList.add("waitlist-strip--highlighted");
      if (eyebrow) {
        eyebrow.hidden = false;
      }
    }

    const setStatus = (message, tone) => {
      statusEl.textContent = message;
      statusEl.className = "waitlist-status";
      if (tone === "success") {
        statusEl.classList.add("waitlist-status--success");
      } else if (tone === "error") {
        statusEl.classList.add("waitlist-status--error");
      }
      statusEl.hidden = !message;
    };

    const setJoinedUI = () => {
      input.value = "";
      input.disabled = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "Joined";
      setStatus("You're on the iOS waitlist. We'll notify you at launch.", "success");
    };

    if (hasJoinedWaitlist()) {
      setJoinedUI();
      return;
    }

    input.addEventListener("input", () => {
      if (input.classList && input.classList.contains("waitlist-input--invalid")) {
        input.classList.remove("waitlist-input--invalid");
        setStatus("", "");
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = input.value.trim();
      if (!isValidEmail(email)) {
        if (input.classList) {
          input.classList.add("waitlist-input--invalid");
        }
        setStatus("Please enter a valid email address.", "error");
        input.focus();
        return;
      }

      const webhookUrl = (config.WAITLIST_WEBHOOK_URL || "").trim();
      if (!webhookUrl) {
        setStatus("Waitlist is temporarily unavailable. Try again soon.", "error");
        return;
      }

      setStatus("", "");
      if (input.classList) {
        input.classList.remove("waitlist-input--invalid");
      }
      input.disabled = true;
      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = "Sending...";

      const payload = {
        email,
        os: detectedOS,
        platform: "ios",
        detected_os: detectedOS,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        page_url: window.location.href,
        submitted_at: new Date().toISOString(),
      };

      const submitted = await postWaitlistPayload(webhookUrl, payload);

      if (submitted) {
        markWaitlistJoined();
        trackEvent("ios_waitlist_submit", utms, detectedOS);
        setJoinedUI();
      } else {
        input.disabled = false;
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        setStatus("Connection issue. Please check your signal and try again.", "error");
      }
    });
  }

  /**
   * Bootstrap landing page on DOM ready.
   */
  function init() {
    const detectedOS = detectOS();
    const utms = resolveUtmParams();

    document.documentElement.dataset.os = detectedOS;

    initAnalytics(config.GA4_MEASUREMENT_ID);

    bindAssetSwap(
      document.getElementById("app-icon-img"),
      document.getElementById("app-icon-svg")
    );
    bindAssetSwap(
      document.getElementById("preview-img"),
      document.getElementById("preview-fallback")
    );

    setupPhaseSwitcher();
    setupCtaStack(detectedOS, utms);
    setupWaitlist(detectedOS, utms);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
