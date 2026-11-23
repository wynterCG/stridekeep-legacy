"use strict";

(() => {
  const index = document.querySelector(".guide-index");
  const topics = Array.from(document.querySelectorAll(".guide-topic"));
  if (!index || !topics.length) return;

  const nav = document.querySelector(".guide-nav");
  const input = document.getElementById("guide-search");
  const results = document.getElementById("guide-results");
  const language = document.querySelector("[data-guide-language]");
  const mobile = matchMedia("(max-width: 760px)");
  const pt = document.documentElement.lang === "pt-PT";
  const wikiTitle = document.title;
  const normalize = text => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const squash = text => text.replace(/\s+/g, " ").trim();
  const documents = topics.map(article => {
    const title = article.querySelector("h2").textContent.trim();
    const passages = Array.from(article.querySelectorAll("p, li, h3, h4, dd, dt, figcaption, summary, tr"))
      .map(node => squash(node.cells ? Array.from(node.cells, cell => cell.textContent).join(" · ") : node.textContent))
      .filter(Boolean);
    return { article, title, passages, text: normalize([title, ...passages].join(" ")) };
  });

  function clearSearch() {
    if (!input || !results) return;
    input.value = "";
    results.replaceChildren();
  }

  function search() {
    const words = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    results.replaceChildren();
    if (!words.length) return;
    const matches = documents.filter(doc => words.every(word => doc.text.includes(word)));
    const summary = document.createElement("p");
    summary.textContent = pt
      ? (matches.length ? `${matches.length} ${matches.length === 1 ? "artigo encontrado" : "artigos encontrados"}` : "Nenhum artigo encontrado.")
      : (matches.length ? `${matches.length} ${matches.length === 1 ? "article found" : "articles found"}` : "No matching articles.");
    results.append(summary);
    if (!matches.length) return;
    const list = document.createElement("ul");
    for (const doc of matches) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      const matchingRecipe = Array.from(doc.article.querySelectorAll('tr[id^="recipe-"]')).find(row =>
        words.every(word => normalize(row.cells[0].textContent).includes(word)));
      link.href = "#" + (matchingRecipe || doc.article).id;
      link.textContent = matchingRecipe ? doc.title + " · " + matchingRecipe.cells[0].textContent : doc.title;
      item.append(link);
      const passage = doc.passages.find(line => words.every(word => normalize(line).includes(word)))
        || doc.passages.find(line => words.some(word => normalize(line).includes(word)));
      if (passage) {
        const excerpt = document.createElement("small");
        const folded = normalize(passage);
        const match = Math.min(...words.map(word => folded.indexOf(word)).filter(offset => offset >= 0));
        const start = Math.max(0, match - 30);
        excerpt.textContent = (start ? "…" : "") + passage.slice(start, start + 115) + (start + 115 < passage.length ? "…" : "");
        item.append(excerpt);
      }
      list.append(item);
    }
    results.append(list);
  }

  function showPage(focus) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); }
    catch { id = ""; }
    const target = document.getElementById(id);
    const page = target?.closest(".guide-topic") || index;
    document.title = page === index ? wikiTitle : page.querySelector("h2").textContent + " · " + wikiTitle;
    index.hidden = page !== index;
    for (const topic of topics) topic.hidden = topic !== page;
    for (const link of nav.querySelectorAll('a[href^="#"]')) {
      if (link.hash === "#" + page.id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (language) language.hash = page === index ? "" : (target?.matches('tr[id^="recipe-"]') ? target.id : page.id);
    clearSearch();
    if (mobile.matches) nav.open = false;
    if (!focus && !location.hash) return;
    const destination = target && page.contains(target) ? target : page;
    if (focus) {
      const heading = destination.matches("article, section") ? destination.querySelector("h1,h2") || destination : destination;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    destination.scrollIntoView({ block: "start" });
  }

  if (input && results) {
    input.closest(".guide-search").hidden = false;
    input.addEventListener("input", search);
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") clearSearch();
    });
  }
  nav.open = !mobile.matches;
  mobile.addEventListener("change", () => { nav.open = !mobile.matches; });
  window.addEventListener("hashchange", () => showPage(true));
  document.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      showPage(true);
    }
  });
  showPage(false);
})();
