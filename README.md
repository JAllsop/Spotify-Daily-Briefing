# Spotify Daily Briefing

Automatically refresh a Spotify playlist with the latest episode from a curated list of news podcasts

This repo contains:

- `sync_news.py`: Python script that fetches the newest episode from each show and replaces playlist tracks
- `.github/worflows/sync.yml`: GitHub Actions workflow that runs the script on a schedule

## How It Works

1. The script exchanges your Spotify refresh token for an access token
2. It loops through configured show links and extracts each show ID
3. It fetches the most recent episode (`limit=1`) for each show
4. It sends a `PUT` request to replace all playlist tracks with the collected episode URIs

If no episodes are retrieved, the script exits without modifying the playlist

## Requirements

- A Spotify app with:
	- `SPOTIFY_CLIENT_ID`
	- `SPOTIFY_CLIENT_SECRET`
- A valid `SPOTIFY_REFRESH_TOKEN`
- A target `SPOTIFY_PLAYLIST_ID`
- Python 3.11+ (3.11 is used in GitHub Actions)

## GitHub Secrets

Add these repository secrets in GitHub:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`
- `SPOTIFY_PLAYLIST_ID`

Path in GitHub UI:

`Settings -> Secrets and variables -> Actions -> New repository secret`

## Workflow Schedule

The workflow is configured in `.github/worflows/sync.yml` and runs:

- Every hour at minute `0` (`cron: 0 * * * *`)
- On manual trigger (`workflow_dispatch`)

## Run Locally

1. Export required environment variables:

```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
export SPOTIFY_REFRESH_TOKEN="your_refresh_token"
export SPOTIFY_PLAYLIST_ID="your_playlist_id"
```

2. Install dependency:

```bash
pip install requests
```

3. Run the sync:

```bash
python sync_news.py
```

## Notes

- Playlist updates are atomic via `PUT /v1/playlists/{playlist_id}/tracks`
- Existing playlist items are replaced each run
- The show list is currently hardcoded in `sync_news.py` under `SHOW_IDS`
