/**
 * Aplopean Banner Manager
 * Foundry VTT v14.367
 *
 * Uses the legacy FormApplication API which remains available in v14.
 * The Compendium Directory itself is ApplicationV2, so its DOM is handled
 * independently through renderCompendiumDirectory.
 */

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

  /**
   * Ensure a setting exists.
   */
  ensureSettingExists(namespace, key, type = String, defaultValue = "") {
    if (!game.settings.settings.has(`${namespace}.${key}`)) {
      game.settings.register(namespace, key, {
        scope: "world",
        config: false,
        type,
        default: defaultValue
      });
    }
  }

  /**
   * Get all compendiums and divide them into World / Module / System.
   */
  async getData() {
    const packs = Array.from(game.packs.values());

    const sections = {
      world: {
        id: "world",
        label: "World Compendiums",
        packs: []
      },
      module: {
        id: "module",
        label: "Module Compendiums",
        packs: []
      },
      system: {
        id: "system",
        label: "System Compendiums",
        packs: []
      }
    };

    const banners =
      game.settings.get(
        "aplopean-banner-manager",
        "banners"
      ) || {};

    const overrides =
      game.settings.get(
        "aplopean-banner-manager",
        "classOverrides"
      ) || {};

    const sectionStates =
      game.settings.get(
        "aplopean-banner-manager",
        "sectionStates"
      ) || {};

    for (const pack of packs) {

      const packId = pack.metadata.id;

      /*
       * Foundry package metadata changed over different versions.
       * packageType is preferred, with package as fallback.
       */
      const sourceType =
        pack.metadata.packageType ??
        pack.metadata.package ??
        "module";

      let type;

      const override = overrides[packId];

      if (override && override !== "Auto") {
        type = override.toLowerCase();
      } else {
        switch (String(sourceType).toLowerCase()) {
          case "world":
            type = "world";
            break;

          case "system":
            type = "system";
            break;

          default:
            type = "module";
            break;
        }
      }

      /*
       * Safety fallback in case an invalid override exists.
       */
      if (!sections[type]) type = "module";

      sections[type].packs.push({
        id: packId,
        label: pack.metadata.label ?? packId,
        current: banners[packId] || "",
        override: override || "Auto",

        /*
         * Used by the Handlebars template instead of the old
         * {{eq ...}} helper.
         */
        isAuto: !override || override === "Auto",
        isWorld: override === "World",
        isModule: override === "Module",
        isSystem: override === "System"
      });
    }

    return {
      sections: Object.values(sections).map(section => ({
        ...section,
        isOpen: sectionStates[section.id] !== false
      }))
    };
  }

  /**
   * Activate UI listeners.
   *
   * FormApplication V1 still supplies a jQuery object here in v14.
   */
  activateListeners(html) {
    super.activateListeners(html);

    /*
     * ---------------------------------------------------------------
     * File picker
     * ---------------------------------------------------------------
     */
    html.find(".file-picker").on("click", event => {
      event.preventDefault();

      const button = event.currentTarget;
      const target = button.dataset.target;

      const input = html.find(
        `input[name="${CSS.escape(target)}"]`
      );

      if (!input.length) return;

      const picker = new foundry.applications.apps.FilePicker({
        type: "image",
        current: input.val() || "",
        callback: path => {
          input
            .val(path)
            .trigger("input")
            .trigger("change");

          const preview = html.find(
            `.banner-row[data-pack="${CSS.escape(target)}"] .banner-preview`
          );

          if (preview.length) {
            preview.attr("src", path);

            if (path) {
              preview.show();
            } else {
              preview.hide();
            }
          }
        }
      });

      picker.browse();
    });

    /*
     * ---------------------------------------------------------------
     * Reset banner
     * ---------------------------------------------------------------
     */
    html.find(".reset-btn").on("click", event => {
      event.preventDefault();

      const target = event.currentTarget.dataset.target;

      const input = html.find(
        `input[name="${CSS.escape(target)}"]`
      );

      input
        .val("")
        .trigger("input")
        .trigger("change");

      const preview = html.find(
        `.banner-row[data-pack="${CSS.escape(target)}"] .banner-preview`
      );

      preview.hide();
    });

    /*
     * ---------------------------------------------------------------
     * Toggle sections
     * ---------------------------------------------------------------
     */
    html.find(".toggle-section").on("click", async event => {
      event.preventDefault();

      const button = event.currentTarget;
      const targetId = button.dataset.target;

      const section = html.find(
        `#${CSS.escape(targetId)}`
      );

      if (!section.length) return;

      const isOpen = section.is(":visible");

      section.stop(true, true).slideToggle(160);

      const icon = button.querySelector("i");

      if (icon) {
        icon.classList.toggle(
          "fa-chevron-down",
          !isOpen
        );

        icon.classList.toggle(
          "fa-chevron-right",
          isOpen
        );
      }

      const sectionStates =
        game.settings.get(
          "aplopean-banner-manager",
          "sectionStates"
        ) || {};

      sectionStates[targetId] = !isOpen;

      await game.settings.set(
        "aplopean-banner-manager",
        "sectionStates",
        sectionStates
      );
    });

    /*
     * ---------------------------------------------------------------
     * Initial section visibility
     * ---------------------------------------------------------------
     */
    const sectionStates =
      game.settings.get(
        "aplopean-banner-manager",
        "sectionStates"
      ) || {};

    for (const [id, isOpen] of Object.entries(sectionStates)) {
      if (isOpen === false) {
        html.find(`#${CSS.escape(id)}`).hide();

        const button = html.find(
          `.toggle-section[data-target="${CSS.escape(id)}"]`
        );

        button.find("i")
          .removeClass("fa-chevron-down")
          .addClass("fa-chevron-right");
      }
    }

    /*
     * ---------------------------------------------------------------
     * Override dropdown
     * ---------------------------------------------------------------
     */
    html.find(".class-override").on("change", event => {
      const select = event.currentTarget;
      const packId = select.dataset.pack;

      const row = html.find(
        `.banner-row[data-pack="${CSS.escape(packId)}"]`
      );

      row.toggleClass(
        "override-set",
        select.value !== "Auto"
      );
    });

    /*
     * ---------------------------------------------------------------
     * Drag & drop
     * ---------------------------------------------------------------
     *
     * This keeps your original behavior of assigning the dropped
     * file path to the input.
     */
    html.find("input[type='text']")
      .on("dragover", event => {
        event.preventDefault();
        event.originalEvent.dataTransfer.dropEffect = "copy";
      });

    html.find("input[type='text']")
      .on("drop", event => {
        event.preventDefault();

        const input = event.currentTarget;
        const file =
          event.originalEvent?.dataTransfer?.files?.[0];

        if (!file) return;

        const path =
          `worlds/${game.world.id}/banners/${file.name}`;

        input.value = path;

        $(input).trigger("input");
        $(input).trigger("change");

        const preview =
          input
            .closest(".banner-row")
            .querySelector(".banner-preview");

        if (preview) {
          preview.src = path;
          preview.style.display = "block";
        }
      });

    /*
     * ---------------------------------------------------------------
     * Live preview
     * ---------------------------------------------------------------
     */
    html.find("input[name]").on("input", event => {
      const input = event.currentTarget;
      const row = input.closest(".banner-row");

      if (!row) return;

      const preview =
        row.querySelector(".banner-preview");

      if (!preview) return;

      const value = input.value.trim();

      if (!value) {
        preview.style.display = "none";
        return;
      }

      preview.src = value;
      preview.style.display = "block";
    });
  }

  /**
   * Save banners and category overrides.
   */
  async _updateObject(_event, formData) {

    const banners =
      game.settings.get(
        "aplopean-banner-manager",
        "banners"
      ) || {};

    const overrides =
      game.settings.get(
        "aplopean-banner-manager",
        "classOverrides"
      ) || {};

    for (const [key, value] of Object.entries(formData)) {

      /*
       * Override field.
       */
      if (key.endsWith("__override")) {

        const packId =
          key.slice(0, -"__override".length);

        if (value && value !== "Auto") {
          overrides[packId] = value;
        } else {
          delete overrides[packId];
        }

        continue;
      }

      /*
       * Banner field.
       */
      if (value) {
        banners[key] = value;
      } else {
        delete banners[key];
      }
    }

    /*
     * Persist settings.
     */
    await game.settings.set(
      "aplopean-banner-manager",
      "banners",
      banners
    );

    await game.settings.set(
      "aplopean-banner-manager",
      "classOverrides",
      overrides
    );

    /*
     * Apply banners immediately.
     *
     * IMPORTANT:
     * We only modify the runtime banner property.
     * We do NOT modify pack.metadata.packageType.
     */
    this.applyBanners();

    ui.notifications.info(
      "Banners and overrides saved."
    );

    /*
     * Refresh this application.
     */
    await this.render(true);

    /*
     * Refresh the v14 ApplicationV2 compendium directory.
     */
    this.refreshCompendiumDirectory();
  }

  /**
   * Apply all saved banners to the currently loaded packs.
   */
  applyBanners() {
    const banners =
      game.settings.get(
        "aplopean-banner-manager",
        "banners"
      ) || {};

    for (const [packId, banner] of Object.entries(banners)) {
      const pack = game.packs.get(packId);

      if (!pack) continue;

      /*
       * Runtime-only modification.
       */
      pack.metadata.banner = banner;
    }
  }

  /**
   * Refresh the Compendium Directory.
   *
   * In v14 the directory is ApplicationV2, so we avoid relying
   * on the old ui.compendium.rendered check.
   */
  refreshCompendiumDirectory() {
    const directory =
      ui.compendium;

    if (!directory) return;

    try {
      if (typeof directory.render === "function") {
        directory.render();
      }
    } catch (error) {
      console.warn(
        "Aplopean Banner Manager | Could not refresh Compendium Directory",
        error
      );
    }
  }
}


