/**
 * Nivesh Baithak Surat — Partners, Expo & Sponsors Lead Generation Form Handler
 */
(() => {
  "use strict";

  // Configuration & Endpoints
  const SUBMIT_ENDPOINT = "https://api.indiatimes.com/eventhub/api/public/form-submissions";
  const STORAGE_KEY = "nb_partner_leads_v1";

  // Data Definition
  const PARTNERSHIP_OPTIONS = [
    { id: "expo", label: "Expo / Exhibition Booth" },
    { id: "partner", label: "Strategic Partner" },
    { id: "sponsor", label: "Event Sponsor (Title / Powered By / Category)" }
  ];

  const INDUSTRY_OPTIONS = [
    "Stockbroking, Trading & Investment Platforms",
    "Mutual Funds, Wealth Management & Financial Advisory",
    "Banks, NBFCs, Loans & Financial Services",
    "Insurance, Pension & Retirement Planning",
    "Bonds, Fixed Income & Alternative Investments",
    "Real Estate, Property Investment & Infrastructure",
    "Gold, Silver, Bullion & Precious Metals",
    "Fintech, Digital Payments & Financial Technology",
    "MSMEs, Startups, Corporates & Business Services",
    "Other (Please Specify)"
  ];

  // State
  const selectedTypes = new Set();
  const selectedIndustries = new Set();

  function initMultiSelect(config) {
    const box = document.getElementById(config.boxId);
    const dropdown = document.getElementById(config.dropdownId);
    const list = document.getElementById(config.listId);
    const selectedSet = config.selectedSet;
    const placeholderText = config.placeholder;

    if (!box || !dropdown || !list) return;

    // Render options
    list.innerHTML = "";
    config.options.forEach((opt) => {
      const label = typeof opt === "string" ? opt : opt.label;
      const id = typeof opt === "string" ? opt : opt.id;

      const item = document.createElement("div");
      item.className = "multiselect-option";
      item.dataset.value = id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = id;
      checkbox.id = `${config.boxId}-chk-${id.replace(/\W+/g, "_")}`;

      const text = document.createElement("span");
      text.textContent = label;

      item.appendChild(checkbox);
      item.appendChild(text);

      item.addEventListener("click", (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        toggleOption(id, label, checkbox.checked);
      });

      checkbox.addEventListener("change", () => {
        toggleOption(id, label, checkbox.checked);
      });

      list.appendChild(item);
    });

    function toggleOption(id, label, isChecked) {
      if (isChecked) {
        selectedSet.add(id);
      } else {
        selectedSet.delete(id);
      }
      updateUI();
      if (typeof config.onChange === "function") {
        config.onChange(selectedSet);
      }
    }

    function updateUI() {
      // Update badges inside box
      const existingBadges = box.querySelectorAll(".multiselect-badge");
      existingBadges.forEach((b) => b.remove());

      const placeholder = box.querySelector(".multiselect-placeholder");

      if (selectedSet.size === 0) {
        if (placeholder) placeholder.style.display = "block";
      } else {
        if (placeholder) placeholder.style.display = "none";
        selectedSet.forEach((val) => {
          const opt = config.options.find((o) => (typeof o === "string" ? o === val : o.id === val));
          const text = opt ? (typeof opt === "string" ? opt : opt.label) : val;

          const badge = document.createElement("span");
          badge.className = "multiselect-badge";
          badge.textContent = text;

          const removeBtn = document.createElement("span");
          removeBtn.className = "badge-remove";
          removeBtn.innerHTML = "&times;";
          removeBtn.setAttribute("aria-label", `Remove ${text}`);
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedSet.delete(val);
            const chk = list.querySelector(`input[value="${val}"]`);
            if (chk) chk.checked = false;
            const parent = chk?.closest(".multiselect-option");
            if (parent) parent.classList.remove("is-selected");
            updateUI();
            if (typeof config.onChange === "function") {
              config.onChange(selectedSet);
            }
          });

          badge.appendChild(removeBtn);
          box.appendChild(badge);
        });
      }

      // Sync checkbox and row highlight
      list.querySelectorAll(".multiselect-option").forEach((row) => {
        const val = row.dataset.value;
        const isSel = selectedSet.has(val);
        row.classList.toggle("is-selected", isSel);
        const chk = row.querySelector("input[type='checkbox']");
        if (chk) chk.checked = isSel;
      });
    }

    // Toggle Dropdown
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("is-active");
      closeAllDropdowns();
      if (!isOpen) {
        dropdown.classList.add("is-active");
        box.classList.add("is-open");
      }
    });

    return {
      select: (id) => {
        selectedSet.add(id);
        updateUI();
        if (typeof config.onChange === "function") config.onChange(selectedSet);
      },
      clear: () => {
        selectedSet.clear();
        updateUI();
        if (typeof config.onChange === "function") config.onChange(selectedSet);
      }
    };
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".multiselect-dropdown").forEach((d) => d.classList.remove("is-active"));
    document.querySelectorAll(".multiselect-box").forEach((b) => b.classList.remove("is-open"));
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".multiselect-wrap")) {
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDropdowns();
  });

  // Initialize Form
  document.addEventListener("DOMContentLoaded", () => {
    const otherIndustryWrap = document.getElementById("other-industry-wrap");
    const otherIndustryInput = document.getElementById("other-industry-input");

    // Init Partnership Type Multi-Select
    const typeSelect = initMultiSelect({
      boxId: "box-partnership-type",
      dropdownId: "dropdown-partnership-type",
      listId: "list-partnership-type",
      options: PARTNERSHIP_OPTIONS,
      selectedSet: selectedTypes,
      placeholder: "Select one or more (Expo, Partner, Sponsor)..."
    });

    // Init Industry Sectors Multi-Select
    const industrySelect = initMultiSelect({
      boxId: "box-industry",
      dropdownId: "dropdown-industry",
      listId: "list-industry",
      options: INDUSTRY_OPTIONS,
      selectedSet: selectedIndustries,
      placeholder: "Select industry sectors...",
      onChange: (selected) => {
        const hasOther = selected.has("Other (Please Specify)");
        if (otherIndustryWrap) {
          otherIndustryWrap.classList.toggle("hidden", !hasOther);
          if (hasOther && otherIndustryInput) {
            setTimeout(() => otherIndustryInput.focus(), 50);
          }
        }
      }
    });

    // Deep-link intent (e.g. ?type=sponsor or ?type=expo)
    const urlParams = new URLSearchParams(window.location.search);
    const requestedType = urlParams.get("type") || urlParams.get("interest");
    if (requestedType && typeSelect) {
      const match = PARTNERSHIP_OPTIONS.find(
        (o) => o.id === requestedType.toLowerCase() || o.label.toLowerCase().includes(requestedType.toLowerCase())
      );
      if (match) typeSelect.select(match.id);
    }

    // Form Submission
    const form = document.getElementById("partner-lead-form");
    const feedback = document.getElementById("form-feedback");
    const submitBtn = document.getElementById("form-submit-btn");
    const formCard = document.getElementById("lead-form-content");
    const successCard = document.getElementById("lead-form-success");
    const refCodeEl = document.getElementById("success-ref-code");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showFeedback("", "");

      const name = (document.getElementById("lead-name")?.value || "").trim();
      const email = (document.getElementById("lead-email")?.value || "").trim();
      const phone = (document.getElementById("lead-phone")?.value || "").trim().replace(/\D/g, "");
      const designation = (document.getElementById("lead-designation")?.value || "").trim();
      const company = (document.getElementById("lead-company")?.value || "").trim();
      const note = (document.getElementById("lead-note")?.value || "").trim();
      const otherIndustry = (otherIndustryInput?.value || "").trim();

      // Validation
      if (!name) return showFeedback("Please enter your full name.", "error");
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return showFeedback("Please enter a valid official email address.", "error");
      }
      if (!phone || phone.length !== 10) {
        return showFeedback("Please enter a valid 10-digit mobile number.", "error");
      }
      if (!designation) return showFeedback("Please enter your designation.", "error");
      if (!company) return showFeedback("Please enter your company or organisation name.", "error");

      if (selectedTypes.size === 0) {
        return showFeedback("Please select at least one partnership avenue (Expo, Partner, or Sponsor).", "error");
      }

      if (selectedIndustries.size === 0) {
        return showFeedback("Please select at least one industry / sector.", "error");
      }

      if (selectedIndustries.has("Other (Please Specify)") && !otherIndustry) {
        return showFeedback("Please specify your industry in the provided field.", "error");
      }

      // Build payload
      const typesList = Array.from(selectedTypes);
      const industriesList = Array.from(selectedIndustries).map((ind) =>
        ind === "Other (Please Specify)" && otherIndustry ? `Other: ${otherIndustry}` : ind
      );

      const refId = "NB-SURAT-" + Math.floor(100000 + Math.random() * 900000);

      const leadPayload = {
        ref_id: refId,
        submitted_at: new Date().toISOString(),
        event_name: "Nivesh Baithak Surat Awards 2026",
        full_name: name,
        email: email,
        phone_number: phone,
        designation: designation,
        company_name: company,
        partnership_types: typesList,
        industries: industriesList,
        note: note,
        url: window.location.href,
        user_agent: navigator.userAgent
      };

      // Set Loading
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting Inquiry...";
      }

      try {
        // 1. Save to LocalStorage archive
        try {
          const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          existing.push(leadPayload);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        } catch (_) {}

        // 2. Track Lead in GA4
        if (typeof window.gtag === "function") {
          window.gtag("event", "generate_lead", {
            event_category: "partnership_lead",
            event_label: company,
            partnership_types: typesList.join(", "),
            industry: industriesList.join(", ")
          });
        }

        // 3. Track Lead in Meta Pixel
        if (typeof window.fbq === "function") {
          window.fbq("track", "Lead", {
            content_name: "Partnership & Expo Inquiry",
            content_category: typesList.join(", "),
            currency: "INR"
          });
        }

        // 4. Post to EventHub public form submissions API if accessible
        try {
          await fetch(SUBMIT_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify({
              form_code: "nivesh-baithak-partner",
              answers_json: leadPayload
            })
          });
        } catch (_) {
          // Graceful fallback to client capture
        }

        // Display Success View
        if (refCodeEl) refCodeEl.textContent = refId;
        if (formCard) formCard.style.display = "none";
        if (successCard) {
          successCard.classList.add("is-visible");
          successCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch (err) {
        showFeedback("An unexpected error occurred. Please try again or reach out to our team directly.", "error");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Partnership Inquiry";
        }
      }
    });

    function showFeedback(msg, type) {
      if (!feedback) return;
      if (!msg) {
        feedback.style.display = "none";
        feedback.className = "form-feedback";
        feedback.textContent = "";
        return;
      }
      feedback.textContent = msg;
      feedback.className = `form-feedback is-${type}`;
      feedback.style.display = "block";
      feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
})();
