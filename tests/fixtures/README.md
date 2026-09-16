# Versioned parser fixtures

`control-center/v1/normal.html` is a reduced, anonymized extraction of the repository's existing `tests/control-center.xhr` response. Only the card structure, numeric ARP values and sanitized task markers are retained. It is a historical compatibility sample, not a claim about the current live website.

`empty.html` removes task rows from the recognized structure. `expired.html`, `changed.html` and `network-error.html` are synthetic scenarios. Tests must distinguish legitimate empty results from unrecognized pages and authentication failures.

To add a newly captured local HAR response:

```sh
node scripts/update-parser-fixtures.js /path/to/capture.har v2
```

The script rejects an existing version directory and writes only an allowlisted page subset, without request/response headers. Inspect the resulting HTML before committing. Keep the original capture local; it can contain account credentials. Add assertions for the affected parser behavior in operations.test.js. Parser errors report parser/version and missing fields, never the full HTML.
