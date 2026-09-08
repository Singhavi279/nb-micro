/**
 * Nivesh Baithak — Consolidated JavaScript
 * Includes:
 * 1. Configuration (payment endpoints & constants)
 * 2. Attribution & Analytics (consent-gated GA4 / Meta Pixel)
 * 3. EventFormRenderer (shared form builder & validator)
 * 4. Dynamic Live Ticket Pricing & Card Updating
 * 5. Checkout, Modal, Quantity & Mobile OTP Flow
 */

/* ── 1. Configuration ── */
window.NB_CONFIG = {
  "ga4Id": "G-6TLYWEPS3Y",
  "metaPixelId": "",
  "analyticsEnabled": false,
  "marketingEnabled": false,
  "verificationEndpoint": ""
};
window.isProdEnv = "true";
window.constants = {
  "envDetails": {
    "production": {
      "apiBaseURL": "https://payment.economictimes.indiatimes.com",
      "langapiBaseURL": "https://setufeed.indiatimes.com",
      "paymentConfig": {
        "nivesh_baithak": {
          "merchantKey": "Pu22y3mrty",
          "products": {
            "learner": "nivesh_delhi_learner",
            "insight": "nivesh_delhi_insight",
            "elite": "nivesh_delhi_elite"
          }
        }
      },
      "grxApiKey": "g487a32da",
      "eventHubBaseURL": "https://api.indiatimes.com/eventhub/api/public",
      "astroMahasangam": {
        "eventId": "6a59fc0f8e75f1926c1a715f"
      }
    }
  }
};

/* ── 2. Attribution & Analytics Tracking ── */
(() => {
  "use strict";
  const cfg = window.NB_CONFIG || {};
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
    "utm_source_platform",
    "campaign_id",
    "adset_id",
    "ad_id",
    "placement",
    "fbclid"
  ];
  const storageKey = "nb_attribution_v1", ttl = 30 * 86400000;
  const query = new URLSearchParams(location.search);
  const current = {};
  for (const key of keys) {
    const v = query.get(key);
    if (v && v.length <= 500 && !/[\x00-\x1f{}]/.test(v)) current[key] = v;
  }
  let analytics = !!cfg.analyticsEnabled, marketing = !!cfg.marketingEnabled;
  let attribution = { first: null, last: null };
  const seen = new Set();
  const read = key => {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch (_) {
      return null;
    }
  };
  const save = (key, v) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(v));
    } catch (_) {}
  };
  function touch() {
    const saved = read(storageKey);
    if (saved?.last?.at && Date.now() - saved.last.at < ttl) attribution = saved;
    if (Object.keys(current).length) {
      const value = { at: Date.now(), params: { ...current } };
      attribution = { first: attribution.first || value, last: value };
    }
    if (analytics || marketing) save(storageKey, attribution);
  }
  if (Object.keys(current).length) {
    const t = { at: Date.now(), params: { ...current } };
    attribution = { first: t, last: t };
  }
  let gaStarted = false, metaStarted = false;
  function addScript(src) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.head.append(s);
  }
  function cleanURL() {
    const url = new URL(location.origin + location.pathname);
    for (const [k, v] of Object.entries(attribution.last?.params || current)) {
      if (k !== "fbclid") url.searchParams.set(k, v);
    }
    return url.href;
  }
  function init() {
    if (analytics && /^G-[A-Z0-9]+$/.test(cfg.ga4Id) && !gaStarted) {
      gaStarted = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", cfg.ga4Id, { send_page_view: false });
      window.gtag("event", "page_view", {
        page_location: cleanURL(),
        page_referrer: document.referrer ? new URL(document.referrer).origin : "",
        page_title: document.title
      });
      addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(cfg.ga4Id));
    }
    if (marketing && /^\d{5,25}$/.test(cfg.metaPixelId) && !metaStarted) {
      metaStarted = true;
      if (!window.fbq) {
        const f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
        window._fbq = f; f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
      }
      window.fbq("init", cfg.metaPixelId);
      window.fbq("consent", "grant");
      window.fbq("track", "PageView");
      addScript("https://connect.facebook.net/en_US/fbevents.js");
    }
  }
  function event(name, data = {}) {
    const allowed = [
      "cta_location",
      "item_id",
      "currency",
      "value",
      "transaction_id",
      "items",
      "content_ids",
      "content_type",
      "num_items",
      "event_id"
    ];
    const safe = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
    if (analytics && gaStarted) {
      window.gtag("event", name, {
        ...safe,
        ...Object.fromEntries(
          Object.entries(attribution.last?.params || {}).filter(([k]) =>
            ["utm_id", "campaign_id", "adset_id", "ad_id", "placement"].includes(k)
          )
        ),
        page_location: cleanURL()
      });
    }
  }
  function once(key, fn) {
    if (seen.has(key) || read("nb_event_" + key)) return;
    seen.add(key);
    if (analytics || marketing) save("nb_event_" + key, true);
    fn();
  }
  function item(product, quantity = 1) {
    return {
      item_id: product.product_code,
      item_name: product.product_name,
      price: Number(product.unit_price),
      quantity
    };
  }
  window.NBTracking = {
    event,
    async verifyPayment(reference) {
      if (!cfg.verificationEndpoint || !reference) return null;
      const endpoint = new URL(cfg.verificationEndpoint, location.origin);
      if (endpoint.origin !== location.origin) throw new Error("Verification endpoint must be same-origin");
      endpoint.searchParams.set("reference", reference);
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
      let order;
      try {
        const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to verify payment");
        order = await response.json();
      } finally {
        clearTimeout(timer);
      }
      if (
        order.status !== "paid" ||
        typeof order.order_id !== "string" ||
        !order.order_id ||
        order.currency !== "INR" ||
        !Number.isFinite(order.amount) ||
        order.amount <= 0 ||
        !Array.isArray(order.items) ||
        !order.items.length ||
        order.items.some(
          x => typeof x.product_code !== "string" || !Number.isInteger(x.quantity) || x.quantity < 1 || !Number.isFinite(x.unit_price) || x.unit_price < 0
        )
      ) return null;
      if (analytics || marketing) {
        const id = "nb_purchase_" + order.order_id;
        once(id, () => {
          event("purchase", {
            transaction_id: order.order_id,
            currency: order.currency,
            value: order.amount,
            items: order.items.map(x => ({ item_id: x.product_code, quantity: x.quantity, price: x.unit_price })),
            event_id: id
          });
          if (marketing && metaStarted) {
            window.fbq(
              "track",
              "Purchase",
              {
                currency: order.currency,
                value: order.amount,
                content_ids: order.items.map(x => x.product_code),
                content_type: "product",
                num_items: order.items.reduce((n, x) => n + x.quantity, 0)
              },
              { eventID: id }
            );
          }
        });
      }
      return order;
    },
    setConsent(value) {
      analytics = value.analytics === true;
      marketing = value.marketing === true;
      window["ga-disable-" + cfg.ga4Id] = !analytics;
      if (window.fbq) window.fbq("consent", marketing ? "grant" : "revoke");
      if (analytics || marketing) touch();
      else {
        try { sessionStorage.removeItem(storageKey); } catch (_) {}
      }
      init();
    },
    getAttribution() {
      return JSON.parse(JSON.stringify(attribution));
    },
    returnURL() {
      const url = new URL(location.origin + location.pathname);
      for (const [k, v] of Object.entries(attribution.last?.params || current)) url.searchParams.set(k, v);
      return url;
    },
    lead(submissionId, product) {
      if (!submissionId || (!analytics && !marketing)) return;
      const id = "nb_lead_" + String(submissionId);
      once(id, () => {
        event("generate_lead", { item_id: product?.product_code, event_id: id });
        if (marketing && metaStarted) {
          window.fbq("track", "Lead", { content_name: "Nivesh Baithak registration" }, { eventID: id });
        }
      });
    },
    beginCheckout(product, quantity) {
      if (!product || !Number.isFinite(Number(product.unit_price))) return;
      const total = Number(product.unit_price) * quantity;
      event("begin_checkout", { currency: "INR", value: total, items: [item(product, quantity)] });
      if (marketing && metaStarted) {
        window.fbq("track", "InitiateCheckout", {
          currency: "INR",
          value: total,
          content_ids: [product.product_code],
          content_type: "product",
          num_items: quantity
        });
      }
    }
  };
  if (analytics || marketing) touch();
  init();
})();

