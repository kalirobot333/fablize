Rename the `timeout` setting in this project to `requestTimeout` everywhere it is read or documented: the config key, the `APP_TIMEOUT` environment variable (new name `APP_REQUEST_TIMEOUT`) and the `--timeout` CLI flag (new name `--request-timeout`).

The old names must keep working for now. Each old name that is actually used should log one deprecation warning with `console.warn` that mentions the old name. If an old and a new name are both given, the new one wins.

Done means `node --test` still passes and nothing reads the old `timeout` setting except the code that supports the old names. Only work inside this folder.
