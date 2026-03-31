# Slack Tagging Skill

Ensure bots are tagged with `@` when mentioned in Slack.

## Logic

- Before sending a message in a Slack channel, check if the text contains a bot name without an `@` prefix.
- If found, prepend the `@`.
- Bot names to check: LicongBot, etc. (maintain a list in `config.yaml` or similar).

## Implementation

1. Parse output text.
2. If it contains known bot keywords, ensure they are `@` prefixed.
3. Send via `message` tool.