/* ── 3. EventFormRenderer (Form Generation & Validation Engine) ── */
(function (global) {
  "use strict";
  const DEFAULT_BASE = "/events/api/forms";

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value === true ? "" : value);
    });
    (children || []).forEach((child) => child && node.appendChild(child));
    return node;
  }

  function inputTypeFor(field) {
    switch (field.field_type) {
      case "email": return "email";
      case "phone": return "tel";
      case "number": return "number";
      case "date": return "date";
      default: return "text";
    }
  }

  function isWideField(field) {
    return field.field_type === "select" || field.field_type === "textarea" || field.field_type === "checkbox";
  }

  function isCheckboxField(field) {
    return field.field_type === "checkbox";
  }

  function buildControl(field) {
    const rules = field.validation_rules || {};
    const controlId = `efr-${field.field_id}`;
    if (field.field_type === "checkbox") {
      return el("input", {
        class: "efr-checkbox",
        id: controlId,
        type: "checkbox",
        name: field.field_id,
        required: !!field.required,
      });
    }
    if (field.field_type === "select") {
      const select = el("select", {
        class: "efr-control",
        id: controlId,
        name: field.field_id,
        required: !!field.required,
      });
      select.appendChild(el("option", { value: "", text: field.placeholder || "Select one" }));
      (field.options || []).forEach((opt) => {
        select.appendChild(el("option", { value: opt.value, text: opt.label }));
      });
      return select;
    }
    if (field.field_type === "textarea") {
      return el("textarea", {
        class: "efr-control",
        id: controlId,
        name: field.field_id,
        placeholder: field.placeholder || "",
        rows: "4",
        maxlength: rules.max_length || undefined,
        required: !!field.required,
      });
    }
    return el("input", {
      class: "efr-control",
      id: controlId,
      type: inputTypeFor(field),
      name: field.field_id,
      placeholder: field.placeholder || "",
      maxlength: rules.max_length || undefined,
      required: !!field.required,
    });
  }

  function isInherentlyWideField(field, requireLogin) {
    return isWideField(field) || (!!requireLogin && field.field_type === "phone");
  }

  function planFieldWidths(fields, requireLogin) {
    const wide = fields.map((field) => isInherentlyWideField(field, requireLogin));
    let col = 0;
    for (let i = 0; i < fields.length; i++) {
      if (wide[i]) {
        if (col === 1 && i > 0 && !wide[i - 1]) {
          wide[i - 1] = true;
        }
        col = 0;
      } else {
        col = col === 0 ? 1 : 0;
      }
    }
    return wide;
  }

  function buildField(field, requireLogin, isWide) {
    const control = buildControl(field);
    const error = el("p", {
      class: "efr-error",
      id: `efr-error-${field.field_id}`,
      role: "alert",
      hidden: true,
    });

    const wrapperAttrs = {
      class: `efr-field${isWide ? " efr-field-wide" : ""}`,
      "data-field-wrapper": field.field_id,
    };

    if (isCheckboxField(field)) {
      const label = el("label", { class: "efr-label efr-checkbox-label", for: `efr-${field.field_id}` }, [
        document.createTextNode(field.label + (field.required ? " *" : "")),
      ]);
      wrapperAttrs.class += " efr-field-checkbox";
      const row = el("div", { class: "efr-checkbox-row" }, [control, label]);
      return el("div", wrapperAttrs, [row, error]);
    }

    const label = el("label", { class: "efr-label", for: `efr-${field.field_id}` }, [
      document.createTextNode(field.label + (field.required ? " *" : "")),
    ]);

    const isOtpField = !!requireLogin && field.field_type === "phone";
    if (!isOtpField) {
      return el("div", wrapperAttrs, [label, control, error]);
    }

    wrapperAttrs.class += " efr-field-otp";
    wrapperAttrs["data-otp-required"] = "true";
    return el("div", wrapperAttrs, [label, ...buildOtpControls(field, control), error]);
  }

  function buildOtpControls(field, control) {
    const otpState = {
      phone: "",
      verifiedValue: null,
      ssoId: null,
      isRegistrationFlow: false,
      sentOnce: false,
      resendRemaining: 0,
      resendClicks: 0,
      timer: null,
    };

    const sendBtn = el("button", { type: "button", class: "efr-otp-send-btn", text: "Send OTP" });
    const controlRow = el("div", { class: "efr-control-row" }, [control, sendBtn]);
    const otpInput = el("input", {
      class: "efr-control efr-otp-input",
      type: "text",
      inputmode: "numeric",
      autocomplete: "one-time-code",
      maxlength: "6",
      placeholder: "Enter OTP",
    });
    const verifyBtn = el("button", { type: "button", class: "efr-otp-verify-btn", text: "Verify" });
    const otpRow = el("div", { class: "efr-otp-row", hidden: true }, [otpInput, verifyBtn]);
    const hint = el("p", { class: "efr-otp-hint", hidden: true });
    const verifiedBadge = el("span", { class: "efr-otp-verified-badge", hidden: true, text: "Verified" });

    control.efrIsOtpVerified = () =>
      otpState.verifiedValue !== null && otpState.verifiedValue === control.value.trim();

    const ctx = { field, control, sendBtn, otpInput, verifyBtn, otpRow, hint, verifiedBadge, otpState };

    sendBtn.addEventListener("click", () => {
      if (otpState.sentOnce && otpState.verifiedValue !== otpState.phone) {
        if (otpState.resendRemaining > 0) return;
        resendOtp(ctx);
      } else {
        sendOtp(ctx);
      }
    });
    verifyBtn.addEventListener("click", () => verifyOtp(ctx));
    otpInput.addEventListener("input", () => {
      otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
    });
    control.addEventListener("input", () => {
      if (otpState.phone && control.value.trim() !== otpState.phone) {
        resetOtpState(ctx, false);
      }
    });

    return [controlRow, otpRow, hint, verifiedBadge];
  }

  const OTP_REGEX = /^\d{6}$/;
  const OTP_RESEND_SECONDS = 60;
  const OTP_MAX_RESENDS = 3;
  const SSO_STATUS_CODES = Object.freeze({
    VERIFIED: [212, 213],
    UNREGISTERED: [214, 215],
    UNVERIFIED: [205, 206],
  });

  function waitForJssoRef(timeoutMs) {
    return new Promise((resolve) => {
      if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") {
        resolve(true);
        return;
      }
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > (timeoutMs || 4000)) {
          clearInterval(timer);
          resolve(false);
        }
      }, 150);
    });
  }

  async function otpSdkCall(methodName, ...args) {
    const ready = await waitForJssoRef();
    if (!ready || !window.jssoRef || typeof window.jssoRef[methodName] !== "function") {
      throw new Error("OTP service unavailable. Please try again.");
    }
    return new Promise((resolve, reject) => {
      try {
        window.jssoRef[methodName](...args, (resp) => resolve(resp));
      } catch (error) {
        reject(error);
      }
    });
  }

  function otpStatusCode(resp) {
    return Number(resp && (resp.code || resp.statusCode || resp.status || resp.responseCode));
  }

  function isOtpDispatchSuccess(resp) {
    const code = otpStatusCode(resp);
    if (code >= 200 && code < 300) return true;
    const message = `${(resp && (resp.message || resp.statusText)) || ""}`.toLowerCase();
    return message.includes("otp") && (message.includes("sent") || message.includes("generated"));
  }

  function isRegisterOtpDispatchSuccess(resp) {
    const code = otpStatusCode(resp);
    if (code === 200 || code === 429) return true;
    return isOtpDispatchSuccess(resp);
  }

  function isOtpVerifySuccess(resp) {
    const code = otpStatusCode(resp);
    if (code >= 200 && code < 300) return true;
    const message = `${(resp && (resp.message || resp.statusText)) || ""}`.toLowerCase();
    return message.includes("success") || message.includes("verified");
  }

  function extractSsoId(resp) {
    if (!resp) return null;
    return (
      (resp.data && (resp.data.ssoid || resp.data.ssoId || resp.data.userId)) ||
      (resp.data && resp.data.data && (resp.data.data.ssoid || resp.data.data.ssoId || resp.data.data.userId)) ||
      resp.ssoid ||
      resp.ssoId ||
      resp.userId ||
      null
    );
  }

  async function verifySignUpOtp(phone, ssoId, otp) {
    const ref = window.jssoRef || {};
    if (typeof ref.verifySignUpOTP === "function") {
      try {
        return await otpSdkCall("verifySignUpOTP", { mobile: phone, ssoid: ssoId, otp });
      } catch (_) {
        return otpSdkCall("verifySignUpOTP", phone, ssoId, otp);
      }
    }
    if (typeof ref.verifyMobileSignUp === "function") {
      return otpSdkCall("verifyMobileSignUp", phone, ssoId, otp);
    }
    throw new Error("Signup OTP verification service unavailable.");
  }

  async function resendSignUpOtp(phone, ssoId) {
    const ref = window.jssoRef || {};
    if (typeof ref.resendMobileSignUpOtp === "function") {
      return otpSdkCall("resendMobileSignUpOtp", phone, ssoId);
    }
    throw new Error("Unable to resend signup OTP.");
  }

  function setOtpHint(hint, message, type) {
    hint.textContent = message || "";
    hint.hidden = !message;
    hint.classList.remove("efr-otp-hint-success", "efr-otp-hint-error");
    if (type === "success") hint.classList.add("efr-otp-hint-success");
    if (type === "error") hint.classList.add("efr-otp-hint-error");
  }

  function dispatchOtpEvent(control, name, detail) {
    control.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  function clearResendTimer(otpState) {
    if (otpState.timer) {
      clearInterval(otpState.timer);
      otpState.timer = null;
    }
    otpState.resendRemaining = 0;
  }

  function startResendTimer(otpState, btn) {
    otpState.resendRemaining = OTP_RESEND_SECONDS;
    btn.disabled = true;
    btn.textContent = `Resend in ${otpState.resendRemaining}s`;
    if (otpState.timer) clearInterval(otpState.timer);
    otpState.timer = setInterval(() => {
      otpState.resendRemaining -= 1;
      if (otpState.resendRemaining <= 0) {
        clearInterval(otpState.timer);
        otpState.timer = null;
        btn.disabled = false;
        btn.textContent = "Resend OTP";
      } else {
        btn.textContent = `Resend in ${otpState.resendRemaining}s`;
      }
    }, 1000);
  }

  function resetOtpState(ctx, clearPhone) {
    const { otpState, otpInput, otpRow, verifiedBadge, hint, sendBtn } = ctx;
    clearResendTimer(otpState);
    otpState.verifiedValue = null;
    otpState.ssoId = null;
    otpState.isRegistrationFlow = false;
    otpState.sentOnce = false;
    otpState.resendClicks = 0;
    if (clearPhone) otpState.phone = "";
    otpInput.value = "";
    otpRow.hidden = true;
    verifiedBadge.hidden = true;
    setOtpHint(hint, "", null);
    sendBtn.disabled = false;
    sendBtn.textContent = "Send OTP";
  }

  async function sendOtp(ctx) {
    const { field, control, sendBtn, otpInput, otpRow, hint, verifiedBadge, otpState } = ctx;
    const phoneVal = control.value.trim();
    const validationMessage = validateValue(field, phoneVal);
    if (validationMessage) {
      setOtpHint(hint, validationMessage, "error");
      control.focus();
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    try {
      const checkResp = await otpSdkCall("checkUserExists", phoneVal);
      if (!checkResp || checkResp.code !== 200) throw new Error("Could not validate number. Try again.");
      const statusCode = Number((checkResp.data && checkResp.data.statusCode) || 0);
      otpState.phone = phoneVal;

      if (SSO_STATUS_CODES.VERIFIED.includes(statusCode)) {
        otpState.isRegistrationFlow = false;
        otpState.ssoId = null;
        const otpResp = await otpSdkCall("getMobileLoginOtp", phoneVal);
        if (!isOtpDispatchSuccess(otpResp)) throw new Error("Unable to send OTP.");
      } else if (
        SSO_STATUS_CODES.UNREGISTERED.includes(statusCode) ||
        SSO_STATUS_CODES.UNVERIFIED.includes(statusCode)
      ) {
        otpState.isRegistrationFlow = true;
        const registerResp = await otpSdkCall(
          "registerUser", "Member", "", "", "", "", phoneVal, "123Times@", false, "1", "0", "0", "", ""
        );
        otpState.ssoId = extractSsoId(registerResp) || extractSsoId(checkResp);
        if (!isRegisterOtpDispatchSuccess(registerResp)) throw new Error("Unable to send OTP.");
      } else {
        throw new Error("Unable to initiate OTP. Please try again.");
      }

      otpState.sentOnce = true;
      otpRow.hidden = false;
      verifiedBadge.hidden = true;
      startResendTimer(otpState, sendBtn);
      setOtpHint(hint, `OTP sent to ${phoneVal}`, "success");
      dispatchOtpEvent(control, "efr:otp-sent", { fieldId: field.field_id, phone: phoneVal });
      otpInput.value = "";
      otpInput.focus();
    } catch (error) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send OTP";
      setOtpHint(hint, error.message || "Unable to send OTP. Please try again.", "error");
    }
  }

  async function resendOtp(ctx) {
    const { hint, sendBtn, otpState } = ctx;
    if (otpState.resendClicks >= OTP_MAX_RESENDS) {
      setOtpHint(hint, "Resend limit reached. Please try again later.", "error");
      return;
    }
    if (!otpState.phone || otpState.resendRemaining > 0) return;

    sendBtn.disabled = true;
    try {
      let otpResp;
      if (otpState.isRegistrationFlow) {
        if (!otpState.ssoId) throw new Error("Unable to resend OTP.");
        otpResp = await resendSignUpOtp(otpState.phone, otpState.ssoId);
      } else {
        otpResp = await otpSdkCall("getMobileLoginOtp", otpState.phone);
      }
      if (!isOtpDispatchSuccess(otpResp)) throw new Error("Unable to resend OTP. Please try again.");
      otpState.resendClicks += 1;
      startResendTimer(otpState, sendBtn);
      setOtpHint(hint, "OTP resent.", "success");
    } catch (error) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Resend OTP";
      setOtpHint(hint, error.message || "Unable to resend OTP.", "error");
    }
  }

  async function verifyOtp(ctx) {
    const { field, control, otpInput, verifyBtn, otpRow, hint, verifiedBadge, sendBtn, otpState } = ctx;
    const otpVal = (otpInput.value || "").trim();
    if (!OTP_REGEX.test(otpVal)) {
      setOtpHint(hint, "Enter a valid 6-digit OTP.", "error");
      otpInput.focus();
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";
    try {
      let verifyResp;
      if (otpState.isRegistrationFlow || otpState.ssoId) {
        if (!otpState.ssoId) throw new Error("Unable to verify OTP. Please request OTP again.");
        verifyResp = await verifySignUpOtp(otpState.phone, otpState.ssoId, otpVal);
      } else {
        verifyResp = await otpSdkCall("verifyMobileLogin", otpState.phone, otpVal);
      }
      if (!isOtpVerifySuccess(verifyResp)) throw new Error("Invalid OTP. Please try again.");

      otpState.verifiedValue = otpState.phone;
      otpRow.hidden = true;
      verifiedBadge.hidden = false;
      clearResendTimer(otpState);
      sendBtn.disabled = true;
      sendBtn.textContent = "Verified";
      setOtpHint(hint, "", null);
      dispatchOtpEvent(control, "efr:otp-verified", { fieldId: field.field_id, phone: otpState.phone });
    } catch (error) {
      dispatchOtpEvent(control, "efr:otp-verify-failed", { fieldId: field.field_id, phone: otpState.phone });
      setOtpHint(hint, error.message || "OTP verification failed.", "error");
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify";
    }
  }

  function ruleMatches(rule, rawValue) {
    const value = (rawValue == null ? "" : String(rawValue)).trim();
    switch (rule.operator) {
      case "equals": return value === String(rule.value);
      case "not_equals": return value !== String(rule.value);
      case "in": return Array.isArray(rule.value) && rule.value.map(String).includes(value);
      case "not_in": return Array.isArray(rule.value) && !rule.value.map(String).includes(value);
      case "contains": return value.toLowerCase().includes(String(rule.value).toLowerCase());
      case "not_contains": return !value.toLowerCase().includes(String(rule.value).toLowerCase());
      case "exists": return value !== "";
      case "not_exists": return value === "";
      default: return true;
    }
  }

  function getFieldValue(container, fieldId, skipped) {
    const control = container.querySelector(`#efr-${fieldId}`);
    if (control) return control.type === "checkbox" ? (control.checked ? "true" : "") : control.value;
    if (fieldId in skipped) return skipped[fieldId];
    return "";
  }

  function applyConditionalVisibility(container, fields, skipped) {
    fields.forEach((field) => {
      const rules = field.conditional_rules && field.conditional_rules.show_if;
      if (!rules || !rules.length) return;

      const visible = rules.every((rule) =>
        ruleMatches(rule, getFieldValue(container, rule.field_id, skipped))
      );
      const wrapper = container.querySelector(`[data-field-wrapper="${field.field_id}"]`);
      if (!wrapper) return;

      const wasHidden = wrapper.classList.contains("efr-field-hidden");
      wrapper.classList.toggle("efr-field-hidden", !visible);

      if (!visible && !wasHidden) {
        const control = container.querySelector(`#efr-${field.field_id}`);
        if (control) {
          if (control.type === "checkbox") control.checked = false;
          else control.value = "";
        }
        const errorEl = container.querySelector(`#efr-error-${field.field_id}`);
        if (errorEl) {
          errorEl.textContent = "";
          errorEl.hidden = true;
        }
      }
    });
  }

  function validateValue(field, rawValue) {
    const value = (rawValue || "").trim();
    const rules = field.validation_rules || {};
    if (field.required && !value) return `${field.label} is required.`;
    if (!value) return null;
    if (rules.min_length && value.length < rules.min_length) {
      return `${field.label} must be at least ${rules.min_length} characters.`;
    }
    if (rules.max_length && value.length > rules.max_length) {
      return `${field.label} must be under ${rules.max_length} characters.`;
    }
    if (rules.regex) {
      try {
        if (!new RegExp(rules.regex).test(value)) return `${field.label} is invalid.`;
      } catch (error) {}
    }
    return null;
  }

  async function fetchConfig(code, options) {
    const base = (options && (options.fetchBaseUrl || options.baseUrl)) || DEFAULT_BASE;
    const response = await fetch(`${base}/${encodeURIComponent(code)}`);
    const json = await response.json().catch(() => null);
    if (!response.ok || !json || json.success === false || !json.data) {
      throw new Error((json && json.message) || "Unable to load form.");
    }
    return json.data;
  }

  async function submitForm(payload, options) {
    const submitUrl = options && options.submitBaseUrl;
    const base = (options && options.baseUrl) || DEFAULT_BASE;
    const response = await fetch(submitUrl || `${base}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json || json.success === false) {
      throw new Error((json && json.message) || "Unable to submit form.");
    }
    return json;
  }

  function renderFields(container, config, options) {
    options = options || {};
    container.innerHTML = "";
    const prefillByType = options.prefillByType || {};
    const prefillById = options.prefillById || {};
    const skipped = {};
    const requireLogin = !!(
      options.requireLogin ||
      (config.event_link && config.event_link.require_login)
    );

    const orderedFields = [...(config.fields || [])]
      .filter((field) => field.status !== "inactive")
      .sort((a, b) => (a.order_no || 0) - (b.order_no || 0));

    const renderedFields = [];
    orderedFields.forEach((field) => {
      const preset = field.field_id in prefillById
        ? prefillById[field.field_id]
        : prefillByType[field.field_type];
      if (preset !== undefined) {
        skipped[field.field_id] = preset;
        return;
      }
      renderedFields.push(field);
    });

    const wideFlags = planFieldWidths(renderedFields, requireLogin);
    renderedFields.forEach((field, index) => {
      container.appendChild(buildField(field, requireLogin, wideFlags[index]));
    });

    applyConditionalVisibility(container, renderedFields, skipped);
    container.addEventListener("input", () => applyConditionalVisibility(container, renderedFields, skipped));
    container.addEventListener("change", () => applyConditionalVisibility(container, renderedFields, skipped));

    return { fields: renderedFields, skipped };
  }

  function collectAnswers(container, fields) {
    const answers = {};
    let firstError = null;

    fields.forEach((field) => {
      const wrapper = container.querySelector(`[data-field-wrapper="${field.field_id}"]`);
      const control = container.querySelector(`#efr-${field.field_id}`);
      const errorEl = container.querySelector(`#efr-error-${field.field_id}`);

      if (wrapper && wrapper.classList.contains("efr-field-hidden")) {
        if (errorEl) {
          errorEl.textContent = "";
          errorEl.hidden = true;
        }
        answers[field.field_id] = "";
        return;
      }

      const isCheckbox = control && control.type === "checkbox";
      const value = control ? (isCheckbox ? control.checked : control.value) : "";
      let message = validateValue(field, isCheckbox ? (value ? "true" : "") : value);

      if (!message && wrapper && wrapper.dataset.otpRequired === "true") {
        const isVerified = typeof control.efrIsOtpVerified === "function" && control.efrIsOtpVerified();
        if (!isVerified) {
          message = `Please verify your ${field.label} with OTP.`;
        }
      }

      if (errorEl) {
        errorEl.textContent = message || "";
        errorEl.hidden = !message;
      }
      if (message && !firstError) firstError = { field, control, message };
      answers[field.field_id] = isCheckbox ? !!value : value.trim();
    });

    return { answers, firstError };
  }

  async function mount(container, formCode, options) {
    options = options || {};
    const config = await fetchConfig(formCode, options);
    const { fields, skipped } = renderFields(container, config, options);

    if (typeof options.onRendered === "function") options.onRendered(config, fields);

    return {
      config,
      fields,
      collect: () => collectAnswers(container, fields),
      async submit(extraAnswers) {
        const { answers, firstError } = collectAnswers(container, fields);
        if (firstError) {
          if (firstError.control) firstError.control.focus();
          throw new Error(firstError.message);
        }
        return submitForm(
          {
            form_id: config._id,
            event_id: config.event && config.event._id,
            answers_json: { ...skipped, ...answers, ...(extraAnswers || {}) },
          },
          options
        );
      },
    };
  }

  global.EventFormRenderer = {
    fetchConfig,
    submitForm,
    renderFields,
    collectAnswers,
    mount,
  };
})(window);

