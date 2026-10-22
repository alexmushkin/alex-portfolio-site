/*
  Shared header + footer.
  To add a Creative Writing project, add it to CREATIVE_WRITING below.
  To add a Sports article or series, add it to SPORTS.
  Anything with an `entries` list (a project or series) gets its own little
  dropdown under it in the menu.
  Each piece's `date` (YYYY-MM-DD) shows under its title and on its card.
*/

const CREATIVE_WRITING = [
  {
    title: "Descriptions of Things I Love the Most",
    href: "descriptions-of-things-i-love-the-most.html",
    entries: [
      { title: "Eating Watermelon Outside", href: "eating-watermelon-outside.html", date: "2025-05-24" },
      { title: "Friday Afternoon", href: "friday-afternoon.html", date: "2026-09-29" },
      { title: "Driving on a Summer Night", href: "driving-on-a-summer-night.html", date: "2026-10-02" },
      { title: "Taking Off My Ski Boots", href: "taking-off-my-ski-boots.html", date: "2026-10-06" },
      { title: "Feeling the Warm Sun", href: "feeling-the-warm-sun.html", date: "2026-10-07" },
    ],
  },
];

const SPORTS = [
  { title: "The Lost Art of Watching", href: "the-lost-art-of-watching.html", date: "2026-05-14" },
  {
    title: "Why Do We Love Sports?",
    href: "why-do-we-love-sports.html",
    entries: [
      { title: "Messi", href: "messi.html", date: "2026-10-07" },
    ],
  },
  { title: "Watch My Team (app)", href: "watch-my-team.html" },
];

// Little basketball, used by the logo and by quirks.js.
const BALL_SVG = `
  <svg viewBox="-28 -28 56 56" aria-hidden="true">
    <circle r="25" fill="#e8772e" stroke="#1d1a17" stroke-width="3"/>
    <path d="M0,-25V25M-25,0H25M-17,-18Q-7,0 -17,18M17,-18Q7,0 17,18"
          fill="none" stroke="#1d1a17" stroke-width="2.5"/>
  </svg>`;

function currentPage() {
  const file = location.pathname.split("/").pop();
  return file === "" ? "index.html" : file;
}

// menu items for one section; a project or series opens to show its entries
function menuItems(list, section, here) {
  const current = (href) => (href === here ? ' aria-current="page"' : "");
  const link = (p) => `<a href="${p.href}"${current(p.href)}>${p.title}</a>`;
  return list.map((p, i) => {
    if (!p.entries) return `<li>${link(p)}</li>`;
    // open its entries if you're on it or one of them
    const open = p.href === here || p.entries.some((e) => e.href === here);
    const id = `sub-${section}-${i}`;
    const entries = p.entries.length
      ? p.entries.map((e) => `<li>${link(e)}</li>`).join("")
      : `<li class="submenu-empty">Entries coming soon</li>`;
    return `
      <li class="has-sub${open ? " is-open" : ""}">
        <div class="menu-row">
          ${link(p)}
          <button class="sub-toggle" aria-expanded="${open}" aria-controls="${id}" aria-label="Show entries">
            <span class="caret" aria-hidden="true"></span>
          </button>
        </div>
        <ul class="submenu" id="${id}">${entries}</ul>
      </li>`;
  }).join("");
}

// is this page one of the section's pieces (or their entries)?
const inSection = (list, here) =>
  list.some((p) => p.href === here || (p.entries || []).some((e) => e.href === here));

