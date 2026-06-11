import os
import requests

CLIENT_ID = os.environ['SPOTIFY_CLIENT_ID']
CLIENT_SECRET = os.environ['SPOTIFY_CLIENT_SECRET']
REFRESH_TOKEN = os.environ['SPOTIFY_REFRESH_TOKEN']
PLAYLIST_ID = os.environ['SPOTIFY_PLAYLIST_ID']

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
    token = get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    SHOW_IDS = [
        "https://open.spotify.com/show/5X9SaDtLmvmdVnvvGxYJjr?si=fe8bb29348a64116",   # TimesLIVE
        "https://open.spotify.com/show/4Nql1yN0RNSBBBB6jCxFzB?si=f096af06876b42e0",  # DW News Brief
        "https://open.spotify.com/show/51MrXc7hJQBE2WJf2g4aWN?si=6c228c91a53a4b47",  # WSJ TechNews Briefing
        "https://open.spotify.com/show/5q8wg5rFYbbeDk0kk7t6Uc?si=138096a2133a4cd2",  # Bloomberg News Now
        "https://open.spotify.com/show/20YFzEUPS4f0oX5YIBUb9Q?si=30fd965c1eb04fba",  # EngadgetNews+Next
        "https://open.spotify.com/show/4G13yWDOUT0NBMfETpCQdi?si=a030c617abc44106",  # MRKT Matrix
        "https://open.spotify.com/show/1cBhYjm2fildfRsNDEYLcm?si=b577ce21bf864dcd",  # TechLinked
        "https://open.spotify.com/show/1xGSLDgVYxLybmXpui6wwo?si=63e0f993e7a649dc"   # CNN 5 Things
    ]

    episode_uris = []

    for show_id in SHOW_IDS:
        # Strip out any full URL tracking clutter (for safety)
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

    # PUT replaces all existing items in the playlist atomically
    playlist_url = f"https://api.spotify.com/v1/playlists/{PLAYLIST_ID}/items"
    write_res = requests.put(playlist_url, headers=headers, json={"uris": episode_uris})
    
    if write_res.status_code in [200, 201]:
        print("Success! Your daily news playlist has been refreshed")
    else:
        print(f"Failed to update playlist: {write_res.text}")

if __name__ == "__main__":
    main()