/* ── 4. Dynamic Ticket Pricing & Card Updating ── */
(() => {
  "use strict";
  const cards = [...document.querySelectorAll("[data-product-card]")];
  const prices = new Map();
  const env = window.constants.envDetails.production;
  const merchant = env.paymentConfig.nivesh_baithak.merchantKey;
  const status = document.getElementById("price-status");
  const retry = document.getElementById("retry-prices");
  const money = n => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

  function priceURL(code) {
    const url = new URL(env.langapiBaseURL + "/langapi/payment/get-product-details");
    url.searchParams.set("pcode", code);
    url.searchParams.set("mcode", merchant);
    const query = new URLSearchParams(location.search);
    const coupon = query.get("ccode") || query.get("dealcode");
    if (coupon && /^[a-zA-Z0-9_-]{1,100}$/.test(coupon)) url.searchParams.set("ccode", coupon);
    return url;
  }

  function normalize(data, code) {
    const raw = data._sale_price ?? data.sale_price ?? data.selling_price ?? data.product_amount_with_gst;
    const regularRaw = data._regular_price ?? data.regular_price ?? data.rate_card_amount ?? data.mrp ?? data.product_amount_with_gst;
    const sale = Number(raw), regular = Number(regularRaw);
    if (
      data.error ||
      data.product_code !== code ||
      raw == null ||
      raw === "" ||
      !Number.isFinite(sale) ||
      sale <= 0 ||
      regularRaw == null ||
      !Number.isFinite(regular) ||
      regular < sale
    ) {
      throw new Error("Invalid product response");
    }
    return { ...data, _sale_price: sale, _regular_price: regular };
  }

  function paint(card, data) {
    const sale = data._sale_price, regular = data._regular_price;
    card.dataset.productUnitPrice = String(sale);
    card.dataset.productSalePrice = money(sale);
    card.dataset.productRegularPrice = String(regular);
    card.dataset.productName = data.product_name || card.querySelector("[data-product-name]").textContent;
    card.dataset.productCouponCode = data._coupon_code || "";
    card.dataset.productCouponDiscount = String(data._amount_discounted || 0);
    card.querySelector("[data-product-name]").textContent = card.dataset.productName;
    card.querySelector("[data-product-sale-price]").textContent = money(sale);
    const strike = card.querySelector("[data-product-original-price]");
    strike.textContent = "₹" + money(regular);
    strike.hidden = regular <= sale;
    strike.setAttribute("aria-label", "Regular price ₹" + money(regular));
    const button = card.querySelector(".tier-cta");
    button.textContent = "Register at ₹" + money(sale);
    button.disabled = false;
    const option = document.querySelector('option[value="' + card.dataset.productCode + '"]');
    if (option) {
      option.disabled = false;
      option.textContent = card.dataset.productName + " — ₹" + money(sale);
    }
    if (typeof window.updateProductCard === "function") window.updateProductCard(card, data);
  }

  function startingPrice() {
    const amounts = [...prices.values()].map(x => x._sale_price);
    document.querySelectorAll("[data-starting-price]").forEach(el => {
      el.textContent = amounts.length ? "· from ₹" + money(Math.min(...amounts)) : "";
    });
  }

  async function refresh(code) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(priceURL(code), {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Price service unavailable");
      const data = normalize(await response.json(), code);
      prices.set(code, data);
      paint(cards.find(x => x.dataset.productCode === code), data);
      startingPrice();
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  window.nbRefreshPrice = refresh;
  window.nbApplyPrices = () => prices.forEach((data, code) => paint(cards.find(x => x.dataset.productCode === code), data));

  async function loadPrices() {
    if (retry) retry.hidden = true;
    if (status) status.textContent = "Checking current ticket prices…";
    const results = await Promise.allSettled(cards.map(card => refresh(card.dataset.productCode)));
    const failed = results.some(r => r.status === "rejected");
    if (status) {
      status.textContent = failed
        ? "Some ticket prices could not load. Please retry."
        : "Current prices · inclusive of all taxes";
    }
    if (retry) retry.hidden = !failed;
  }

  cards.forEach(card => {
    const opt = document.querySelector('option[value="' + card.dataset.productCode + '"]');
    if (opt) opt.disabled = true;
  });
  if (retry) retry.addEventListener("click", loadPrices);
  loadPrices();

  // CTA Click Tracking
  document.querySelectorAll("[data-cta]").forEach(link => {
    link.addEventListener("click", () => {
      if (window.NBTracking?.event) {
        window.NBTracking.event("ticket_cta_click", { cta_location: link.dataset.cta });
      }
    });
  });
  document.querySelectorAll(".tier-cta").forEach(button => {
    button.addEventListener("click", () => {
      if (window.NBTracking?.event) {
        const code = button.closest("[data-product-card]")?.dataset?.productCode;
        window.NBTracking.event("ticket_selected", { item_id: code });
      }
    });
  });
})();

/* ── 5. Checkout, Modals, Quantity Controls & Mobile OTP Flow ── */
window.trackGRX = function () {};
const EVENTHUB_FORM_FETCH_BASE = "https://api.indiatimes.com/eventhub/api/public/forms/code";
const EVENTHUB_FORM_SUBMIT_URL = "https://api.indiatimes.com/eventhub/api/public/form-submissions";

const DEFAULT_GRX_TRACKING_NAME = "event";
const NIVESH_PRODUCT_CODES = [
  "nivesh_delhi_learner",
  "nivesh_delhi_insight",
  "nivesh_delhi_elite",
];
const NIVESH_CHECKOUT_KEY = "nivesh_pending_checkout";
const NIVESH_MIN_QUANTITY = 1;
const NIVESH_MAX_QUANTITY = 10;
let selectedNiveshProduct = null;
const checkoutState = {
  quantity: 1,
  isPaying: false,
};

const GRX_ALLOWED_FIELDS = [
  "event_category",
  "user_action",
  "scroll_percentage",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "discount",
  "rate_card_amount",
  "selling_amount",
  "coupon_code",
  "email",
  "phone",
  "sso_id",
  "full_name",
  "gender",
  "interest",
  "current_city",
  "product_code",
  "product_name",
  "url",
  "referralurl",
  "platform",
  "profile_type",
  "wa_media_success",
  "registered_user_type",
  "note",
  "whatsapp_opt_in",
  "email_opt_in",
  "terms_privacy_opti_in",
  "form_type",
  "login_source",
  "login_state",
  "login_method",
  "projectCode",
  "subdomain",
  "organisation",
  "merchant_code",
  "wa_number",
  "country",
  "state",
  "pincode",
  "age",
  "transaction_status",
  "payment_mode",
  "userId",
];

function pickGrxPayload(data, { onlyProvided = false } = {}) {
  const source = data || {};
  const payload = {};
  GRX_ALLOWED_FIELDS.forEach((key) => {
    const value = source[key];
    const isEmpty = value === undefined || value === null;
    if (isEmpty && onlyProvided) return;
    payload[key] = isEmpty ? "" : value;
  });
  return payload;
}

function getPageConstants() {
  if (window.constants && typeof window.constants === "object") {
    return window.constants;
  }
  try {
    return JSON.parse(document.body.dataset.constants || "{}");
  } catch (error) {
    return {};
  }
}

function getPaymentEnv() {
  const constants = getPageConstants();
  const envDetails = constants.envDetails || {};
  const isProd = window.isProdEnv === "true";
  const env = isProd ? envDetails.production : envDetails.testing;
  const eventPayment = env && env.paymentConfig && env.paymentConfig.nivesh_baithak;
  return {
    ...(env || {}),
    ...(eventPayment && eventPayment.apiBaseURL ? { apiBaseURL: eventPayment.apiBaseURL } : {}),
    ...(eventPayment && eventPayment.langapiBaseURL ? { langapiBaseURL: eventPayment.langapiBaseURL } : {}),
  };
}

function getNiveshPaymentConfig() {
  const env = getPaymentEnv();
  const configured = (env && env.paymentConfig && env.paymentConfig.nivesh_baithak) || {};
  return {
    ...configured,
    merchantKey: configured.merchantKey || configured.mcode || (env && env.merchantKey) || "Pu22y3mrty",
  };
}

const NIVESH_SESSION_KEY = "nivesh_verified_session";

function parseCrosswalkUserDetails(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const firstPart = raw.split("~~")[0];
    const cleaned = firstPart.replace(/^value:\s*/i, "").trim();
    if (!cleaned) return null;
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

function getSsoIdFromSessionStorage() {
  try {
    const raw = sessionStorage.getItem("jsso_crosswalk_user_details");
    const parsed = parseCrosswalkUserDetails(raw);
    return parsed?.data?.ssoid || parsed?.ssoid || parsed?.data?.user?.ssoid || null;
  } catch (e) {
    return null;
  }
}

function getGlobalLoginState() {
  const crosswalkSsoId = getSsoIdFromSessionStorage() || "";
  try {
    const raw = sessionStorage.getItem(NIVESH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.phone && parsed.verified) {
        return {
          login_state: "yes",
          login_method: "mobileotp",
          login_source: "nivesh-baithak-form-login",
          sso_id: crosswalkSsoId,
          userId: crosswalkSsoId,
          phone: parsed.phone,
        };
      }
    }
  } catch (error) {}

  if (crosswalkSsoId) {
    return {
      login_state: "yes",
      login_method: "crosswalks",
      sso_id: crosswalkSsoId,
      userId: crosswalkSsoId,
    };
  }

  return { login_state: "no", login_method: "", sso_id: "", userId: "" };
}

function formatRupees(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Math.round(number).toLocaleString("en-IN");
}

function parsePrice(value) {
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  const formatted = formatRupees(value);
  return formatted ? "\u20b9" + formatted : "\u20b90";
}

function normalizeProduct(product) {
  if (!product || product.error) return null;
  const salePrice =
    product._sale_price ??
    product.sale_price ??
    product.selling_price ??
    product.product_amount_with_gst ??
    product.price;
  const regularPrice =
    product._regular_price ??
    product.regular_price ??
    product.rate_card_amount ??
    product.mrp ??
    product.product_amount_with_gst ??
    product.final_billing_amount ??
    product.price;

  const coupon = readProductCoupon(product);
  return {
    name: product.name || product.product_name || product.title || product.productTitle || "",
    salePrice,
    regularPrice,
    amount: Number(salePrice) || 0,
    couponCode: coupon.code,
    couponDiscount: coupon.discount,
  };
}

function updateProductCard(card, product) {
  const normalized = normalizeProduct(product);
  if (!normalized) return;

  const salePriceText = formatRupees(normalized.salePrice);
  const regularPriceText = formatRupees(normalized.regularPrice);
  const nameEl = card.querySelector("[data-product-name]");
  const salePriceEl = card.querySelector("[data-product-sale-price]");
  const originalPriceEl = card.querySelector("[data-product-original-price]");
  const ctaEl = card.querySelector(".tier-cta");

  if (nameEl && normalized.name) {
    nameEl.textContent = normalized.name;
  }
  card.dataset.productName = normalized.name || (nameEl && nameEl.textContent.trim()) || "";
  card.dataset.productSalePrice = salePriceText || "";
  card.dataset.productUnitPrice = String(normalized.amount || "");
  card.dataset.productRegularPrice = regularPriceText || salePriceText || String(normalized.amount || "");
  card.dataset.productCouponCode = normalized.couponCode;
  card.dataset.productCouponDiscount = String(normalized.couponDiscount);

  if (salePriceEl && salePriceText) {
    salePriceEl.textContent = salePriceText;
  }
  if (originalPriceEl) {
    const hasDiscount = Boolean(regularPriceText && salePriceText && regularPriceText !== salePriceText);
    if (hasDiscount) {
      originalPriceEl.textContent = "\u20b9" + regularPriceText;
      originalPriceEl.setAttribute("aria-label", "Regular price \u20b9" + regularPriceText);
    }
    originalPriceEl.hidden = !hasDiscount;
  }
  if (ctaEl && salePriceText) {
    ctaEl.textContent = "Register at \u20b9" + salePriceText;
  }
  const ticketOption = document.querySelector('#reg-checkout-ticket option[value="' + card.dataset.productCode + '"]');
  if (ticketOption && salePriceText) {
    ticketOption.textContent = (normalized.name || card.dataset.productName || ticketOption.textContent.split("\u2014")[0].trim()) + " \u2014 \u20b9" + salePriceText;
  }
}
window.updateProductCard = updateProductCard;

function readProductCoupon(product) {
  if (!product) return { code: "", discount: 0 };
  const rawCode = product._coupon_code || product.coupon_code || (product.couponList && product.couponList[0] && product.couponList[0].default_coupon) || "";
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  const rawDiscount = product._amount_discounted ?? product.amount_discounted ?? product.discount ?? 0;
  const discount = Math.max(0, Number(rawDiscount) || 0);
  return { code, discount };
}

function setSelectedNiveshProduct(card, resetQuantity = true) {
  if (!card || !card.dataset.productUnitPrice) return;
  const nameEl = card.querySelector("[data-product-name]");
  const salePriceEl = card.querySelector("[data-product-sale-price]");
  const unitPrice = Number(card.dataset.productUnitPrice) || parsePrice(card.dataset.productSalePrice) || parsePrice(salePriceEl && salePriceEl.textContent);
  const regularPrice = parsePrice(card.dataset.productRegularPrice) || unitPrice;

  selectedNiveshProduct = {
    product_code: card.dataset.productCode || "",
    product_name: card.dataset.productName || (nameEl && nameEl.textContent.trim()) || "",
    product_price: card.dataset.productSalePrice || (salePriceEl && salePriceEl.textContent.trim()) || "",
    unit_price: unitPrice,
    rate_card_amount: regularPrice,
    selling_amount: unitPrice,
    discount: Math.max(0, regularPrice - unitPrice),
    coupon_code: card.dataset.productCouponCode || "",
    coupon_discount: Number(card.dataset.productCouponDiscount) || 0,
  };
  if (resetQuantity) checkoutState.quantity = NIVESH_MIN_QUANTITY;
  renderCheckout();
}

function getSelectedNiveshProduct() {
  if (selectedNiveshProduct) return selectedNiveshProduct;
  const firstCard = document.querySelector("[data-product-card][data-product-unit-price]");
  setSelectedNiveshProduct(firstCard);
  return selectedNiveshProduct;
}

function buildProductGrxFields() {
  const product = getSelectedNiveshProduct();
  if (!product) return {};
  const total = getCheckoutTotal();
  const totalRateCard = (Number(product.rate_card_amount) || Number(product.unit_price) || 0) * checkoutState.quantity;
  return {
    product_code: product.product_code || "",
    product_name: product.product_name || "",
    rate_card_amount: totalRateCard,
    selling_amount: total,
    discount: Math.max(0, totalRateCard - total),
    coupon_code: product.coupon_code || "",
  };
}

function getSelectedCoupon() {
  const product = getSelectedNiveshProduct();
  if (!product || !product.coupon_code) return null;
  return { code: product.coupon_code, discount: product.coupon_discount || 0 };
}

function getCheckoutDiscount() {
  const product = getSelectedNiveshProduct();
  if (!product) return 0;
  const rateCardAmount = Number(product.rate_card_amount) || Number(product.unit_price) || 0;
  const unitPrice = Number(product.unit_price) || 0;
  const perTicketDiscount = Math.max(0, rateCardAmount - unitPrice);
  return perTicketDiscount * checkoutState.quantity;
}

function initProductSelection() {
  document.querySelectorAll("[data-product-card] .tier-cta").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest("[data-product-card]");
      setSelectedNiveshProduct(card);
      window.trackGRX("select_tickets", {
        event_category: "click",
        product_code: (card && card.dataset.productCode) || "",
      }, "visitors");
    });
  });
}