/* ==================================================================
 * INITIALIZE
 * ================================================================== */

/**
 * Register settings and the manager.
 */
Hooks.once("init", () => {

  game.settings.register(
    "aplopean-banner-manager",
    "banners",
    {
      scope: "world",
      config: false,
      type: Object,
      default: {}
    }
  );

  game.settings.register(
    "aplopean-banner-manager",
    "classOverrides",
    {
      scope: "world",
      config: false,
      type: Object,
      default: {}
    }
  );

  game.settings.register(
    "aplopean-banner-manager",
    "sectionStates",
    {
      scope: "world",
      config: false,
      type: Object,
      default: {}
    }
  );

  /*
   * Keep a globally accessible instance.
   */
  game.aplopeanBannerManager =
    new AplopeanBannerManager();

  game.settings.registerMenu(
    "aplopean-banner-manager",
    "openManager",
    {
      name: "Configure Banners",
      label: "Configure Banners",
      icon: "fas fa-image",
      type: AplopeanBannerManager,
      restricted: true
    }
  );
});


/* ==================================================================
 * READY
 * ================================================================== */

/**
 * Apply saved banners once Foundry has finished loading.
 */
Hooks.once("ready", () => {

  if (!game.aplopeanBannerManager) return;

  game.aplopeanBannerManager.applyBanners();
});


