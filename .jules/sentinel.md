## 2025-02-14 - Fix Hardcoded Secrets in opencode.json
**Vulnerability:** Found hardcoded access tokens and API keys (Supabase and TestSprite) in `opencode.json` configuration file.
**Learning:** MCP server configuration files in this project track credentials directly; they are at high risk of accidentally leaking to source control.
**Prevention:** Always use environment variable placeholders (e.g., `${VARIABLE_NAME}`) for sensitive credentials in tool configuration files like `opencode.json`.