function getCheckoutTotal() {
  const product = getSelectedNiveshProduct();
  const unitPrice = product ? Number(product.unit_price) || 0 : 0;
  return unitPrice * checkoutState.quantity;
}

function setCheckoutQuantity(quantity) {
  checkoutState.quantity = Math.min(
    NIVESH_MAX_QUANTITY,
    Math.max(NIVESH_MIN_QUANTITY, Number(quantity) || NIVESH_MIN_QUANTITY)
  );
  renderCheckout();
}

function renderCheckout() {
  const product = getSelectedNiveshProduct();
  if (!product) return;

  const nameEl = document.getElementById("checkout-product-name");
  const unitEl = document.getElementById("checkout-unit-price");
  const unitOriginalEl = document.getElementById("checkout-unit-price-original");
  const qtyEl = document.getElementById("checkout-qty-value");
  const discountRowEl = document.getElementById("checkout-discount-row");
  const discountEl = document.getElementById("checkout-discount");
  const totalEl = document.getElementById("checkout-total");
  const payBtn = document.getElementById("checkout-pay-btn");
  const decBtn = document.getElementById("checkout-qty-dec");
  const incBtn = document.getElementById("checkout-qty-inc");

  const unitPrice = Number(product.unit_price) || 0;
  const rateCardAmount = Number(product.rate_card_amount) || unitPrice;
  const discount = getCheckoutDiscount();
  const total = getCheckoutTotal();

  if (nameEl) nameEl.textContent = product.product_name || "Nivesh Baithak Pass";
  if (unitEl) unitEl.textContent = formatMoney(unitPrice);
  if (unitOriginalEl) {
    const showOriginal = rateCardAmount > unitPrice;
    unitOriginalEl.textContent = showOriginal ? formatMoney(rateCardAmount) : "";
    unitOriginalEl.hidden = !showOriginal;
  }
  if (qtyEl) qtyEl.textContent = String(checkoutState.quantity);
  if (discountRowEl) discountRowEl.hidden = discount <= 0;
  if (discountEl) discountEl.textContent = "−" + formatMoney(discount);
  if (totalEl) totalEl.textContent = formatMoney(total);
  if (payBtn) {
    payBtn.textContent = checkoutState.isPaying ? "Redirecting..." : "Pay Now " + formatMoney(total);
    payBtn.disabled = checkoutState.isPaying;
  }
  if (decBtn) decBtn.disabled = checkoutState.quantity <= NIVESH_MIN_QUANTITY;
  if (incBtn) incBtn.disabled = checkoutState.quantity >= NIVESH_MAX_QUANTITY;
}

