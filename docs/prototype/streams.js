"use strict";

(() => {
  const { language, t } = globalThis.StrideLocale;
  const byId = (id) => document.getElementById(id);
  const player = byId("stream-player");
  const placeholder = byId("stream-placeholder");
  const results = byId("stream-results");
  const search = byId("search-channels");
  const query = byId("stream-query");
  let current = null;

  document.documentElement.lang = language;
  document.title = t(document.title);
  for (const node of document.querySelectorAll("[data-text]")) node.textContent = t(node.textContent);
  for (const node of document.querySelectorAll("[aria-label]")) node.setAttribute("aria-label", t(node.getAttribute("aria-label")));
  for (const link of document.querySelectorAll("[data-play-link]")) link.search = `?lang=${language}`;
  const switchLink = byId("streams-language");
  const switchUrl = new URL(location.href);
  const nextLanguage = language === "pt-PT" ? "en" : "pt-PT";
  switchUrl.searchParams.set("lang", nextLanguage);
  switchLink.href = switchUrl;
  if (language === "pt-PT") {
    switchLink.lang = switchLink.hreflang = nextLanguage;
    switchLink.textContent = "English";
  } else {
    byId("streams-guide").href = "play-guide.html";
    document.querySelector('.play-nav [aria-current="page"]').href = "streams.html?lang=en";
  }

  // The Workspace report sandbox only permits frames from its own origin.
  if (window !== window.top || !location.hostname || /^(\/mobile)?\/view\//.test(location.pathname)) {
    byId("stream-preview").search = `?lang=${language}`;
    byId("stream-bridge").hidden = false;
    return;
  }
  byId("stream-actions").hidden = false;

  const channelName = (value) => /^[a-z0-9_]{1,25}$/i.test(value) ? value.toLowerCase() : null;

  function directLogin(value) {
    const input = value.trim().replace(/^@/, "");
    const name = channelName(input);
    if (name) return name;
    const text = /^(www\.|m\.)?twitch\.tv\//i.test(input) ? `https://${input}` : input;
    try {
      const url = new URL(text);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port ||
          !["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(url.hostname)) return null;
      return channelName(url.pathname.replace(/^\/|\/$/g, ""));
    } catch {
      return null;
    }
  }

  function renderPlayer() {
    const fits = player.clientWidth >= 400;
    const watching = Boolean(current && fits);
    byId("stop-stream").hidden = !current;
    placeholder.hidden = watching;
    if (!watching) {
      player.replaceChildren();
      placeholder.textContent = t(current ? "Widen the window or rotate the screen to watch." : "Choose a channel to watch here.");
      return;
    }
    if (player.firstChild?.dataset.channel === current.login) return;
    const url = new URL("https://player.twitch.tv/");
    url.search = new URLSearchParams({ channel: current.login, parent: location.hostname, autoplay: "false" });
    const frame = document.createElement("iframe");
    frame.title = `${t("Twitch live video")} · ${current.name}`;
    frame.dataset.channel = current.login;
    frame.width = "400";
    frame.height = "300";
    frame.allowFullscreen = true;
    frame.src = url;
    player.replaceChildren(frame);
  }

  function watch(login, name) {
    current = login ? { login, name } : null;
    byId("video-title").textContent = current ? `${t("Watching")} ${name}` : t("Watch live");
    byId("stream-feedback").textContent = "";
    for (const button of results.querySelectorAll("button")) {
      if (button.dataset.channel === login) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    renderPlayer();
    if (current && window.matchMedia("(max-width: 830px)").matches) player.parentElement.scrollIntoView();
  }

  byId("stop-stream").addEventListener("click", () => {
    watch(null);
    byId("direct-channel").focus({ preventScroll: true });
  });
  new ResizeObserver(renderPlayer).observe(player);

  byId("stream-direct").addEventListener("submit", (event) => {
    event.preventDefault();
    const login = directLogin(byId("direct-channel").value);
    if (login) watch(login, login);
    else byId("stream-feedback").textContent = t("Enter a Twitch channel name or a link to its channel page.");
  });

  const feedback = (message) => { byId("search-feedback").textContent = t(message); };
  const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const notConfigured = localPreview
    ? "Search needs a configured Twitch API app. You can open a channel by name or link below."
    : "Browse by channel or category is not available yet. Open a channel by its exact name or link below.";
  const errors = {
    twitch_not_configured: notConfigured,
    invalid_query: "Enter a channel name or category.",
    twitch_rate_limited: "Twitch is limiting searches. Try again shortly.",
  };
  const unavailable = "Search is temporarily unavailable. You can still open a channel by name or link.";

  byId("stream-search").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (search.disabled) return;
    const term = query.value.trim();
    if (!term) return feedback(errors.invalid_query);
    search.disabled = true;
    results.replaceChildren();
    feedback("Searching live channels…");
    try {
      const url = new URL("api/twitch/search", location.href);
      url.searchParams.set("q", term);
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const payload = await response.json();
      if (!response.ok) return feedback(errors[payload.error] ?? unavailable);
      for (const result of payload.channels) {
        const login = channelName(result.login);
        if (!login) continue;
        const row = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.channel = login;
        button.className = "stream-result";
        const name = document.createElement("strong");
        name.textContent = result.name;
        const title = document.createElement("span");
        title.textContent = result.title;
        const category = document.createElement("small");
        category.textContent = result.category;
        button.append(name, title, category);
        button.addEventListener("click", () => watch(login, result.name));
        if (current?.login === login) button.setAttribute("aria-current", "true");
        row.append(button);
        results.append(row);
      }
      feedback(results.children.length ? "" : "No live channels found.");
    } catch {
      feedback(unavailable);
    } finally {
      search.disabled = false;
    }
  });

  async function enableSearch() {
    try {
      const response = await fetch("api/twitch/status", { signal: AbortSignal.timeout(3000) });
      const { configured } = response.ok ? await response.json() : {};
      if (configured === true) {
        query.disabled = search.disabled = false;
        return;
      }
    } catch {
      // Direct playback is still available if the local API is unavailable.
    }
    feedback(notConfigured);
  }

  const initialChannel = channelName(new URLSearchParams(location.search).get("channel") ?? "");
  if (initialChannel) {
    byId("direct-channel").value = initialChannel;
    watch(initialChannel, initialChannel);
  }
  enableSearch();
})();
