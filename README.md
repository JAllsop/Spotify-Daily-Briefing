# Spotify Daily Briefing

![Spotify Daily Briefing](dashboard/logo.png)

Automatically refresh a Spotify playlist with the latest episode from a curated list of news podcasts

[Dashboard](https://jallsop.github.io/Spotify-Daily-Briefing/dashboard/)

## Why This Exists

Google Assistant's old "Play the news" behavior is broken or unreliable for many users. This project serves as a modern replacement: it keeps a dedicated Spotify playlist updated with the latest news podcast episodes so you can get a fresh briefing on demand

You can trigger playback with a Gemini or Google Assistant routine to emulate the same "Play the news" experience (for example, a voice or scheduled routine that starts this specific playlist)

This repo contains:
- `config.json`: Centralized configuration file holding your playlist ID and podcast sources
- `sync_news.py`: Python script that reads the configuration, fetches the newest episode from each show, and replaces playlist items
- `.github/workflows/sync.yml`: GitHub Actions workflow that executes the script on an automated schedule

## Managing Your Podcast Lineup

Your podcast lineup is entirely decoupled from the codebase and managed dynamically inside **`config.json`**. To update playlist targets, rearrange the playback sequence, or change your news lineup entirely, you can edit your configuration directly on GitHub.com without touching the Python script:

1. Open **`config.json`*- in your browser
2. Click the **Pencil Icon*- (Edit this file)
3. Modify the `playlist_id` or add/remove entries in the `show_ids` array. You can paste raw Spotify show share links directly, ordered from top to bottom in your preferred playback sequence:

```json
{
  "playlist_id": "YOUR_PLAYLIST_ID",
  "show_ids": [
    "[https://open.spotify.com/show/](https://open.spotify.com/show/)<your_show_id_1>",
    "[https://open.spotify.com/show/](https://open.spotify.com/show/)<your_show_id_2>",
    "[https://open.spotify.com/show/](https://open.spotify.com/show/)<your_show_id_3>"
  ]
}
```

4. Commit the changes. The automated hourly worker will pick up your modifications on its very next run

> **Tip:*- The script automatically extracts the unique 22-character show ID from each URL, so tracking query parameters (like `?si=...`) will not break the execution

## How It Works

1. The GitHub Actions runner triggers the Python script
2. The script exchanges your long-lived Spotify **Refresh Token*- for a temporary **Access Token**
3. The script reads `config.json` to extract your target playlist ID and source links
4. It loops through the links, requests the single most recent track (`limit=1`) from Spotify's catalog for each show, and collects their URIs
5. It sends an atomic `PUT` request to the Spotify `/items` endpoint, completely wiping yesterday's tracks and setting up the new lineup in one clean operation

## Requirements

- A Spotify Developer App with a validated User Whitelist
- Python 3.11+ (handled natively within the GitHub Actions runner environment)
- Three core environment keys configured inside your repository secrets

## GitHub Secrets

To keep your credentials secure, add these three repository secrets in GitHub:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

**Path in GitHub UI:*- `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

*(Note: Your `SPOTIFY_PLAYLIST_ID` is handled safely inside `config.json`, meaning you only need to manage these 3 core authentication keys as secrets)*

## Workflow Schedule

The workflow is configured in `.github/workflows/sync.yml` and triggers automatically:

- **Every hour at minute 0*- (`cron: '0 - - - *'`) to ensure your floating schedule always has current feeds
- **On manual trigger*- (`workflow_dispatch`) via the "Run workflow" button in your GitHub Actions tab for instant testing

## Run Locally

If you want to test the execution locally inside your workspace terminal:

1. Export your credentials into your active session:
```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
export SPOTIFY_REFRESH_TOKEN="your_refresh_token"
```

2. Install dependencies:
```bash
pip install requests
```

3. Execute the worker sync:
```bash
python sync_news.py
```

## Notes

- Playlist updates are atomic via `PUT /v1/playlists/{playlist_id}/items`
- Legacy applications using the deprecated `/tracks` endpoint will receive a `403 Forbidden` error; this codebase is explicitly locked to the updated `/items` standard
- If no active episodes are retrieved during a run, the script terminates safely without clearing or altering your current playlist layout