function initCheckoutControls() {
  const decBtn = document.getElementById("checkout-qty-dec");
  const incBtn = document.getElementById("checkout-qty-inc");
  if (decBtn) decBtn.addEventListener("click", () => setCheckoutQuantity(checkoutState.quantity - 1));
  if (incBtn) incBtn.addEventListener("click", () => setCheckoutQuantity(checkoutState.quantity + 1));
}

function buildPaymentUrl(status, productCode, couponCode) {
  const url = window.NBTracking ? window.NBTracking.returnURL() : new URL(location.href);
  url.searchParams.delete("status");
  url.searchParams.delete("paymentReferenceID");
  url.searchParams.delete("pcode");
  url.searchParams.delete("ccode");
  url.searchParams.set("status", status);
  if (productCode) url.searchParams.set("pcode", productCode);
  if (couponCode) url.searchParams.set("ccode", couponCode);
  return url.toString();
}

function cleanPaymentParams() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("status");
    url.searchParams.delete("paymentReferenceID");
    url.searchParams.delete("pcode");
    url.searchParams.delete("ccode");
    window.history.replaceState({}, document.title, url.toString());
  } catch (error) {}
}

function buildServerGrxPayload(formData) {
  const platform = window.innerWidth < 768 ? "mweb" : "web";
  return {
    ssoid: formData.sso_id || "",
    grx_id: getPaymentEnv()?.grxApiKey || getPageConstants().grx_apikey || "",
    gid: typeof window.grx === "function" ? window.grx("getGID") || "" : "",
    platform,
    properties: pickGrxPayload({
      ...getGlobalLoginState(),
      ...formData,
      platform,
      event_category: "transaction",
      user_action: "payment-initiated",
    }),
  };
}

function submitSignedPaymentForm(signedPayload, env) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = env.apiBaseURL + "/pay";
  form.target = "_self";
  form.style.display = "none";

  Object.keys(signedPayload || {}).forEach((key) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = typeof signedPayload[key] === "object" ? JSON.stringify(signedPayload[key]) : String(signedPayload[key]);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  cleanPaymentParams();
  form.submit();
}

async function initiateNiveshPayment(formData, showError) {
  let product = getSelectedNiveshProduct();
  const before = JSON.stringify([product?.unit_price, product?.coupon_code]);
  try {
    if (typeof window.nbRefreshPrice === "function") {
      await window.nbRefreshPrice(product.product_code);
    }
  } catch (_) {
    throw new Error("Cannot verify the current price. Please try again.");
  }
  product = getSelectedNiveshProduct();
  if (before !== JSON.stringify([product.unit_price, product.coupon_code])) {
    showError("The ticket price has changed. Review the updated total and press Pay Now again.");
    return;
  }
  const env = getPaymentEnv();
  if (!product || !product.product_code) {
    showError("Please select a ticket to continue.");
    return;
  }
  if (!env || !env.langapiBaseURL || !env.apiBaseURL) {
    showError("Payment service is not configured. Please try again later.");
    return;
  }

  const coupon = getSelectedCoupon();
  const couponCode = coupon ? coupon.code : "";
  const total = getCheckoutTotal();
  const checkoutPayload = {
    ...formData,
    ...product,
    coupon_code: couponCode,
    quantity: checkoutState.quantity,
    amount: total,
    transaction_status: "initiated",
    payment_mode: "online",
    form_type: "register",
  };

  try {
    sessionStorage.setItem(NIVESH_CHECKOUT_KEY, JSON.stringify(checkoutPayload));
  } catch (error) {}

  window.trackGRX("paymentInitiated", checkoutPayload, "visitors");

  const paymentPayload = {
    first_name: formData.full_name || "Customer",
    pcode: product.product_code,
    mcode: getNiveshPaymentConfig().merchantKey || "",
    surl: buildPaymentUrl("success", product.product_code, couponCode),
    furl: buildPaymentUrl("failure", product.product_code, couponCode),
    purl: buildPaymentUrl("pending", product.product_code, couponCode),
    email: formData.email || "",
    phone: parseFloat(formData.phone_number) || formData.phone_number,
    product_code: product.product_code,
    si: 0,
    quantity: checkoutState.quantity,
    hostname: "prega",
    grx_payload: buildServerGrxPayload(checkoutPayload),
  };

  if (couponCode) paymentPayload.ccode = couponCode;

  const response = await fetch(env.langapiBaseURL + "/langapi/payment/get-pay-details", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(paymentPayload),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const signedPayload = await response.json();
  submitSignedPaymentForm(signedPayload, env);
}

function showPaymentStatusIfReturn() {
  const params = new URLSearchParams(location.search);
  const status = params.get("status");
  if (!["success", "failure", "pending"].includes(status)) return;
  const el = document.getElementById("statusMessage");
  if (el) {
    el.classList.remove("hidden");
    if (status === "failure") {
      el.textContent = "Payment was not completed. You can try again.";
    } else {
      el.textContent = "Returned from payment. Please check your ticket confirmation. If payment failed, you can register again.";
    }
  }
  const reference = params.get("paymentReferenceID");
  if (reference && window.NBTracking && typeof window.NBTracking.verifyPayment === "function") {
    window.NBTracking.verifyPayment(reference)
      .then((order) => {
        if (order && el) el.textContent = "Payment verified. Your booking is confirmed. Order: " + order.order_id;
      })
      .catch(() => {
        if (el) el.textContent = "We could not verify payment yet. Please check your ticket confirmation before trying again.";
      });
  }
  cleanPaymentParams();
}

initProductSelection();
initCheckoutControls();
if (typeof window.nbApplyPrices === "function") window.nbApplyPrices();

/* ── Modals Setup ── */
const modalBackdrops = [...document.querySelectorAll("[data-modal]")];
const modalByName = new Map(modalBackdrops.map((b) => [b.dataset.modal, b]));
const openModalButtons = document.querySelectorAll("[data-open-modal]");
const closeModalButtons = document.querySelectorAll("[data-close-modal]");
let activeBackdrop = null;
let activeElementBeforeModal = null;
let otpControllers = [];

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(scope) {
  return [...scope.querySelectorAll(focusableSelector)].filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  );
}

function getOtpControllerForModal(name) {
  const formId = name === "register" ? "registration-form" : name === "partner" ? "partner-form" : name === "nominate" ? "nominate-form" : null;
  if (!formId) return null;
  return otpControllers.find((controller) => controller.form && controller.form.id === formId) || null;
}

function getFormGrxControl(config) {
  const settings = (config && config.settings) || {};
  return { enabled: Boolean(settings.enable_grx) };
}

function resetFormState(scope) {
  scope.querySelectorAll("[data-demo-form]").forEach((f) => f.reset());
  scope.querySelectorAll("[data-form-error]").forEach((e) => {
    e.hidden = true;
    e.textContent = "";
  });
  scope.querySelectorAll("[data-form-success]").forEach((s) => (s.hidden = true));
}

function openModal(name) {
  const next = modalByName.get(name);
  if (!next) return;

  if (activeBackdrop && activeBackdrop !== next) {
    activeBackdrop.hidden = true;
    resetFormState(activeBackdrop);
  }

  activeElementBeforeModal = document.activeElement;
  activeBackdrop = next;
  activeBackdrop.hidden = false;
  document.body.classList.add("modal-open");

  if (name === "register") {
    const ticketSelect = document.getElementById("reg-checkout-ticket");
    const product = getSelectedNiveshProduct();
    if (ticketSelect && product && product.product_code) {
      ticketSelect.value = product.product_code;
    }
  }

  const controller = getOtpControllerForModal(name);
  if (controller && typeof controller.ensureGrxControl === "function") {
    controller.ensureGrxControl().then(() => {
      if (!controller.grxEnabled) return;
      window.trackGRX("modalOpen", { form_type: name }, "visitors");
    });
  } else {
    window.trackGRX("modalOpen", { form_type: name });
  }

  const modal = activeBackdrop.querySelector(".modal");
  const main = document.querySelector("main");
  const header = document.querySelector("header");
  const sticky = document.querySelector(".sticky-cta");
  if (main) main.inert = true;
  if (header) header.inert = true;
  if (sticky) sticky.inert = true;

  const first = modal.querySelector("input:not([disabled])") || modal;
  window.setTimeout(() => first.focus(), 0);
}

function closeModal() {
  if (!activeBackdrop) return;
  const main = document.querySelector("main");
  const header = document.querySelector("header");
  const sticky = document.querySelector(".sticky-cta");
  if (main) main.inert = false;
  if (header) header.inert = false;
  if (sticky) sticky.inert = false;

  const closing = activeBackdrop;
  closing.hidden = true;
  activeBackdrop = null;
  document.body.classList.remove("modal-open");
  if (activeElementBeforeModal && typeof activeElementBeforeModal.focus === "function") {
    activeElementBeforeModal.focus();
  }
}

function getFieldLabel(field) {
  const label = field.closest("label");
  return label?.querySelector("span")?.textContent?.trim() || "This field";
}

function showFormError(form, message, field) {
  const error = form.querySelector("[data-form-error]");
  const success = form.querySelector("[data-form-success]");
  if (success) success.hidden = true;
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  if (field && typeof field.focus === "function") field.focus();
}

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const required = [...form.querySelectorAll("[required]")];
  const invalid = required.find((f) => !f.validity.valid);
  const error = form.querySelector("[data-form-error]");
  const success = form.querySelector("[data-form-success]");

  if (invalid) {
    showFormError(form, `${getFieldLabel(invalid)} is required or has an invalid value.`, invalid);
    return;
  }

  if (error) {
    error.hidden = true;
    error.textContent = "";
  }
  if (success) {
    success.hidden = false;
    success.setAttribute("tabindex", "-1");
    success.focus({ preventScroll: true });
  }
  form.reset();
}

