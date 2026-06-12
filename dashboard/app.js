const REPO_OWNER = "JAllsop"; 
const REPO_NAME = "Spotify-Daily-Briefing";
const CONFIG_PATH = "config.json";
const SPOTIFY_CLIENT_ID = "ad5b5f8eb8924e0eab1b3d69349d0203";

let currentFileSha = null;
let currentShowIds = [];

window.onload = function() {
    document.getElementById("ghToken").value = localStorage.getItem("gh_pat_token") || "";
    document.getElementById("spotSecret").value = localStorage.getItem("spotify_client_secret") || "";
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
    const spotSecret = document.getElementById("spotSecret").value.trim();
    
    localStorage.setItem("gh_pat_token", ghToken);
    localStorage.setItem("spotify_client_secret", spotSecret);
    
    showStatus("Credentials locked into browser storage layer.", "text-emerald-400");
    loadConfigFromGitHub();
}

async function getSpotifyToken() {
    const secret = localStorage.getItem("spotify_client_secret");
    if (!secret) return null;

    try {
        const url = `https://corsproxy.io/?${encodeURIComponent("https://accounts.spotify.com/api/token")}`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + secret)
            },
            body: "grant_type=client_credentials"
        });
        const data = await res.json();
        return data.access_token;
    } catch (e) {
        console.error("Failed to fetch Spotify auth token", e);
        return null;
    }
}

async function fetchShowMetadata(showUrl, token) {
    const cleanId = showUrl.split('/').pop().split('?')[0];
    const defaultData = { id: showUrl, title: cleanId, img: "https://placehold.co/60x60/1e293b/10b981?text=News" };
    
    if (!token) return defaultData;

    try {
        const res = await fetch(`https://api.spotify.com/v1/shows/${cleanId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return defaultData;
        const data = await res.json();
        return {
            id: showUrl,
            title: data.name,
            img: data.images[0]?.url || defaultData.img
        };
    } catch {
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
    container.innerHTML = `<div class="text-xs text-slate-500 animate-pulse">Fetching rich artwork elements from Spotify...</div>`;
    
    const spotToken = await getSpotifyToken();
    const cardPromises = currentShowIds.map(url => fetchShowMetadata(url, spotToken));
    const results = await Promise.all(cardPromises);
    
    container.innerHTML = "";
    results.forEach((show, index) => {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between bg-slate-900 border border-slate-700/60 p-3 rounded-lg animate-fade-in shadow-inner";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="${show.img}" class="w-12 h-12 rounded object-cover shadow-md border border-slate-700">
                <div>
                    <h3 class="text-sm font-semibold text-slate-100">${show.title}</h3>
                    <p class="text-[10px] text-slate-500 font-mono tracking-tighter truncate max-w-xs md:max-w-md">${show.id}</p>
                </div>
            </div>
            <button onclick="removeSource(${index})" class="text-slate-500 hover:text-rose-400 p-2 cursor-pointer transition text-sm">✕</button>
        `;
        container.appendChild(div);
    });
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