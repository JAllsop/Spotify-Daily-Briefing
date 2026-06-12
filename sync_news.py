import os
import json
import requests

CLIENT_ID = os.environ['SPOTIFY_CLIENT_ID']
CLIENT_SECRET = os.environ['SPOTIFY_CLIENT_SECRET']
REFRESH_TOKEN = os.environ['SPOTIFY_REFRESH_TOKEN']

def get_access_token():
    url = "https://accounts.spotify.com/api/token"
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = requests.post(url, data=payload, headers=headers)
    response.raise_for_status()
    return response.json()["access_token"]

def main():
    try:
        with open("config.json", "r") as f:
            config = json.load(f)
    except Exception as e:
        print(f"Failed to read config.json: {e}")
        return

    PLAYLIST_ID = config.get("playlist_id")
    SHOW_IDS = config.get("show_ids", [])

    if not PLAYLIST_ID or not SHOW_IDS:
        print("Missing playlist_id or show_ids in configuration.")
        return

    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    episode_uris = []

    for show_id in SHOW_IDS:
        clean_id = show_id.split('/')[-1].split('?')[0]
        url = f"https://api.spotify.com/v1/shows/{clean_id}/episodes?limit=1"
        res = requests.get(url, headers=headers)
        
        if res.status_code == 200:
            items = res.json().get("items", [])
            if items:
                episode_uris.append(items[0]["uri"])
                print(f"Fetched latest episode for show: {clean_id}")
        else:
            print(f"Skipping show {clean_id}: HTTP {res.status_code}")

    if not episode_uris:
        print("No episodes retrieved. Exiting")
        return

    playlist_url = f"https://api.spotify.com/v1/playlists/{PLAYLIST_ID}/items"
    write_res = requests.put(playlist_url, headers=headers, json={"uris": episode_uris})
    
    if write_res.status_code in [200, 201]:
        print("Success! Your daily news playlist has been refreshed")
    else:
        print(f"Failed to update playlist: {write_res.text}")

if __name__ == "__main__":
    main()
