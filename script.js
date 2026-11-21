/* ============ Settings (edit these) ============ */
const GITHUB_USER = "hazelantonetteapidos-pixel";
const PROJECTS_FILE = "projects.json";
/* Repos you do NOT want shown as project cards (repo names, any case) */
const HIDDEN_REPOS = [
  "hazelantonetteapidos-pixel.github.io", // this portfolio itself
  "hazelantonetteapidos-pixel"            // GitHub profile README repo
];
const NEW_DAYS = 14;        // repos created in the last N days get a "NEW" badge
const CACHE_MINUTES = 10;   // avoids GitHub's anonymous rate limit (60 requests/hour)

/* ============ Helpers ============ */
const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ============ Theme (light / dark) ============ */
const themeBtn = $("#themeToggle");
function applyTheme(dark) {
  document.body.classList.toggle("dark-mode", dark);
  themeBtn.textContent = dark ? "☀" : "☾";
  try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
}
let savedTheme = null;
try { savedTheme = localStorage.getItem("theme"); } catch (e) {}
applyTheme(savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
themeBtn.addEventListener("click", () => applyTheme(!document.body.classList.contains("dark-mode")));

$("#currentYear").textContent = new Date().getFullYear();

/* ============ Projects: GitHub repos (automatic) + projects.json ============ */
const projectList = $("#project-list");

const LANG_STYLE = {
  HTML: { icon: "</>", color: "#e34c26" },
  CSS: { icon: "#", color: "#563d7c" },
  JavaScript: { icon: "JS", color: "#a8870a" },
  TypeScript: { icon: "TS", color: "#3178c6" },
  Python: { icon: "Py", color: "#3572a5" },
  Java: { icon: "J", color: "#b07219" },
  PHP: { icon: "PHP", color: "#4f5d95" },
  "C#": { icon: "C#", color: "#178600" },
  "C++": { icon: "C++", color: "#f34b7d" },
  C: { icon: "C", color: "#555555" }
};

const norm = s => (s || "").toLowerCase().replace(/\/+$/, "");
const repoKey = s => norm(s).split("/").pop();

function prettyTitle(name) {
  return name.replace(/\.github\.io$/i, "").replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase()).trim() || name;
}

function repoToProject(r) {
  const style = LANG_STYLE[r.language] || { icon: "★", color: "#7357c8" };
  const tech = [];
  if (r.language) tech.push(r.language);
  (r.topics || []).forEach(t => { if (!tech.includes(t)) tech.push(t); });
  let demo = r.homepage || "";
  if (!demo && r.has_pages) {
    demo = /\.github\.io$/i.test(r.name)
      ? "https://" + r.name.toLowerCase() + "/"
      : `https://${r.owner.login.toLowerCase()}.github.io/${r.name}/`;
  }
  const isNew = (Date.now() - new Date(r.created_at)) / 864e5 <= NEW_DAYS;
  return {
    title: prettyTitle(r.name),
    category: r.language || "GitHub Project",
    description: r.description || "A project I uploaded to GitHub. A full description is coming soon.",
    technologies: tech,
    color: style.color,
    icon: style.icon,
    repo: r.html_url,
    demo: demo || undefined,
    status: isNew ? "New" : "",
    isNew
  };
}

function projectCard(p, index) {
  const card = el("article", "project-card" + (p.isNew ? " is-new" : ""));

  const art = el("div", "project-art");
  art.style.background = `linear-gradient(135deg, ${p.color || "#7357c8"}, #c2a5ff)`;
  art.appendChild(el("span", "art-label", "PROJECT " + String(index + 1).padStart(2, "0")));
  art.appendChild(el("div", "art-symbol", p.icon || String(index + 1).padStart(2, "0")));
  art.appendChild(el("p", "", (p.category || "PROJECT").toUpperCase()));
  card.appendChild(art);

  const details = el("div", "project-details");
  const cat = el("p", "project-category", (p.category || "").toUpperCase());
  if (p.status) cat.appendChild(el("span", "project-status", p.status));
  details.appendChild(cat);
  details.appendChild(el("h3", "", p.title));
  details.appendChild(el("p", "", p.description));

  const tags = el("div", "skill-tags");
  (p.technologies || []).forEach(t => tags.appendChild(el("span", "", t)));
  details.appendChild(tags);

  if (p.repo || p.demo) {
    const links = el("div", "project-links");
    [["Live demo ↗", p.demo], ["GitHub ↗", p.repo]].forEach(([label, url]) => {
      if (!url) return;
      const a = el("a", "", label);
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      links.appendChild(a);
    });
    details.appendChild(links);
  }
  card.appendChild(details);
  return card;
}

function fetchJson(url) {
  return fetch(url).then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

/* GitHub repos with a short cache and a stale fallback if GitHub is busy */
function loadRepos() {
  const key = "repos:" + GITHUB_USER;
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(key)); } catch (e) {}
  if (cached && Date.now() - cached.time < CACHE_MINUTES * 60000) return Promise.resolve(cached.data);
  return fetchJson(`https://api.github.com/users/${GITHUB_USER}/repos?sort=created&direction=desc&per_page=100`)
    .then(data => {
      try { sessionStorage.setItem(key, JSON.stringify({ time: Date.now(), data })); } catch (e) {}
      return data;
    })
    .catch(err => {
      console.error("Could not load repositories:", err);
      return cached ? cached.data : null;
    });
}

const manualFile = fetchJson(PROJECTS_FILE).catch(err => {
  console.error("Could not load projects.json:", err);
  return [];
});

Promise.all([manualFile, loadRepos()]).then(([manual, repos]) => {
  const overrides = new Map(manual.filter(p => p.repo).map(p => [repoKey(p.repo), p]));
  const ideas = manual.filter(p => !p.repo);

  const fromGitHub = (repos || [])
    .filter(r => !r.fork && !HIDDEN_REPOS.some(h => h.toLowerCase() === r.name.toLowerCase()))
    .map(r => {
      const auto = repoToProject(r);
      const custom = overrides.get(r.name.toLowerCase());
      return custom ? Object.assign(auto, custom, { repo: auto.repo, isNew: auto.isNew }) : auto;
    });

  const all = fromGitHub.concat(ideas);
  projectList.innerHTML = "";
  all.forEach((p, i) => projectList.appendChild(projectCard(p, i)));

  if (!repos) {
    const note = el("p", "message error-msg", "Could not reach GitHub right now, so only my planned ideas are shown. Please refresh in a minute.");
    projectList.appendChild(note);
  } else if (!all.length) {
    projectList.appendChild(el("p", "message", "No projects yet. Check back soon!"));
  }
});
