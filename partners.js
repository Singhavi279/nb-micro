/**
 * Nivesh Baithak Surat — Partners, Expo & Sponsors Lead Generation Form Handler & Hero Showcase
 */
(() => {
  "use strict";

  // Configuration & Endpoints
  const SUBMIT_ENDPOINT = "https://api.indiatimes.com/eventhub/api/public/form-submissions";
  const SPEAKERS_API_URL = "https://api.indiatimes.com/eventhub/api/public/events/6ac4e7a3b07cc0980c369622/custom-lists";

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

  const HERO_SPEAKERS = [
    { name: "Ashish Rajodiya", role: "Head – Commodities, PL Capital", photo: "https://static.langimg.com/photo/134938385.cms" },
    { name: "Ajay Suresh Kedia", role: "Director, Kedia Advisory", photo: "https://static.langimg.com/photo/134940855.cms" },
    { name: "Anuj Jain", role: "Co Founder, Green Portfolio", photo: "https://static.langimg.com/photo/134938608.cms" },
    { name: "CA Kamlesh Kumar Chaurasiya", role: "Senior CA 18+ Years of Experience, Parther Ravi Ranjan & Co LLP", photo: "https://static.langimg.com/photo/134940870.cms" },
    { name: "Jay Purohit", role: "Vice President Research, Spark Capital PWM", photo: "https://static.langimg.com/photo/134940278.cms" },
    { name: "Kshitiz Mahajan", role: "Co-Founder and CEO, Complete Circle", photo: "https://static.langimg.com/photo/134940948.cms" },
    { name: "Mahendra Luniya", role: "Founder & Chairman, Vighnaharta Gold Limited Gold Industry & Digital Gold Innovation Leader", photo: "https://static.langimg.com/photo/134940322.cms" },
    { name: "Mahesh M. Ojha", role: "Vice President Research & BD, Kantilal Chhaganlal Securities", photo: "https://static.langimg.com/photo/134959579.cms" },
    { name: "Mohit Gupta", role: "Co-Founder,Equirize Securities", photo: "https://static.langimg.com/photo/134938562.cms" },
    { name: "Nisha Sanghavi", role: "CFP Director, Promore Fintech", photo: "https://static.langimg.com/photo/134941220.cms" },
    { name: "Nisreen Mamaji", role: "MoneyWorks Financial Services, Founder | CFP®", photo: "https://static.langimg.com/photo/134941817.cms" },
    { name: "Sugandha Sachdeva", role: "Founder, SS WealthStreet", photo: "https://static.langimg.com/photo/134940695.cms" },
    { name: "Shri Jainendra Shandilya", role: "DGM, SEBI", photo: "https://static.langimg.com/photo/134941745.cms" }
  ];

  const prefersReducedMotion =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // State
  const selectedTypes = new Set();
  const selectedIndustries = new Set();

  function initMultiSelect(config) {
    const box = document.getElementById(config.boxId);
    const dropdown = document.getElementById(config.dropdownId);
    const list = document.getElementById(config.listId);
    const selectedSet = config.selectedSet;

    if (!box || !dropdown || !list) return null;

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

  // --- Hero Expert Showcase Carousel ---
  async function initHeroShowcase() {
    const imgEl = document.getElementById("showcase-img");
    const nameEl = document.getElementById("showcase-name");
    const roleEl = document.getElementById("showcase-role");
    const dotsContainer = document.getElementById("showcase-dots");

    if (!imgEl || !nameEl || !roleEl || !dotsContainer) return;

    let speakers = HERO_SPEAKERS.map((speaker) => ({
      imgSrc: speaker.photo,
      imgAlt: speaker.name,
      name: speaker.name,
      role: speaker.role,
    }));

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

    function setupDots() {
      dotsContainer.innerHTML = "";
      speakers.forEach((speaker, idx) => {
        const dot = document.createElement("button");
        dot.className = `showcase-dot ${idx === currentIndex ? "active" : ""}`;
        dot.setAttribute("type", "button");
        dot.setAttribute("aria-label", speaker.name || `Slide ${idx + 1}`);
        dot.addEventListener("click", () => {
          currentIndex = idx;
          renderSpeaker(currentIndex);
          resetTimer();
        });
        dotsContainer.appendChild(dot);
      });
    }

    function nextSpeaker() {
      currentIndex = (currentIndex + 1) % speakers.length;
      renderSpeaker(currentIndex);
    }

    function stopTimer() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function resetTimer() {
      stopTimer();
      if (prefersReducedMotion || speakers.length < 2) return;
      timer = setInterval(nextSpeaker, 4000);
    }

    setupDots();
    renderSpeaker(0);
    resetTimer();

    const showcaseCard = document.querySelector(".showcase-card");
    if (showcaseCard) {
      showcaseCard.addEventListener("mouseenter", stopTimer);
      showcaseCard.addEventListener("mouseleave", resetTimer);

      let touchStartX = null;
      showcaseCard.addEventListener("touchstart", (event) => {
        touchStartX = event.touches[0].clientX;
        stopTimer();
      }, { passive: true });
      showcaseCard.addEventListener("touchend", (event) => {
        if (touchStartX === null) return;
        const deltaX = event.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(deltaX) > 40) {
          currentIndex = (currentIndex + (deltaX < 0 ? 1 : speakers.length - 1)) % speakers.length;
          renderSpeaker(currentIndex);
        }
        resetTimer();
      }, { passive: true });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopTimer();
      else resetTimer();
    });

    // Dynamically fetch and update speakers list from API
    try {
      const res = await fetch(SPEAKERS_API_URL, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const json = await res.json();
        const speakerList = json?.data?.find((list) => list.slug === "speakers" || list.name === "Speakers");
        if (speakerList?.items?.length) {
          speakers = speakerList.items.map((item) => ({
            imgSrc: item.image_url,
            imgAlt: item.name,
            name: item.name,
            role: item.role_title,
          }));
          setupDots();
          renderSpeaker(currentIndex < speakers.length ? currentIndex : 0);
        }
      }
    } catch (_) {}
  }

  // Initialize Page & Form
  document.addEventListener("DOMContentLoaded", () => {
    initHeroShowcase();

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
    initMultiSelect({
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

    // Quick Action Chips in Hero
    document.querySelectorAll("[data-type-select]").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        const type = chip.dataset.typeSelect;
        if (type && typeSelect) {
          typeSelect.select(type);
        }
        const target = document.getElementById("partner-form-section");
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
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
        // 1. Post to EventHub first: only a delivered lead counts as a lead
        let delivered = false;
        try {
          const res = await fetch(SUBMIT_ENDPOINT, {
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
          delivered = res.ok;
        } catch (_) {}

        if (!delivered) {
          showFeedback("We couldn't submit your inquiry right now. Please try again, or call Deepika on 99711 29087.", "error");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Partnership Inquiry";
          }
          return;
        }

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
