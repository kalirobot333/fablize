# api-client

Small HTTP client config loader.

## Settings

| Setting | Env var | Flag | Default |
|---|---|---|---|
| `baseUrl` | `APP_BASE_URL` | `--base-url` | `http://localhost:8080` |
| `timeout` | `APP_TIMEOUT` | `--timeout` | `5000` (ms) |
| `retries` | `APP_RETRIES` | `--retries` | `2` |

Later sources win: `defaults.json`, then the config file, then environment variables, then flags.

Run `node cli.js --timeout=2000` to see the effective config.
