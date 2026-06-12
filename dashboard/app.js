const REPO_OWNER = "JAllsop";
const REPO_NAME = "Spotify-Daily-Briefing";
const CONFIG_PATH = "config.json";

let currentFileSha = null;
let currentShowIds = [];

window.onload = function () {
    document.getElementById("ghToken").value = localStorage.getItem("gh_pat_token") || "";
    bindPasswordToggleButtons();

    if (localStorage.getItem("gh_pat_token")) {
        loadConfigFromGitHub();
    }
};

function bindPasswordToggleButtons() {
    const buttons = document.querySelectorAll(".password-toggle-btn");
    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-toggle-target");
            const input = document.getElementById(targetId);
            if (!input) return;

            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            btn.textContent = isHidden ? "Hide" : "Show";
            btn.setAttribute("aria-pressed", String(isHidden));
        });
    });
}

function saveCredentials() {
    const ghToken = document.getElementById("ghToken").value.trim();

    localStorage.setItem("gh_pat_token", ghToken);

    showStatus("Credentials locked into browser storage layer.", "text-emerald-400");
    loadConfigFromGitHub();
}

function parseSpotifyShowId(showRef) {
    if (!showRef) return null;

    try {
        if (showRef.startsWith("spotify:show:")) {
            return showRef.split(":").pop() || null;
        }
        const url = new URL(showRef);
        const match = url.pathname.match(/\/show\/([A-Za-z0-9]+)/);
        return match?.[1] || null;
    } catch {
        // Fallback: If it's just a 22-character alphanumeric string, assume it's the ID
        return /^[A-Za-z0-9]{22}$/.test(showRef) ? showRef : null;
    }
}

function toSpotifyShowUrl(showRef) {
    const showId = parseSpotifyShowId(showRef);
    if (showId) return `https://open.spotify.com/show/$${showId}`;
    return showRef;
}

async function fetchShowMetadata(showRef) {
    const showId = parseSpotifyShowId(showRef);

    // Fallback data if the fetch completely fails
    const defaultData = {
        id: showRef,
        title: showId || "Unknown Show",
        img: "https://placehold.co/60x60/1e293b/10b981?text=Audio"
    };

    if (!showId) return defaultData;

    try {
        const spotifyUrl = `https://open.spotify.com/show/$${showId}`;
        const oembedUrl = `https://open.spotify.com/oembed?url=$${encodeURIComponent(spotifyUrl)}`;
        
        // Swapped to corsproxy.io
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(oembedUrl)}`;

        const res = await fetch(proxyUrl);

        if (!res.ok) {
            console.warn(`Spotify API returned HTTP ${res.status} for show ${showId}`);
            return defaultData;
        }

        const data = await res.json();

        return {
            id: showRef,
            title: data.title || defaultData.title,
            img: data.thumbnail_url || defaultData.img
        };
    } catch (err) {
        console.warn(`Network/CORS error fetching metadata for ${showRef}:`, err);
        return defaultData;
    }
}

async function loadConfigFromGitHub() {
    const token = localStorage.getItem("gh_pat_token");
    if (!token) return showStatus("GitHub token required to fetch setup profile data.", "text-amber-400");

    showStatus("Parsing config file state via API...", "text-slate-400");
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONFIG_PATH}`;

    try {
        const res = await fetch(url, {
            headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json" }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        currentFileSha = data.sha;

        let config = { playlist_id: "", show_ids: [] };
        if (data.content && data.content.trim() !== "") {
            try {
                config = JSON.parse(atob(data.content));
            } catch (parseErr) {
                console.warn("File content was not valid JSON - initializing with defaults");
            }
        }

        document.getElementById("playlistId").value = config.playlist_id || "";
        currentShowIds = config.show_ids || [];

        await renderRichCards();
        showStatus("Configuration loaded", "text-emerald-400");
    } catch (err) {
        showStatus(`Failed loading configuration: ${err.message}`, "text-rose-400");
    }
}

async function renderRichCards() {
    const container = document.getElementById("richSourcesContainer");

    container.innerHTML = "";

    for (let i = 0; i < currentShowIds.length; i++) {
        const url = currentShowIds[i];
        const div = document.createElement("div");
        div.id = `card-placeholder-${i}`;
        div.className = "flex items-center justify-between bg-slate-900 border border-slate-700/60 p-3 rounded-lg shadow-inner opacity-60";
        div.innerHTML = `<div class="text-xs text-slate-500 animate-pulse tracking-wide">Fetching metadata for item ${i + 1}...</div>`;
        container.appendChild(div);
        
        const show = await fetchShowMetadata(url);

        div.className = "flex items-center justify-between bg-slate-900 border border-slate-700/60 p-3 rounded-lg animate-fade-in shadow-inner";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="${show.img}" class="w-12 h-12 rounded object-cover shadow-md border border-slate-700">
                <div>
                    <h3 class="text-sm font-semibold text-slate-100">${show.title}</h3>
                    <p class="text-[10px] text-slate-500 font-mono tracking-tighter truncate max-w-xs md:max-w-md">${show.id}</p>
                </div>
            </div>
            <button onclick="removeSource(${i})" class="text-slate-500 hover:text-rose-400 p-2 cursor-pointer transition text-sm">✕</button>
        `;

        // 4. Add a 500ms delay before the next request to appease the proxy's rate limits
        if (i < currentShowIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (currentShowIds.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-500">No shows in sequence. Add one above.</div>`;
    }
}

function addSourceFromInput() {
    const input = document.getElementById("newSourceUrl");
    const value = input.value.trim();
    if (!value) return;

    currentShowIds.push(value);
    input.value = "";
    renderRichCards();
}

function removeSource(index) {
    currentShowIds.splice(index, 1);
    renderRichCards();
}

async function saveConfigToGitHub() {
    const token = localStorage.getItem("gh_pat_token");
    const playlistId = document.getElementById("playlistId").value.trim();

    if (!token || !currentFileSha) return alert("Fetch tracking configuration profile before committing updates");
    if (!playlistId) return alert("Target playlist ID required.");

    const updatedConfig = { playlist_id: playlistId, show_ids: currentShowIds };
    const jsonString = JSON.stringify(updatedConfig, null, 2);

    showStatus("Deploying configuration commit update patch...", "text-slate-400");
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${CONFIG_PATH}`;

    try {
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `token ${token}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify({
                message: "Dashboard Modular UI: Update sync profiles config layer",
                content: btoa(unescape(encodeURIComponent(jsonString))),
                sha: currentFileSha
            })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        currentFileSha = data.content.sha;
        showStatus("Success! Configuration verified and committed.", "text-emerald-400");
    } catch (err) {
        showStatus(`Commit rejected: ${err.message}`, "text-rose-400");
    }
}

function showStatus(msg, colorClass) {
    const el = document.getElementById("statusMessage");
    el.className = `text-xs font-medium ${colorClass}`;
    el.innerText = msg;
}