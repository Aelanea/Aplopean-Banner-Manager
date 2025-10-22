class AplopeanBannerManager extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "aplopean-banner-manager",
      title: "Aplopean Banner Manager",
      template: "modules/aplopean-banner-manager/templates/banner-form.html",
      width: 860,
      height: "auto",
      resizable: true,
      closeOnSubmit: false
    });
  }

  /** Ensure central settings exist */
  ensureSettingExists(namespace, key, type = String, defaultValue = "") {
    if (!game.settings.settings.has(`${namespace}.${key}`)) {
      game.settings.register(namespace, key, { scope: "world", config: false, type, default: defaultValue });
    }
  }

  /** Collect and separate compendiums by type */
  async getData() {
    const packs = Array.from(game.packs.values());
    const sections = {
      world: { id: "world", label: "World Compendiums", packs: [] },
      module: { id: "module", label: "Module Compendiums", packs: [] },
      system: { id: "system", label: "System Compendiums", packs: [] }
    };

    const banners = game.settings.get("aplopean-banner-manager", "banners") || {};
    const overrides = game.settings.get("aplopean-banner-manager", "classOverrides") || {};
    const sectionStates = game.settings.get("aplopean-banner-manager", "sectionStates") || {};

    for (const p of packs) {
      // SORTING LOGIC 
      const src = p.metadata.packageType || p.metadata.package;
      let type = overrides[p.metadata.id] && overrides[p.metadata.id] !== "Auto" ? overrides[p.metadata.id].toLowerCase() : (src === "world" ? "world" : src === "system" ? "system" : "module");

      sections[type].packs.push({
        id: p.metadata.id,
        label: p.metadata.label,
        current: banners[p.metadata.id] || "",
        override: overrides[p.metadata.id] || "Auto"
      });
    }

    return { 
      sections: Object.values(sections).map(section => ({
        ...section,
        isOpen: sectionStates[section.id] !== false // Default to open if not set
      }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // File picker
    html.find(".file-picker").on("click", ev => {
      const target = $(ev.currentTarget).data("target");
      const input = html.find(`input[name="${target}"]`);
      new FilePicker({
        type: "image",
        current: input.val() || "",
        callback: path => { input.val(path).trigger("input"); }
      }).browse();
    });

    // Reset input
    html.find(".reset-btn").on("click", ev => {
      const target = $(ev.currentTarget).data("target");
      html.find(`input[name="${target}"]`).val("").trigger("input");
    });

    // Toggle sections
    html.find(".toggle-section").on("click", async ev => {
      const targetId = $(ev.currentTarget).data("target");
      const section = html.find(`#${targetId}`);
      const isOpen = section.is(":visible");
      section.slideToggle(160);

      // Save section state
      const sectionStates = game.settings.get("aplopean-banner-manager", "sectionStates") || {};
      sectionStates[targetId] = !isOpen;
      await game.settings.set("aplopean-banner-manager", "sectionStates", sectionStates);
    });

    // Set initial section visibility
    const sectionStates = game.settings.get("aplopean-banner-manager", "sectionStates") || {};
    Object.keys(sectionStates).forEach(id => {
      if (sectionStates[id] === false) {
        html.find(`#${id}`).hide();
      }
    });

    // Override dropdown visual
    html.find(".class-override").on("change", ev => {
      const sel = ev.currentTarget;
      const packId = $(sel).data("pack");
      const row = html.find(`.banner-row[data-pack="${packId}"]`);
      if (sel.value !== "Auto") row.addClass("override-set");
      else row.removeClass("override-set");
    });

    // Drag & drop into input
    html.find("input[type=text]").on("dragover", ev => ev.preventDefault());
    html.find("input[type=text]").on("drop", ev => {
      ev.preventDefault();
      const input = ev.currentTarget;
      const file = ev.originalEvent?.dataTransfer?.files?.[0];
      if (!file) return;
      const path = `worlds/${game.world.id}/banners/${file.name}`;
      input.value = path;
      $(input).trigger("input");
    });
  }

  /** Save banners and overrides */
  async _updateObject(_event, formData) {
    const banners = game.settings.get("aplopean-banner-manager", "banners") || {};
    const overrides = game.settings.get("aplopean-banner-manager", "classOverrides") || {};

    for (const [key, value] of Object.entries(formData)) {
      if (key.endsWith("__override")) {
        const packId = key.slice(0, -10);
        if (value && value !== "Auto") {
          overrides[packId] = value;
          const pack = game.packs.get(packId);
          if (pack) pack.metadata.packageType = value.toLowerCase(); // Update compendium type
        } else {
          delete overrides[packId];
        }
        continue;
      }
      if (value) banners[key] = value;
      else delete banners[key];
    }

    await game.settings.set("aplopean-banner-manager", "banners", banners);
    await game.settings.set("aplopean-banner-manager", "classOverrides", overrides);

    // Apply banners immediately
    for (const [packId, banner] of Object.entries(banners)) {
      const pack = game.packs.get(packId);
      if (pack) pack.metadata.banner = banner;
    }

    ui.notifications.info("Banners and overrides saved.");

    // Refresh form to reflect new categorization
    this.render(true);

    // Refresh sidebar correctly
    if (ui.compendium?.rendered) ui.compendium.render(true);
  }
}

/** Apply banners on load */
Hooks.once("ready", () => {
  const banners = game.settings.get("aplopean-banner-manager", "banners") || {};
  for (const [packId, banner] of Object.entries(banners)) {
    const pack = game.packs.get(packId);
    if (pack) pack.metadata.banner = banner;
  }
  if (ui.compendium?.rendered) ui.compendium.render(true);
});

/** Register manager menu and central settings */
Hooks.once("init", () => {
  game.settings.register("aplopean-banner-manager", "banners", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register("aplopean-banner-manager", "classOverrides", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register("aplopean-banner-manager", "sectionStates", { scope: "world", config: false, type: Object, default: {} });

  game.aplopeanBannerManager = new AplopeanBannerManager();
  game.settings.registerMenu("aplopean-banner-manager", "openManager", {
    name: "Configure Banners",
    label: "Configure Banners",
    icon: "fas fa-image",
    type: AplopeanBannerManager,
    restricted: true
  });
});

/** Update sidebar when rendered */
Hooks.on("renderCompendiumDirectory", (directory, html) => {
  const banners = game.settings.get("aplopean-banner-manager", "banners") || {};
  $(html).find(".directory-card").each((i, el) => {
    const packName = el.dataset.pack;
    const banner = banners[packName];
    if (banner) $(el).find(".directory-card-image").attr("src", banner);
  });
});