function handleModalKeydown(event) {
  if (!activeBackdrop || activeBackdrop.hidden) return;
  if (event.key === "Escape") {
    closeModal();
    return;
  }
  if (event.key !== "Tab") return;

  const modal = activeBackdrop.querySelector(".modal");
  const focusable = getFocusableElements(modal);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function trackNavClick(btn) {
  const modalName = btn.dataset.openModal;
  if (!modalName) return;
  const section = btn.dataset.navSection || "others";
  if (section === "ticket_section" && btn.dataset.ticketTier) {
    const card = btn.closest("[data-product-card]");
    window.trackGRX(
      `${modalName}-ticket_section_${btn.dataset.ticketTier}-click`,
      {
        event_category: "click",
        product_code: (card && card.dataset.productCode) || "",
      },
      "visitors"
    );
    return;
  }
  window.trackGRX(`${modalName}-${section}-click`, { event_category: "click" }, "visitors");
}

openModalButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    trackNavClick(btn);
    openModal(btn.dataset.openModal);
  })
);
closeModalButtons.forEach((btn) => btn.addEventListener("click", closeModal));
modalBackdrops.forEach((backdrop) =>
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  })
);
document.addEventListener("keydown", handleModalKeydown);
document.querySelectorAll("[data-demo-form]").forEach((form) => form.addEventListener("submit", handleFormSubmit));

