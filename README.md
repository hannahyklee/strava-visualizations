# strava-visualizations (work in progress)

## Strava API Connection

This repo assumes that you have your own Strava API application.
Follow instructions [here](https://developers.strava.com/docs/getting-started/) to set up an application.

You will need to store your Strava client id, client secret, and refresh token.
`strava_auth.py` assumes that these variables are saved in an `.env` file (`src/.env`), as the following:
```
STRAVA_CLIENT_ID=<client id>
STRAVA_CLIENT_SECRET=<client secret>
STRAVA_REFRESH_TOKEN=<refresh token>
```

When first authenticating, you will likely need to retrieve an authentication code with the proper scope and exchange it for a new refresh token and access token. This is to ensure that you have the correct scope to get activity data necessary for creating visualizations. 

To do this, follow the steps in Section D of the [Strava setup page](https://developers.strava.com/docs/getting-started/). In short:
1. Go to `https://www.strava.com/oauth/authorize?client_id=[YOUR CLIENT ID]&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=read,activity:read_all`
2. Click `Authorize` 
3. Copy the `code` variable from the URL (the page will say that the site can't be reached)
4. Make a cURL request:
    `curl -X POST https://www.strava.com/oauth/token -F client_id=<STRAVA_CLIENT_ID> -F client_secret=<STRAVA_CLIENT_SECRET> -F code=<CODE FROM STEP 3> -F grant_type=authorization_code`
5. Replace your `STRAVA_REFRESH_TOKEN` variable with the new refresh token from step 4 that has the proper scope.

Running `strava_auth.py` should run without error.

## Fetching Strava Data

Fetching activity data from Strava is done through the `fetch_strava_data.py` script.

### Usage

```
python fetch_strava_data.py --activity-type Run --start-date 2024-01-01 --end-date 2024-03-01
```

### Parameters
- Mutually exclusive options (required):
    - `--activity-type TYPE`: Fetch activities of a specific type (e.g., Run, WeightTraining). Currently, only one activity type at a time is supported.
    - `--raw-all`: Dump all activity data fetched from Strava.
- `--start-date YYYY-MM-DD`: Fetch activities after this date.
- `--end-date YYYY-MM-DD`: Fetch activities before this date.
- `--incremental` Only fetch new activities since the last update. If no existing data is found, defaults to the last year.
- `--data-dir DIR`: Directory to store activity data (default: `data/`)

**Note:** While `start-date`, `end-date`, and `incremental` are not exclusive, expected usage is that `incremental` should be used without `start-date` (or `end-date`) as it is used as a flag to find the most recent activities from where an existing file left off. Because of this, if `incremental` is set and the script finds existing data for the activity type, the `start-date` parameter (if set) will be ignored. 

### Examples

| Usage | Description |
|-------|-------------|
|`python fetch_strava_data.py --raw-all`| Dump all activity data from Strava into `all_activities.json`.|
|`python fetch_strava_data.py --activity-type Run`| Get all run activities from Strava and save in `run_activities.json`.|
|`python fetch_strava_data.py --activity-type Run --incremental`| Get all run activities from Strava that aren't already in `run_activities.json` and add them. If `run_activities.json` can't be found, then create and add the last year's worth of activities.|
|`python script.py --activity-type Run --start-date 2024-01-01` | Fetch all running activities from 2024 onwards. | 


### Data

While `--raw-all` enables a dump of all activity data fetched from Strava, you likely do not need all of the data nor do you need to share all of the information publicly. The base version of this repository sets specific data fields to store per activity type and stores each activity type's collected data in a separate `type_activities.json` file, while the dump defaults to `all_activities.json` (which is set to be ignored). Each `type_activities.json` file uses the date of activity as the key. The supported activity types and corresponding collected data fields are below. 

| Activity Type | Data Fields |
| ------------- | ----------- |
| Run | `distance_miles`, `elapsed_time` (in seconds), `moving_time` (in seconds), `elevation_gain (in meters) |
| WeightTraining | `elapsed_time` (in seconds)|

## Visualizations

Visualizations are created individually as JavaScript scripts in `/docs/visualizations/`. 

### Preview

Run `python -m http.server 8000` from the root of the repo. Navigate to `http://localhost:8000/docs/index.html` to view sample visualization(s).