function renderHeader() {
  const here = currentPage();
  const current = (href) => (href === here ? ' aria-current="page"' : "");
  const inWriting = here === "creative-writing.html" || inSection(CREATIVE_WRITING, here);
  const inSports = here === "sports.html" || inSection(SPORTS, here);
  const projects = menuItems(CREATIVE_WRITING, "writing", here);
  const articles = menuItems(SPORTS, "sports", here);

  document.getElementById("site-header").outerHTML = `
    <header class="site-header">
      <div class="wrap">
        <a class="logo" href="index.html">
          <span class="logo-mark">${BALL_SVG}</span>
          <span class="logo-text"><span class="logo-line">Alex Mushkin's</span> <span class="logo-line accent">Portfolio</span></span>
        </a>
        <nav class="nav" aria-label="Main">
          <div class="dropdown${inWriting ? " is-current" : ""}" data-section="writing">
            <button class="nav-toggle" aria-expanded="false" aria-controls="menu-writing">
              Creative Writing <span class="caret" aria-hidden="true"></span>
            </button>
            <ul class="dropdown-menu" id="menu-writing">
              ${projects}
              <li><a class="menu-all" href="creative-writing.html"${current("creative-writing.html")}>All creative writing →</a></li>
            </ul>
          </div>
          <div class="dropdown${inSports ? " is-current" : ""}" data-section="sports">
            <button class="nav-toggle" aria-expanded="false" aria-controls="menu-sports">
              Sports <span class="caret" aria-hidden="true"></span>
            </button>
            <ul class="dropdown-menu" id="menu-sports">
              ${articles}
              <li><a class="menu-all" href="sports.html"${current("sports.html")}>All sports →</a></li>
            </ul>
          </div>
        </nav>
      </div>
    </header>`;
}

// every dated piece, by page
const PIECES = [...CREATIVE_WRITING, ...SPORTS].flatMap((p) => [p, ...(p.entries || [])]);

// "2026-09-24" → "September 24, 2026" (parsed by hand so time zones can't shift the day)
function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

// date under the title on a piece's page, and on each piece's card
function addDates() {
  const here = PIECES.find((p) => p.href === currentPage());
  const title = document.querySelector(".page-head h1");
  if (here?.date && title) {
    title.insertAdjacentHTML("afterend",
      `<p class="dateline"><time datetime="${here.date}">${formatDate(here.date)}</time></p>`);
  }
  document.querySelectorAll(".card[href]").forEach((card) => {
    const piece = PIECES.find((p) => p.href === card.getAttribute("href"));
    if (piece?.date) {
      card.insertAdjacentHTML("beforeend",
        `<p class="card-date"><time datetime="${piece.date}">${formatDate(piece.date)}</time></p>`);
    }
  });
}

// Cartoon back button (white glove pointing left) on every page but home.
// Goes back to the page you came from on this site, or up a level otherwise.
const GLOVE_SVG = `
  <svg class="glove" viewBox="0 0 40 28" aria-hidden="true">
    <rect x="2" y="9" width="19" height="7" rx="3.5"/>
    <rect x="14" y="5" width="17" height="17" rx="6"/>
    <path d="M19,13.5 H26 M19,17.5 H26" fill="none"/>
    <rect x="30" y="4" width="7" height="19" rx="2.5"/>
    <path d="M33.5,7 V20" fill="none"/>
  </svg>`;

function addBackButton() {
  const head = document.querySelector(".page-head .wrap");
  if (!head || currentPage() === "index.html") return;
  const up = document.querySelector(".page-head .eyebrow a")?.getAttribute("href") || "index.html";
  head.insertAdjacentHTML("afterbegin", `<a class="back-button" href="${up}">${GLOVE_SVG}<span>Back</span></a>`);
  head.querySelector(".back-button").addEventListener("click", (e) => {
    const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
    if (fromHere && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
}

function renderFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.outerHTML = `
    <footer class="site-footer">
      <div class="wrap">© ${new Date().getFullYear()} Alex Mushkin</div>
    </footer>`;
}

function wireDropdowns() {
  const dropdowns = document.querySelectorAll(".dropdown");

  const close = (d) => {
    d.classList.remove("is-open");
    d.querySelector(".nav-toggle").setAttribute("aria-expanded", "false");
  };

  dropdowns.forEach((d) => {
    const toggle = d.querySelector(".nav-toggle");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !d.classList.contains("is-open");
      dropdowns.forEach(close);
      if (open) {
        d.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });
  });

  // a project's entries open and close inside the menu
  document.querySelectorAll(".sub-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".has-sub");
      const open = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  document.addEventListener("click", (e) => {
    dropdowns.forEach((d) => {
      if (!d.contains(e.target)) close(d);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dropdowns.forEach(close);
  });
}

renderHeader();
renderFooter();
wireDropdowns();
addDates();
addBackButton();
