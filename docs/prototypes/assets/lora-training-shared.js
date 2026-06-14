const PROTOTYPE_VERSION = "20260614-prototype-alignment-2";

function withPrototypeVersion(href) {
  try {
    const url = new URL(href, window.location.href);
    if (!url.pathname.endsWith(".html")) return href;
    if (!url.pathname.includes("manager-lora-training-")) return href;
    url.searchParams.set("v", PROTOTYPE_VERSION);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

function versionPrototypeLinks() {
  document.querySelectorAll('a[href*="manager-lora-training-"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http")) return;
    link.setAttribute("href", withPrototypeVersion(href));
  });
}

function createDesktopNav(active) {
  const items = [
    ["运行", "play-circle", withPrototypeVersion("./manager-lora-training-runs-prototype.html"), "runs"],
    ["项目", "folder-kanban", withPrototypeVersion("./manager-lora-training-projects-prototype.html"), "projects"],
    ["预制", "layers", withPrototypeVersion("./manager-lora-training-presets-prototype.html"), "presets"],
    ["模板", "layout-template", withPrototypeVersion("./manager-lora-training-templates-prototype.html"), "templates"],
    ["模型", "box", withPrototypeVersion("./manager-lora-training-models-prototype.html"), "models"],
    ["设置", "settings", withPrototypeVersion("./manager-lora-training-settings-mode-prototype.html"), "settings"],
  ];
  const links = items
    .map(([label, icon, href, key]) => {
      const current = key === active ? " active\" aria-current=\"page" : "";
      return `<a class="desktop-nav-item${current}" href="${href}"><i data-lucide="${icon}" aria-hidden="true"></i><span>${label}</span></a>`;
    })
    .join("");

  const main = document.querySelector(".app-shell");
  if (main) {
    main.classList.add("with-desktop-nav");
    main.insertAdjacentHTML(
      "beforebegin",
      `<aside class="desktop-nav" aria-label="桌面导航"><div class="desktop-nav-head"><strong>ComfyUI Manager</strong><span>LoRA 训练原型</span></div><nav class="desktop-nav-list">${links}</nav><div class="desktop-nav-mode"><span class="mode-pill"><i data-lucide="flask-conical" aria-hidden="true"></i>LoRA 训练</span></div></aside>`,
    );
  }
}

function createBottomNav(active) {
  const items = [
    ["运行", "play-circle", withPrototypeVersion("./manager-lora-training-runs-prototype.html"), "runs"],
    ["项目", "folder-kanban", withPrototypeVersion("./manager-lora-training-projects-prototype.html"), "projects"],
    ["预制", "layers", withPrototypeVersion("./manager-lora-training-presets-prototype.html"), "presets"],
    ["模板", "layout-template", withPrototypeVersion("./manager-lora-training-templates-prototype.html"), "templates"],
    ["模型", "box", withPrototypeVersion("./manager-lora-training-models-prototype.html"), "models"],
    ["设置", "settings", withPrototypeVersion("./manager-lora-training-settings-mode-prototype.html"), "settings"],
  ];
  const links = items
    .map(([label, icon, href, key]) => {
      const current = key === active ? " active\" aria-current=\"page" : "";
      return `<a class="nav-item${current}" href="${href}"><i data-lucide="${icon}" aria-hidden="true"></i><span>${label}</span></a>`;
    })
    .join("");

  document.body.insertAdjacentHTML(
    "beforeend",
    `<nav class="bottom-nav" aria-label="底部导航"><div class="nav-items">${links}</div><button class="nav-mode" type="button" aria-label="当前模式：LoRA 训练" title="当前模式：LoRA 训练"><i data-lucide="flask-conical" aria-hidden="true"></i><span>训练</span></button></nav>`,
  );
}

function setupFilters() {
  document.querySelectorAll("[data-filter-group]").forEach((group) => {
    const targetSelector = group.dataset.filterTarget;
    const cards = Array.from(document.querySelectorAll(targetSelector));
    group.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.filter;
        group.querySelectorAll("[data-filter]").forEach((item) => {
          item.setAttribute("aria-selected", String(item === button));
        });
        cards.forEach((card) => {
          const visible = value === "all" || card.dataset.filterValue === value;
          card.style.display = visible ? "" : "none";
        });
      });
    });
  });
}

function setupExpandableText() {
  document.querySelectorAll("[data-toggle-caption]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.toggleCaption);
      if (!target) return;
      target.classList.toggle("expanded");
      button.textContent = target.classList.contains("expanded") ? "收起" : "展开";
    });
  });
}

function setupLightbox() {
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.innerHTML =
    '<div class="lightbox-image"><img width="1024" height="1536" alt="" /></div><aside class="lightbox-side stack"><div class="row-head"><h2>预览</h2><button class="icon-button" type="button" data-lightbox-close aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></div><p class="small muted" data-lightbox-caption></p></aside>';
  document.body.appendChild(lightbox);

  const img = lightbox.querySelector("img");
  const caption = lightbox.querySelector("[data-lightbox-caption]");
  const close = () => lightbox.classList.remove("open");
  lightbox.querySelector("[data-lightbox-close]").addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  document.querySelectorAll("[data-lightbox-src]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      img.src = trigger.dataset.lightboxSrc;
      caption.textContent = trigger.dataset.lightboxCaption || "";
      lightbox.classList.add("open");
    });
  });
}

function initLoraPrototype(activeNav) {
  createDesktopNav(activeNav);
  createBottomNav(activeNav);
  versionPrototypeLinks();
  setupFilters();
  setupExpandableText();
  setupLightbox();
  if (window.lucide) {
    lucide.createIcons();
  }
}

window.initLoraPrototype = initLoraPrototype;
