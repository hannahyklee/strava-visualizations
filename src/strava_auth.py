import os
import requests

from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")

def refresh_access_token():
    """
    Uses the refresh token to get a new access token from Strava.
    Updates the refresh token in .env file if a new one is provided.
    Returns the access token.
    """
    auth_url = "https://www.strava.com/oauth/token"
    payload = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'refresh_token': REFRESH_TOKEN,
        'grant_type': 'refresh_token'
    }
 
    try:
        response = requests.post(auth_url, data=payload)
        response.raise_for_status()  # Raise exception for 4XX/5XX responses
       
        data = response.json()
       
        # Update the refresh token if a new one is provided
        if "refresh_token" in data:
            new_refresh_token = data["refresh_token"]
            update_env_file('STRAVA_REFRESH_TOKEN', new_refresh_token)
        return data['access_token']
    except requests.exceptions.RequestException as e:
        print(f"Error refreshing token: {e}")
        if hasattr(response, 'json'):
            try:
                print(f"Response: {response.json()}")
            except:
                print(f"Status code: {response.status_code}")
        return None

def update_env_file(key, value):
    """
    Updates a single value in the .env file.
    """
    try:
        env_content = {}
        if os.path.exists(".env"):
            with open(".env", "r") as f:
                for line in f:
                    if '=' in line:
                        k, v = line.strip().split('=', 1)
                        env_content[k] = v 
        env_content[key] = value
        
        with open(".env", "w") as f:
            for k, v in env_content.items():
                f.write(f"{k}={v}\n")
                
        os.environ[key] = value
    except Exception as e:
        print(f"Error updating .env file: {e}")

if __name__=="__main__":
    refresh_access_token()