/* ==================================================================
 * COMPENDIUM DIRECTORY
 * ================================================================== */

/**
 * Apply custom banners whenever the v14 Compendium Directory renders.
 *
 * Foundry v14's Compendium Directory is an ApplicationV2 application.
 * We therefore operate directly on the rendered DOM instead of
 * assuming the old ApplicationV1 structure.
 */
Hooks.on("renderCompendiumDirectory", (directory, html) => {

  const banners =
    game.settings.get(
      "aplopean-banner-manager",
      "banners"
    ) || {};

  /*
   * `html` may be an HTMLElement or a jQuery object depending on
   * the Application implementation/hook pathway.
   */
  const root =
    html instanceof HTMLElement
      ? html
      : html?.[0];

  if (!root) return;

  /*
   * V14 compendium cards use data-pack attributes.
   *
   * We support both the newer directory-card structure and
   * older structures as a fallback.
   */
  for (const [packId, banner] of Object.entries(banners)) {

    if (!banner) continue;

    const escapedId =
      CSS.escape(packId);

    const elements =
      root.querySelectorAll(
        `[data-pack="${escapedId}"]`
      );

    for (const element of elements) {

      /*
       * Newer card image.
       */
      const image =
        element.querySelector(
          ".directory-card-image"
        );

      if (image) {
        image.src = banner;
        image.style.backgroundImage =
          `url("${banner}")`;
      }

      /*
       * Generic image fallback.
       */
      const img =
        element.querySelector("img");

      if (img) {
        img.src = banner;
      }

      /*
       * Some versions / themes may expose the image as
       * a background rather than an img element.
       */
      if (!image && !img) {
        element.style.backgroundImage =
          `url("${banner}")`;
      }
    }
  }
});
