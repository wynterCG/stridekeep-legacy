"use strict";

(() => {
  const { language, t } = globalThis.StrideLocale;
  const byId = (id) => document.getElementById(id);
  const channelName = (value) => typeof value === "string" && /^[a-z0-9_]{1,25}$/i.test(value) ? value.toLowerCase() : null;
  const requestedChannel = channelName(new URL(location.href).searchParams.get("channel"));

  // Old stream bookmarks and the Workspace card now enter the same game screen.
  const legacyLink = byId("watch-home-link");
  if (legacyLink) {
    const target = new URL(legacyLink.href);
    target.searchParams.set("lang", language);
    if (requestedChannel) target.searchParams.set("channel", requestedChannel);
    legacyLink.href = target;
    location.replace(target.href);
    return;
  }

  const panel = byId("watch-stream");
  if (!panel) return;
  panel.innerHTML = `
    <div class="watch-heading">
      <h2 id="video-title">Twitch</h2>
      <button type="button" id="stop-stream" hidden data-stream-text>Close player</button>
    </div>
    <div id="stream-bridge" class="watch-bridge" hidden>
      <p id="bridge-message"></p>
      <a id="stream-preview" class="stream-preview" target="_blank" rel="noopener" data-stream-text>Open Watch and play</a>
    </div>
    <details id="stream-chooser" class="watch-chooser" open>
      <summary id="choose-channel-label" data-stream-text>Choose a channel</summary>
      <div class="channel-controls">
        <form id="stream-direct" class="stream-form">
          <label for="direct-channel" data-stream-text>Twitch channel name or link</label>
          <div class="stream-form-row">
            <input type="text" id="direct-channel" name="channel" maxlength="300" autocomplete="off" spellcheck="false" required>
            <button type="submit" id="watch-channel" data-stream-text>Open channel</button>
          </div>
          <p id="stream-feedback" class="stream-notice" role="status"></p>
        </form>
        <details id="channel-directory">
          <summary data-stream-text>Live channels</summary>
          <form id="stream-search" class="stream-form">
            <label for="stream-query" data-stream-text>Channel or category</label>
            <div class="stream-form-row">
              <input type="search" id="stream-query" name="query" maxlength="100" required disabled>
              <button type="submit" id="search-channels" data-stream-text disabled>Search</button>
            </div>
          </form>
          <p id="search-feedback" class="stream-notice" role="status"></p>
          <ul id="stream-results" class="stream-results"></ul>
        </details>
      </div>
    </details>
    <p id="stream-placeholder" class="stream-placeholder" hidden></p>
    <div id="stream-player" class="stream-player"></div>`;
  for (const node of panel.querySelectorAll("[data-stream-text]")) node.textContent = t(node.textContent);
  const chooser = byId("stream-chooser");
  const player = byId("stream-player");
  const placeholder = byId("stream-placeholder");
  const results = byId("stream-results");
  const search = byId("search-channels");
  const query = byId("stream-query");
  const direct = byId("direct-channel");
  if (requestedChannel) direct.value = requestedChannel;
  results.setAttribute("aria-label", t("Live channels"));

  const mobileReport = location.pathname.startsWith("/mobile/view/");
  const localReport = !location.hostname || /^(\/mobile)?\/view\//.test(location.pathname);
  if (localReport || window !== window.top) {
    chooser.hidden = true;
    byId("stream-bridge").hidden = false;
    const link = byId("stream-preview");
    const message = localReport && !mobileReport
      ? "Run the local preview on this computer, then open it to watch while playing."
      : "To watch on this device, open the standalone Stridekeep site in a browser.";
    byId("bridge-message").textContent = t(message);
    if (mobileReport) {
      // The desktop launcher only listens on loopback; a phone's localhost is the phone itself.
      link.hidden = true;
    } else {
      const target = localReport ? new URL("http://localhost:8788/") : new URL(location.href);
      target.hash = "watch";
      target.searchParams.set("lang", language);
      if (requestedChannel) target.searchParams.set("channel", requestedChannel);
      link.href = target;
    }
    return;
  }

  let current = null;
  let checkedSearch = false;

  function directLogin(value) {
    const input = value.trim().replace(/^@/, "");
    const login = channelName(input);
    if (login) return login;
    const address = /^(www\.|m\.)?twitch\.tv\//i.test(input) ? `https://${input}` : input;
    try {
      const url = new URL(address);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port ||
          !["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(url.hostname)) return null;
      return channelName(url.pathname.replace(/^\/|\/$/g, ""));
    } catch {
      return null;
    }
  }

  function renderPlayer() {
    const fits = player.clientWidth >= 400;
    const display = !panel.hidden && current && fits;
    if (display && player.firstElementChild?.dataset.channel === current.login) return;
    if (!display) {
      if (player.firstChild) player.replaceChildren();
      placeholder.hidden = panel.hidden || !current || fits;
      placeholder.textContent = t("Widen the window or rotate the screen to watch.");
      return;
    }
    placeholder.hidden = true;
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
    byId("video-title").textContent = current ? current.name : "Twitch";
    byId("stop-stream").hidden = !current;
    byId("choose-channel-label").textContent = t(current ? "Change channel" : "Choose a channel");
    chooser.open = !current;
    byId("stream-feedback").textContent = "";
    for (const button of results.querySelectorAll("button")) {
      if (button.dataset.channel === login) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    if (current) direct.value = login;
    renderPlayer();
    if (current) byId("choose-channel-label").focus({ preventScroll: true });
    else direct.focus({ preventScroll: true });
  }

  byId("stop-stream").addEventListener("click", () => watch(null));
  byId("stream-direct").addEventListener("submit", (event) => {
    event.preventDefault();
    const login = directLogin(direct.value);
    if (login) watch(login, login);
    else byId("stream-feedback").textContent = t("Enter a Twitch channel name or a link to its channel page.");
  });

  const feedback = (message) => { byId("search-feedback").textContent = t(message); };
  const errors = {
    twitch_not_configured: "Search is unavailable here. Open a channel by its Twitch name or link.",
    invalid_query: "Enter a channel name or category.",
    twitch_rate_limited: "Twitch is limiting searches. Try again shortly.",
  };
  const unavailable = "Search is temporarily unavailable. You can still open a channel by name or link.";
  async function enableSearch() {
    try {
      const response = await fetch("api/twitch/status", { signal: AbortSignal.timeout(3000) });
      if (response.ok && (await response.json()).configured === true) {
        query.disabled = search.disabled = false;
        return;
      }
    } catch {
      // Opening a known channel works without the search service.
    }
    feedback(errors.twitch_not_configured);
  }

  byId("channel-directory").addEventListener("toggle", (event) => {
    if (event.target.open && !checkedSearch) {
      checkedSearch = true;
      enableSearch();
    }
  });
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

  // Game inventory renders do not own the iframe. Stop playback off-screen, including on mode exit.
  new ResizeObserver(renderPlayer).observe(player);
  new MutationObserver(renderPlayer).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
})();