/* ── Mobile OTP Login Controller ── */
(function () {
  const PHONE_REGEX = /^[6-9]\d{9}$/;
  const OTP_REGEX = /^\d{6}$/;
  const OTP_RESEND_SECONDS = 60;
  const OTP_MAX_RESENDS = 3;
  const STATUS_CODES = {
    VERIFIED: [212, 213],
    UNREGISTERED: [214, 215],
    UNVERIFIED: [205, 206],
  };

  function loadVerifiedSession() {
    try {
      const raw = sessionStorage.getItem(NIVESH_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.phone || !parsed.verified) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function saveVerifiedSession(session) {
    try {
      const existing = loadVerifiedSession() || {};
      const merged = {
        phone: (session && session.phone) || existing.phone || "",
        ssoId: (session && session.ssoId) || existing.ssoId || "",
        verified: true,
        productCode: (session && session.productCode) || existing.productCode || "",
        profile: { ...(existing.profile || {}), ...((session && session.profile) || {}) },
        meta: { ...(existing.meta || {}), ...((session && session.meta) || {}) },
      };
      sessionStorage.setItem(NIVESH_SESSION_KEY, JSON.stringify(merged));
    } catch (error) {}
  }

  function mapAnswersToProfile(config, answers) {
    const profile = {};
    const meta = {};
    ((config && config.fields) || []).forEach((field) => {
      const mapping = field.participant_mapping;
      if (!mapping || !mapping.map_to || mapping.map_to === "phone") return;
      const value = (answers || {})[field.field_id];
      if (value === undefined || value === null || value === "") return;
      if (mapping.map_to === "meta_json" && mapping.meta_key) {
        meta[mapping.meta_key] = value;
      } else {
        profile[mapping.map_to] = value;
      }
    });
    return { profile, meta };
  }

  const constants = (() => {
    try {
      return JSON.parse(document.body.dataset.constants || "{}");
    } catch (error) {
      return {};
    }
  })();

  let sdkReady = false;

  function getPlatform() {
    const params = new URLSearchParams(window.location.search);
    return params.get("platform") || (window.innerWidth < 768 ? "mweb" : "web");
  }

  function waitForJssoRef() {
    if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") {
      sdkReady = true;
      return;
    }
    window.addEventListener("jssoScriptLoaded", () => {
      if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") sdkReady = true;
    }, { once: true });
    let tries = 0;
    const poll = setInterval(() => {
      if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") {
        clearInterval(poll);
        sdkReady = true;
      }
      if (++tries > 50) clearInterval(poll);
    }, 100);
  }

  function initializeOtpSdk() {
    if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") {
      sdkReady = true;
      return;
    }
    if (typeof window.LoginSupporter !== "function") return;
    try {
      window.loginSupporter = new window.LoginSupporter({
        config: {
          channel: constants.login_channel || constants.channel || "nbt",
          platform: getPlatform(),
          useProdScript: true,
          loginOptions: ["mobile"],
        },
      });
      window.loginSupporter.initialize(function () {
        if (window.loginSupporter && typeof window.loginSupporter.returnJSsoObject === "function") {
          window.jssoRef = window.loginSupporter.returnJSsoObject();
        }
        if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") {
          sdkReady = true;
        }
      });
      waitForJssoRef();
    } catch (error) {
      sdkReady = false;
    }
  }

  function ensureLoginSupporter() {
    if (window.LoginSupporter) {
      initializeOtpSdk();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const el = document.createElement("script");
      el.src = "https://navbharattimes.indiatimes.com/campaignhub/minifyjs/login/loginSupporter.js";
      el.async = true;
      el.onload = () => {
        initializeOtpSdk();
        resolve();
      };
      el.onerror = () => resolve();
      document.head.appendChild(el);
    });
  }

  // Pre-load LoginSupporter asynchronously
  ensureLoginSupporter();

  async function waitForSdk(timeoutMs = 4000) {
    const started = Date.now();
    if (!window.LoginSupporter && !window.jssoRef) {
      ensureLoginSupporter();
    }
    while (Date.now() - started < timeoutMs) {
      if (window.jssoRef && typeof window.jssoRef.checkUserExists === "function") {
        sdkReady = true;
        return true;
      }
      if (!sdkReady && typeof window.LoginSupporter === "function") {
        initializeOtpSdk();
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
  }

  async function sdkCall(methodName, ...args) {
    const ready = await waitForSdk();
    if (!ready || !window.jssoRef || typeof window.jssoRef[methodName] !== "function") {
      throw new Error("OTP service unavailable");
    }
    return new Promise((resolve, reject) => {
      try {
        window.jssoRef[methodName](...args, (resp) => resolve(resp));
      } catch (error) {
        reject(error);
      }
    });
  }

  function getStatusCode(resp) {
    return Number(resp && (resp.code || resp.statusCode || resp.status || resp.responseCode));
  }

  function isOtpDispatchSuccess(resp) {
    const code = getStatusCode(resp);
    if (code >= 200 && code < 300) return true;
    const message = `${(resp && (resp.message || resp.statusText)) || ""}`.toLowerCase();
    return message.includes("otp") && (message.includes("sent") || message.includes("generated"));
  }

  function isRegisterOtpDispatchSuccess(resp) {
    const code = getStatusCode(resp);
    return code === 200 || code === 429 || isOtpDispatchSuccess(resp);
  }

  function isOtpVerifySuccess(resp) {
    const code = getStatusCode(resp);
    if (code >= 200 && code < 300) return true;
    const message = `${(resp && (resp.message || resp.statusText)) || ""}`.toLowerCase();
    return message.includes("success") || message.includes("verified");
  }

  function extractSsoId(resp) {
    if (!resp) return null;
    return (
      (resp.data && (resp.data.ssoid || resp.data.ssoId || resp.data.userId)) ||
      (resp.data && resp.data.data && (resp.data.data.ssoid || resp.data.data.ssoId || resp.data.data.userId)) ||
      resp.ssoid ||
      resp.ssoId ||
      resp.userId ||
      null
    );
  }

  async function verifySignUpOtp(phone, ssoId, otp) {
    const ref = window.jssoRef || {};
    if (typeof ref.verifySignUpOTP === "function") {
      try {
        return await sdkCall("verifySignUpOTP", { mobile: phone, ssoid: ssoId, otp });
      } catch (_) {
        return sdkCall("verifySignUpOTP", phone, ssoId, otp);
      }
    }
    if (typeof ref.verifyMobileSignUp === "function") return sdkCall("verifyMobileSignUp", phone, ssoId, otp);
    throw new Error("Signup OTP verification service unavailable.");
  }

  async function resendSignUpOtp(phone, ssoId) {
    const ref = window.jssoRef || {};
    if (typeof ref.resendMobileSignUpOtp === "function") return sdkCall("resendMobileSignUpOtp", phone, ssoId);
    throw new Error("Unable to resend signup OTP.");
  }

  async function warmUserDetails() {
    const ref = window.jssoRef || {};
    if (typeof ref.getUserDetails !== "function") return null;
    return sdkCall("getUserDetails");
  }

  function digitsOnly(input, maxLength) {
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = String(input.value || "").replace(/\D/g, "").slice(0, maxLength);
    });
  }

  function createOtpController(formId, prefix) {
    const form = document.getElementById(formId);
    if (!form) return null;

    const phoneInput = document.getElementById(`${prefix}-phone-input`);
    const sendBtn = document.getElementById(`${prefix}-send-otp-btn`);
    const otpInput = document.getElementById(`${prefix}-otp-input`);
    const verifyBtn = document.getElementById(`${prefix}-verify-otp-btn`);
    const resendBtn = document.getElementById(`${prefix}-resend-otp-btn`);
    const changePhoneBtn = document.getElementById(`${prefix}-change-phone-btn`);
    const statusPhoneEl = document.getElementById(`${prefix}-otp-status-phone`);
    const statusOtpEl = document.getElementById(`${prefix}-otp-status-otp`);
    const phoneVerifiedBadge = document.getElementById(`${prefix}-phone-verified-badge`);
    const otpStepEl = form.querySelector("[data-otp-step]");
    const fieldsContainer = form.querySelector("[data-form-code]");
    const formCode = fieldsContainer ? fieldsContainer.dataset.formCode : null;
    const ticketSelect = form.querySelector("#reg-checkout-ticket");
    const consentInput = form.querySelector('[name="consent"]');
    const formErrorEl = form.querySelector("[data-form-error]");
    const submitBtn = form.querySelector('button[type="submit"]');
    const submitBtnLabel = submitBtn ? submitBtn.textContent : "";
    const successView = form.querySelector('[data-otp-view="success"]');
    const successCloseBtn = successView ? successView.querySelector("[data-close-modal]") : null;
    const formType = formId === "registration-form" ? "register" : formId === "nominate-form" ? "nominate" : "partner";
    let grxControl = { enabled: false };
    const views = {};
    form.querySelectorAll("[data-otp-view]").forEach((el) => {
      views[el.dataset.otpView] = el;
    });

    digitsOnly(phoneInput, 10);
    digitsOnly(otpInput, 6);

    let formHandle = null;
    const grxControlPromise =
      formCode && window.EventFormRenderer && typeof window.EventFormRenderer.fetchConfig === "function"
        ? window.EventFormRenderer.fetchConfig(formCode, { fetchBaseUrl: EVENTHUB_FORM_FETCH_BASE }).catch(() => null)
        : null;

    const state = {
      currentView: "phone",
      phone: "",
      ssoId: null,
      isRegistrationFlow: false,
      isOtpVerified: false,
      resendTimerRef: null,
      resendRemaining: 0,
      resendClicks: 0,
    };

    function showView(name) {
      state.currentView = name;
      const topLevel = name === "phone" || name === "otp" ? "details" : name;
      Object.keys(views).forEach((key) => {
        views[key].classList.toggle("is-active", key === topLevel);
      });
      if (phoneInput) phoneInput.disabled = name !== "phone";
      if (sendBtn) sendBtn.hidden = name !== "phone";
      if (verifyBtn) verifyBtn.hidden = name !== "otp";
      if (otpStepEl) otpStepEl.hidden = name !== "otp";
      if (phoneVerifiedBadge) phoneVerifiedBadge.hidden = name !== "details";
      form.classList.toggle("is-entering-otp", name === "otp");
      form.classList.toggle("is-otp-verified", name === "details");
    }

    function showStatus(message, type) {
      const el = state.currentView === "otp" ? statusOtpEl : statusPhoneEl;
      if (!el) return;
      el.textContent = message || "";
      el.classList.remove("is-error", "is-success", "is-info");
      if (type) el.classList.add(`is-${type}`);
    }

    function clearResendTimer() {
      if (state.resendTimerRef) clearInterval(state.resendTimerRef);
      state.resendTimerRef = null;
    }

    function updateResendButton() {
      if (!resendBtn) return;
      if (state.resendClicks >= OTP_MAX_RESENDS) {
        resendBtn.disabled = true;
        resendBtn.textContent = "Resend limit reached";
        return;
      }
      if (state.resendRemaining > 0) {
        resendBtn.disabled = true;
        resendBtn.textContent = `Resend OTP (${state.resendRemaining}s)`;
      } else {
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend OTP";
      }
    }

    function startResendTimer() {
      clearResendTimer();
      state.resendRemaining = OTP_RESEND_SECONDS;
      updateResendButton();
      state.resendTimerRef = setInterval(() => {
        state.resendRemaining -= 1;
        if (state.resendRemaining <= 0) {
          clearResendTimer();
          state.resendRemaining = 0;
        }
        updateResendButton();
      }, 1000);
    }

    function showDetailsError(message) {
      const activeView = views[state.currentView];
      const el = (activeView && activeView.querySelector("[data-form-error]")) || formErrorEl;
      if (el) {
        el.textContent = message || "";
        el.hidden = !message;
      }
    }

    function validateNameEmail() {
      if (!formHandle) {
        showDetailsError("Form is still loading. Please wait.");
        return null;
      }
      const { answers, firstError } = formHandle.collect();
      if (firstError) {
        showDetailsError(firstError.message);
        if (firstError.control) firstError.control.focus();
        return null;
      }
      const fullName = (answers.full_name || "").trim();
      const email = (answers.email || "").trim();
      return { fullName, email, answers };
    }

    function buildRegistrationPaymentData() {
      const validated = validateNameEmail();
      if (!validated) return null;
      const { fullName, email, answers } = validated;

      if (consentInput && !consentInput.checked) {
        showDetailsError("Please accept the consent checkbox to continue.");
        consentInput.focus();
        return null;
      }

      const ssoId =
        state.ssoId ||
        (window.loginSupporter && window.loginSupporter.userDetails && window.loginSupporter.userDetails.ssoid) ||
        "";

      return {
        ...answers,
        full_name: fullName,
        name: fullName,
        email: email.toLowerCase(),
        phone_number: state.phone,
        phone: state.phone,
        sso_id: ssoId,
        host_url: window.location.href,
        current_city: answers.city || "",
        profile_type: answers.investor_profile || "",
      };
    }

    function syncGrxControl(config) {
      grxControl = getFormGrxControl(config || (formHandle && formHandle.config));
      return grxControl;
    }

    async function ensureGrxControl() {
      if (grxControl.enabled || !grxControlPromise) return grxControl;
      const config = await grxControlPromise;
      if (config) syncGrxControl(config);
      return grxControl;
    }

    function buildGrxPayload(extra) {
      const payload = {
        form_type: formType,
        host_url: window.location.href,
        page_url: window.location.href,
        page_path: window.location.pathname,
        platform: window.innerWidth < 768 ? "mweb" : "web",
        terms_privacy_opti_in: "yes",
        ...(extra || {}),
      };

      if (!formHandle || !formHandle.config || !grxControl.enabled) return payload;

      const collected = formHandle.collect ? formHandle.collect() : { answers: {} };
      const answers = collected.answers || {};

      (formHandle.config.fields || []).forEach((field) => {
        const sync = field.grx_sync || {};
        if (!sync.enabled || !sync.key) return;
        const value = field.field_type === "phone" ? state.phone || answers[field.field_id] || "" : answers[field.field_id] || "";
        if (!value) return;
        payload[sync.key] = value;
      });

      if (formType === "partner") {
        if (answers.interest) payload.interest = answers.interest;
        if (answers.message) payload.note = answers.message;
      }

      if (formType === "register") {
        if (answers.investor_profile) payload.profile_type = answers.investor_profile;
        Object.assign(payload, buildProductGrxFields());
      }

      return payload;
    }

    function applyStoredProfile(handle) {
      const session = loadVerifiedSession();
      if (!handle || !session) return;
      const profile = session.profile || {};
      const meta = session.meta || {};
      (handle.fields || []).forEach((field) => {
        const mapping = field.participant_mapping;
        if (!mapping || !mapping.map_to) return;
        const value = mapping.map_to === "meta_json" && mapping.meta_key ? meta[mapping.meta_key] : profile[mapping.map_to];
        if (value === undefined || value === null || value === "") return;
        const control = fieldsContainer.querySelector(`#efr-${field.field_id}`);
        if (control && !control.value) control.value = value;
      });
    }

    function persistFormAnswers(answers) {
      const mapped = mapAnswersToProfile(formHandle && formHandle.config, answers);
      saveVerifiedSession({
        phone: state.phone,
        ssoId: state.ssoId,
        profile: mapped.profile,
        meta: mapped.meta,
        productCode: ticketSelect ? ticketSelect.value : "",
      });
    }

    function persistSelectedTicket(productCode) {
      if (!ticketSelect || !productCode) return;
      saveVerifiedSession({
        phone: state.phone,
        ssoId: state.ssoId,
        productCode,
      });
    }

    async function mountDetailsForm() {
      if (!fieldsContainer || !formCode || !window.EventFormRenderer) return;
      formHandle = null;
      showDetailsError("");
      fieldsContainer.textContent = "Loading form...";
      try {
        formHandle = await window.EventFormRenderer.mount(fieldsContainer, formCode, {
          fetchBaseUrl: EVENTHUB_FORM_FETCH_BASE,
          submitBaseUrl: EVENTHUB_FORM_SUBMIT_URL,
          prefillByType: { phone: state.phone },
        });
        syncGrxControl(formHandle && formHandle.config);
        fieldsContainer.querySelectorAll(".efr-field").forEach((fieldEl) => {
          const control = fieldEl.querySelector(".efr-control");
          if (control && control.name) fieldEl.dataset.fieldId = control.name;
        });
        applyStoredProfile(formHandle);
      } catch (error) {
        fieldsContainer.textContent = "";
        showDetailsError(error.message || "Unable to load form fields. Please try again.");
      }
    }

    let savingDetails = false;
    async function saveDetailsAndProceed() {
      if (savingDetails) return;
      await ensureGrxControl();
      showDetailsError("");
      if (!state.isOtpVerified) {
        showDetailsError("Please verify your mobile number with OTP before continuing.");
        if (phoneInput) phoneInput.focus();
        return;
      }
      if (formId !== "registration-form") {
        return submitDetails();
      }
      const validated = validateNameEmail();
      if (!validated) return;

      savingDetails = true;
      if (saveNextBtn) {
        saveNextBtn.disabled = true;
        saveNextBtn.textContent = "Saving...";
      }
      try {
        const submission = await formHandle.submit({ phone_number: state.phone });
        if (window.NBTracking?.lead) {
          window.NBTracking.lead(
            submission && (submission.submission_id || submission.id || submission._id || submission.data?.submission_id || submission.data?.id || submission.data?._id),
            getSelectedNiveshProduct()
          );
        }
        persistFormAnswers(formHandle.collect().answers);
        syncGrxControl();
        if (grxControl.enabled) {
          window.trackGRX(
            "formSubmit",
            buildGrxPayload({
              submission_id: submission && (submission.submission_id || submission.id || submission._id || ""),
              submission_status: "success",
            }),
            "event"
          );
        }
        showView("product-detail");
        renderCheckout();
        if (window.NBTracking?.beginCheckout) {
          window.NBTracking.beginCheckout(getSelectedNiveshProduct(), checkoutState.quantity);
        }
      } catch (error) {
        showDetailsError(error.message || "Unable to save your details. Please try again.");
      } finally {
        savingDetails = false;
        if (saveNextBtn) {
          saveNextBtn.disabled = false;
          saveNextBtn.textContent = "Continue to payment";
        }
      }
    }

    async function submitDetails() {
      await ensureGrxControl();
      if (formId === "registration-form") {
        const formData = buildRegistrationPaymentData();
        if (!formData) return;
        showDetailsError("");
        if (submitBtn) {
          submitBtn.disabled = true;
          checkoutState.isPaying = true;
          renderCheckout();
        }
        try {
          await initiateNiveshPayment(formData, showDetailsError);
        } catch (error) {
          showDetailsError(error.message || "Unable to start payment. Please try again.");
          window.trackGRX(
            "paymentFailure",
            {
              ...formData,
              error_message: error.message || "Unable to start payment. Please try again.",
              transaction_status: "failed",
            },
            "visitors"
          );
        } finally {
          checkoutState.isPaying = false;
          renderCheckout();
        }
        return;
      }

      if (!formHandle) {
        showDetailsError("Form is still loading. Please wait.");
        return;
      }
      if (!state.isOtpVerified) {
        showDetailsError("Please verify your mobile number with OTP before submitting.");
        if (phoneInput) phoneInput.focus();
        return;
      }
      if (consentInput && !consentInput.checked) {
        showDetailsError("Please accept the consent checkbox to continue.");
        return;
      }
      showDetailsError("");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }
      try {
        const submission = await formHandle.submit({ phone_number: state.phone });
        persistFormAnswers(formHandle.collect().answers);
        syncGrxControl();
        if (grxControl.enabled) {
          window.trackGRX(
            "formSubmit",
            buildGrxPayload({
              submission_id: submission && (submission.submission_id || submission.id || submission._id || ""),
              submission_status: "success",
            }),
            "event"
          );
        }
        showView("success");
        if (successCloseBtn) {
          window.setTimeout(() => successCloseBtn.focus({ preventScroll: true }), 0);
        }
      } catch (error) {
        showDetailsError(error.message || "Unable to submit. Please try again.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtnLabel;
        }
      }
    }

    async function sendOtp() {
      await ensureGrxControl();
      if (!sdkReady) {
        await waitForSdk(4000);
      }
      if (!sdkReady) {
        showStatus("OTP service not ready. Please wait...", "info");
        return;
      }
      const phone = ((phoneInput && phoneInput.value) || "").trim();
      if (!PHONE_REGEX.test(phone)) {
        showStatus("Enter a valid 10-digit mobile number.", "error");
        return;
      }

      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "Sending...";
      }
      try {
        const checkResp = await sdkCall("checkUserExists", phone);
        if (!checkResp || checkResp.code !== 200) throw new Error("Could not validate user. Try again.");
        const checkStatus = Number((checkResp.data && checkResp.data.statusCode) || 0);
        state.phone = phone;

        if (STATUS_CODES.VERIFIED.includes(checkStatus)) {
          state.isRegistrationFlow = false;
          state.ssoId = null;
          const otpResp = await sdkCall("getMobileLoginOtp", phone);
          if (!isOtpDispatchSuccess(otpResp)) throw new Error("Unable to send OTP");
        } else if (
          STATUS_CODES.UNREGISTERED.includes(checkStatus) ||
          STATUS_CODES.UNVERIFIED.includes(checkStatus)
        ) {
          state.isRegistrationFlow = true;
          const registerResp = await sdkCall(
            "registerUser", "Member", "", "", "", "", phone, "123Times@", false, "1", "0", "0", "", ""
          );
          state.ssoId = extractSsoId(registerResp) || extractSsoId(checkResp);
          if (!isRegisterOtpDispatchSuccess(registerResp)) throw new Error("Unable to send OTP");
        } else {
          throw new Error("Unable to initiate OTP. Please try again.");
        }

        showView("otp");
        if (statusPhoneEl) {
          statusPhoneEl.textContent = "";
          statusPhoneEl.classList.remove("is-error", "is-success", "is-info");
        }
        state.resendClicks = 0;
        syncGrxControl();
        if (grxControl.enabled) {
          window.trackGRX("otpSendClick", { form_type: formType, phone_number: phone }, "visitors");
          window.trackGRX("otpSent", {
            form_type: formType,
            phone_number: state.phone,
            is_registration_flow: String(state.isRegistrationFlow),
          }, "visitors");
        }
        startResendTimer();
        if (otpInput) otpInput.focus();
      } catch (error) {
        showStatus(error.message || "Unable to send OTP. Please try again.", "error");
      } finally {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = "Send OTP";
        }
      }
    }

    async function verifyOtp() {
      await ensureGrxControl();
      const otp = ((otpInput && otpInput.value) || "").trim();
      if (!OTP_REGEX.test(otp)) {
        if (grxControl.enabled) {
          window.trackGRX("otpVerifyFailure", {
            form_type: formType,
            phone_number: state.phone || "",
            error_message: "Enter valid 6-digit OTP.",
          }, "visitors");
        }
        showStatus("Enter valid 6-digit OTP.", "error");
        return;
      }

      if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";
      }
      try {
        let verifyResp;
        if (state.isRegistrationFlow || state.ssoId) {
          if (!state.ssoId) throw new Error("Unable to verify OTP. Please request OTP again.");
          verifyResp = await verifySignUpOtp(state.phone, state.ssoId, otp);
        } else {
          verifyResp = await sdkCall("verifyMobileLogin", state.phone, otp);
        }
        if (!isOtpVerifySuccess(verifyResp)) throw new Error("Invalid OTP. Please try again.");

        await warmUserDetails();
        state.isOtpVerified = true;
        clearResendTimer();
        saveVerifiedSession({ phone: state.phone, ssoId: state.ssoId });
        showView("details");
        if (grxControl.enabled) {
          window.trackGRX("otpVerifySuccess", {
            form_type: formType,
            phone_number: state.phone,
            is_registration_flow: String(state.isRegistrationFlow),
          }, "visitors");
        }
        if (formId === "registration-form") {
          renderCheckout();
        }
      } catch (error) {
        if (grxControl.enabled) {
          window.trackGRX("otpVerifyFailure", {
            form_type: formType,
            phone_number: state.phone || (otpInput && otpInput.value) || "",
            error_message: error.message || "OTP verification failed.",
          }, "visitors");
        }
        showStatus(error.message || "OTP verification failed.", "error");
      } finally {
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = "Verify OTP";
        }
      }
    }

    async function resendOtp() {
      await ensureGrxControl();
      if (!state.phone) {
        showStatus("Enter phone number first.", "error");
        return;
      }
      if (state.resendRemaining > 0 || state.resendClicks >= OTP_MAX_RESENDS) return;

      if (resendBtn) resendBtn.disabled = true;
      try {
        let otpResp;
        if (state.isRegistrationFlow) {
          if (!state.ssoId) throw new Error("Unable to resend OTP.");
          otpResp = await resendSignUpOtp(state.phone, state.ssoId);
        } else {
          otpResp = await sdkCall("getMobileLoginOtp", state.phone);
        }
        if (!isOtpDispatchSuccess(otpResp)) throw new Error("Unable to resend OTP. Please try again.");
        state.resendClicks += 1;
        startResendTimer();
        showStatus("OTP resent.", "success");
        syncGrxControl();
        if (grxControl.enabled) {
          window.trackGRX("otpResend", { form_type: formType, phone_number: state.phone }, "visitors");
        }
      } catch (error) {
        showStatus(error.message || "Unable to resend OTP.", "error");
      } finally {
        updateResendButton();
      }
    }

    function goBackToPhoneStep() {
      state.isOtpVerified = false;
      state.ssoId = null;
      state.isRegistrationFlow = false;
      state.resendClicks = 0;
      clearResendTimer();
      if (otpInput) otpInput.value = "";
      showDetailsError("");
      showView("phone");
      showStatus("", null);
      if (formId === "registration-form") {
        checkoutState.quantity = NIVESH_MIN_QUANTITY;
        checkoutState.isPaying = false;
        renderCheckout();
      }
    }

    function hydrateFromSession(session) {
      clearResendTimer();
      state.phone = session.phone;
      state.ssoId = session.ssoId || null;
      state.isOtpVerified = true;
      state.isRegistrationFlow = false;
      state.resendClicks = 0;
      if (phoneInput) phoneInput.value = state.phone;
      showDetailsError("");
      showStatus("", null);
      showView("details");
      if (formId === "registration-form") {
        checkoutState.quantity = NIVESH_MIN_QUANTITY;
        checkoutState.isPaying = false;
        renderCheckout();
      }
      applyStoredProfile(formHandle);
    }

    function reset() {
      const session = loadVerifiedSession();
      if (session) {
        hydrateFromSession(session);
        return;
      }
      goBackToPhoneStep();
      if (phoneInput) phoneInput.value = "";
      state.phone = "";
    }

    if (sendBtn) sendBtn.addEventListener("click", sendOtp);
    if (verifyBtn) verifyBtn.addEventListener("click", verifyOtp);
    if (resendBtn) resendBtn.addEventListener("click", resendOtp);
    if (changePhoneBtn) changePhoneBtn.addEventListener("click", goBackToPhoneStep);

    const saveNextBtn = form.querySelector(`#${prefix}-save-next-btn`);
    const backBtn = form.querySelector("#checkout-back-btn");
    if (saveNextBtn) saveNextBtn.addEventListener("click", saveDetailsAndProceed);
    if (backBtn) backBtn.addEventListener("click", () => showView("details"));
    if (ticketSelect) {
      ticketSelect.addEventListener("change", () => {
        const card = document.querySelector('[data-product-card][data-product-code="' + ticketSelect.value + '"]');
        if (card) setSelectedNiveshProduct(card);
        persistSelectedTicket(ticketSelect.value);
      });
    }

    mountDetailsForm();

    return {
      form,
      sendOtp,
      verifyOtp,
      submitDetails,
      saveDetails: saveDetailsAndProceed,
      showStatus,
      reset,
      ensureGrxControl,
      get grxEnabled() {
        return grxControl.enabled;
      },
      get currentView() {
        return state.currentView;
      },
      get isVerified() {
        return state.isOtpVerified;
      },
    };
  }

  function initOtpLogin() {
    initializeOtpSdk();

    otpControllers = [
      createOtpController("registration-form", "reg"),
      createOtpController("partner-form", "partner"),
      createOtpController("nominate-form", "nominate"),
    ].filter(Boolean);
    if (!otpControllers.length) return;

    document.querySelectorAll("[data-open-modal]").forEach((btn) => {
      const name = btn.dataset.openModal;
      const formId = name === "register" ? "registration-form" : name === "partner" ? "partner-form" : name === "nominate" ? "nominate-form" : null;
      const controller = otpControllers.find((c) => c.form.id === formId);
      if (controller) {
        btn.addEventListener("click", () => {
          if (!controller.isVerified) controller.reset();
        });
      }
    });

    document.addEventListener(
      "submit",
      (event) => {
        const controller = otpControllers.find((c) => c.form === event.target);
        if (!controller) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        if (controller.currentView === "phone") {
          controller.sendOtp();
          return;
        }
        if (controller.currentView === "otp") {
          controller.verifyOtp();
          return;
        }
        if (controller.currentView === "product-detail") {
          controller.submitDetails();
          return;
        }
        controller.saveDetails();
      },
      true
    );
  }

  initOtpLogin();
  showPaymentStatusIfReturn();
})();

