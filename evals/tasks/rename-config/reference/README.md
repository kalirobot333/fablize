# api-client

Small HTTP client config loader.

## Settings

| Setting | Env var | Flag | Default |
|---|---|---|---|
| `baseUrl` | `APP_BASE_URL` | `--base-url` | `http://localhost:8080` |
| `requestTimeout` | `APP_REQUEST_TIMEOUT` | `--request-timeout` | `5000` (ms) |
| `retries` | `APP_RETRIES` | `--retries` | `2` |

Later sources win: `defaults.json`, then the config file, then environment variables, then flags.

The old names `timeout`, `APP_TIMEOUT` and `--timeout` still work but log a deprecation warning.

Run `node cli.js --request-timeout=2000` to see the effective config.
