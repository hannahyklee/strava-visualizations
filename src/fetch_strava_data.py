import requests
import json
import os
from datetime import datetime, timedelta
import argparse
import time

from strava_auth import refresh_access_token

SUPPORTED_ACTIVITY_TYPES = ["Run", "WeightTraining"]

def fetch_activities(access_token, after=None, before=None):
    """
    Fetches all activities from Strava.
    """
    activities_url = "https://www.strava.com/api/v3/athlete/activities"
    headers = {'Authorization': f'Bearer {access_token}'}
    
    all_activities = []
    page = 1
    per_page = 100
    
    params = {'per_page': per_page, 'page': page}
    if after:
        params['after'] = after
    if before:
        params['before'] = before
    
    # Strava API returns max 200 activities per request; paginate
    while True:
        response = requests.get(activities_url, headers=headers, params=params)
        
        # Check for rate limiting
        if response.status_code == 429:
            print("Rate limited. Waiting 15 minutes...")
            time.sleep(900)  # Wait 15 minutes
            continue
            
        new_activities = response.json()
        
        if not new_activities:
            break
            
        print(f"{len(new_activities)} new activities found for page {page}.")
        all_activities.extend(new_activities)
        page += 1
        params['page'] = page
        
        # Be nice to the API - small pause between requests
        time.sleep(0.5)

    return all_activities

def process_activities(activities, activity_type):
    """
    Extract relevant fields for a given activity type.
    """
    activity_data = {}

    for activity in activities:
        date = activity['start_date_local'].split('T')[0]
        data_entry = {}
        if activity['type'] == activity_type == "Run":
            data_entry = {
                "distance_miles": activity['distance'] * 0.000621371, # meters to miles
            }
        elif activity['type'] == activity_type == "WeightTraining":
            data_entry = {
                "elapsed_time": activity['elapsed_time'], # seconds
            }

        # add if data entry found
        if data_entry != {}:
            if date in activity_data:
                for key in data_entry:
                    activity_data[date][key] += data_entry[key] # if date already exists, add the values
            else:
                activity_data[date] = data_entry

    return activity_data

def load_existing_data(file_path):
    """Load existing JSON data."""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_data(data, file_path):
    """Save data to JSON file."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=4)

def get_latest_activity_timestamp(data):
    """Get timestamp of the latest logged activity."""
    # Find the latest activity date
    if not data:
        # Default to 1 year ago if no data
        return int((datetime.now() - timedelta(days=365)).timestamp())
    
    latest_date = max(data.keys())
    # Add 1 day to avoid duplicates
    timestamp = int(datetime.strptime(latest_date, '%Y-%m-%d').timestamp()) + 86400
    return timestamp

def generate_activity_data(access_token, activity_type, data_dir, start_date=None, end_date=None, incremental=False):
    """
    Fetch and process activities of a specific type.
    """
    if activity_type not in SUPPORTED_ACTIVITY_TYPES:
        print(f"Error: Unsupported activity type. Supported types: {', '.join(SUPPORTED_ACTIVITY_TYPES)}")
        return

    file_path = os.path.join(data_dir, f"{activity_type.lower()}_activities.json")
    existing_data = {}
    if os.path.exists(file_path):
        print(f"Found existing data file: {file_path}...")
        if incremental:
            existing_data = load_existing_data(file_path)
            print(f"Loaded {len(existing_data)} existing entries and appending new data...")
        else:
            print(f"Not using incremental mode. Overwriting existing file: {file_path}")
    else:
        print(f"No existing data found. Creating new file: {file_path}")

    after = None
    before = None

    if incremental and existing_data:
        after = get_latest_activity_timestamp(existing_data)
        print(f"Fetching activities after {datetime.fromtimestamp(after).strftime('%Y-%m-%d')}")
    elif start_date:
        after = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp())

    if end_date:
        before = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp())

    # get all strava activities within the given time frame
    activities = fetch_activities(access_token, after, before)

    if not activities:
        print("No new activities found")
        return existing_data

    # get formatted activity data for new activities of given type within given time frame
    new_activity_data = process_activities(activities, activity_type)

    if incremental:
        for date, data in new_activity_data.items():
            if date not in existing_data:
                existing_data[date] = data
            else: # this should never be the case, since we extract the latest date for --incremental
                print(f"Error: Duplicate entry for {date} found. Skipping...")
    else:
        existing_data = new_activity_data

    existing_data = dict(sorted(existing_data.items(), key=lambda x: x[0], reverse=True))

    save_data(existing_data, file_path)
    print(f"Updated {activity_type} data with {len(new_activity_data)} new entries")
    return existing_data

def dump_all_raw_data(access_token, start_date=None, end_date=None, incremental=False):
    """
    Fetch all activity data and store it as a raw JSON file.
    This is useful for storing *all* stats Strava provides. This may output more information
    than needed or more information than you'd like to publicly share, so use with caution.
    """
    # raw data should stay in src/src_data
    file_path = os.path.join("src_data/", "all_activities.json")

    existing_data = []

    if os.path.exists(file_path):
        print(f"Found existing data file: {file_path}...")
        if incremental:
            existing_data = load_existing_data(file_path)
            print(f"Loaded {len(existing_data)} existing entries and appending new data...")
        else:
            print(f"Not using incremental mode. Overwriting existing file: {file_path}")
    else:
        print(f"No existing data found. Creating new file: {file_path}")

    after = None
    before = None

    if incremental and len(existing_data) > 0:
        after = max([activity['start_date'] for activity in existing_data])
        after = int(datetime.strptime(after, "%Y-%m-%dT%H:%M:%SZ").timestamp())
        print(f"Fetching activities after {datetime.fromtimestamp(after).strftime('%Y-%m-%d')}")
    elif start_date:
        after = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp())

    if end_date:
        before = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp())

    # get all strava activities within the given time frame
    activities = fetch_activities(access_token, after, before)

    if not activities:
        print("No new activities found")
        return existing_data

    # Append new activities to the existing raw data
    all_data = existing_data + activities

    all_data.sort(key=lambda x: x["start_date"], reverse=True)

    save_data(all_data, file_path)
    print(f"Saved all raw activities ({len(all_data)} total) to {file_path}")

def main():
    parser = argparse.ArgumentParser(description="Fetch and process Strava activities")

    exclusive_group = parser.add_mutually_exclusive_group(required=True)
    exclusive_group.add_argument("--activity-type", type=str, help="Type of activity to fetch (Run, WeightTraining)")
    exclusive_group.add_argument("--raw-all", action="store_true", help="Dump all raw activity data")

    parser.add_argument("--start-date", type=str, help="Fetch activities after this date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="Fetch activities before this date (YYYY-MM-DD)")
    parser.add_argument("--incremental", action="store_true", help="Only fetch new activities since last update. If no existing data found, defaults to last year.")
    parser.add_argument("--data-dir", type=str, default="src_data/", help="Directory to store activity data (default: 'src_data/'). Not used for raw data dump.")

    args = parser.parse_args()

    access_token = refresh_access_token()
    if not access_token:
        print("Failed to refresh access token")
        return
   
    if args.raw_all:
        dump_all_raw_data(access_token, args.start_date, args.end_date, args.incremental)
    else:
        generate_activity_data(access_token, args.activity_type, args.data_dir, args.start_date, args.end_date, args.incremental)

if __name__ == "__main__":
    main()