/* ── 6. Hero Section Countdown & Expert Showcase Carousel ── */
(() => {
  "use strict";

  // --- Countdown Timer ---
  function initHeroCountdown() {
    const daysEl = document.getElementById("cd-days");
    const hoursEl = document.getElementById("cd-hours");
    const minutesEl = document.getElementById("cd-minutes");
    if (!daysEl || !hoursEl || !minutesEl) return;

    // Event Date: September 27, 2026, 10:00:00 AM IST
    const eventTime = new Date("2026-09-27T10:00:00+05:30").getTime();

    function updateCountdown() {
      const now = Date.now();
      const diff = eventTime - now;

      if (diff <= 0) {
        daysEl.textContent = "00";
        hoursEl.textContent = "00";
        minutesEl.textContent = "00";
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      daysEl.textContent = String(days).padStart(2, "0");
      hoursEl.textContent = String(hours).padStart(2, "0");
      minutesEl.textContent = String(minutes).padStart(2, "0");
    }

    updateCountdown();
    setInterval(updateCountdown, 60000);
  }

  // --- Hero Expert Showcase Carousel ---
  function initHeroShowcase() {
    const imgEl = document.getElementById("showcase-img");
    const nameEl = document.getElementById("showcase-name");
    const roleEl = document.getElementById("showcase-role");
    const dotsContainer = document.getElementById("showcase-dots");

    if (!imgEl || !nameEl || !roleEl || !dotsContainer) return;

    // Extract speakers from the speaker section
    const speakerCards = document.querySelectorAll("#speakers .speaker-card");
    const speakers = [];

    speakerCards.forEach((card) => {
      const img = card.querySelector("img");
      const name = card.querySelector(".speaker-name, h3");
      const role = card.querySelector(".speaker-role, p");
      if (img && name) {
        speakers.push({
          imgSrc: img.getAttribute("src") || img.src,
          imgAlt: img.getAttribute("alt") || name.textContent.trim(),
          name: name.textContent.trim(),
          role: role ? role.textContent.trim() : ""
        });
      }
    });

    if (speakers.length === 0) return;

    // Generate pagination dots
    dotsContainer.innerHTML = "";
    speakers.forEach((_, idx) => {
      const dot = document.createElement("button");
      dot.className = `showcase-dot ${idx === 0 ? "active" : ""}`;
      dot.setAttribute("type", "button");
      dot.setAttribute("aria-label", `Slide ${idx + 1}`);
      dot.addEventListener("click", () => {
        currentIndex = idx;
        renderSpeaker(currentIndex);
        resetTimer();
      });
      dotsContainer.appendChild(dot);
    });

    let currentIndex = 0;
    let timer = null;

    function renderSpeaker(index) {
      const speaker = speakers[index];
      if (!speaker) return;

      imgEl.style.opacity = "0.5";
      setTimeout(() => {
        imgEl.src = speaker.imgSrc;
        imgEl.alt = speaker.imgAlt;
        nameEl.textContent = speaker.name;
        roleEl.textContent = speaker.role;
        imgEl.style.opacity = "1";
      }, 150);

      const dots = dotsContainer.querySelectorAll(".showcase-dot");
      dots.forEach((dot, dIdx) => {
        dot.classList.toggle("active", dIdx === index);
      });
    }

    function nextSpeaker() {
      currentIndex = (currentIndex + 1) % speakers.length;
      renderSpeaker(currentIndex);
    }

    function resetTimer() {
      if (timer) clearInterval(timer);
      timer = setInterval(nextSpeaker, 4000);
    }

    // Initial render & timer start
    renderSpeaker(0);
    resetTimer();

    // Pause on hover
    const showcaseCard = document.querySelector(".showcase-card");
    if (showcaseCard) {
      showcaseCard.addEventListener("mouseenter", () => {
        if (timer) clearInterval(timer);
      });
      showcaseCard.addEventListener("mouseleave", () => {
        resetTimer();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initHeroCountdown();
      initHeroShowcase();
    });
  } else {
    initHeroCountdown();
    initHeroShowcase();
  }
})();
