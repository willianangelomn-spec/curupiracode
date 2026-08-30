# @deepseek-ai/dsh-llm-gemini

A DeepSeek Harness LLM adapter that serves Google's **Gemini** through a
**Google account sign-in** instead of an API key. The human authorizes the
`gemini` provider from the Models page (or the authorization panel); the adapter
exchanges the OAuth grant for an access token and calls the Gemini
`streamGenerateContent` endpoint with `Authorization: Bearer`.

## Why a separate package

The bundled multi-provider adapter (`llm-pi-ai`) ships Google's provider, but
that provider authenticates with a static `GEMINI_API_KEY` and exposes no login
flow. Adding login there would mean replacing its streaming implementation, so
Gemini-via-login lives in its own adapter that talks to the Gemini REST API
directly with the OAuth token.

## Flow

1. The adapter registers the `gemini` route, a configurable-provider directory
   entry, and model discovery against the curated Gemini catalog.
2. An authorization flow (`Sign in with Google`) runs the OAuth Authorization
   Code grant with PKCE and a host-side `localhost` redirect listener — the same
   posture `gemini-cli` uses, which works from both the CLI and the local web
   surface.
3. The resulting access/refresh token is stored as an opaque credential `grant`
   under the `llm-gemini` scope; the adapter refreshes it before expiry.
4. Each request resolves a fresh access token and streams from
   `https://generativelanguage.googleapis.com/v1beta/models/<model>:streamGenerateContent`.

## Configuration

The route is fixed (`gemini`). The settings section (`llm-gemini`) owns only the
provider request retry policy.

### OAuth client id

The default client id is the public Google client used by the Generative
Language API. Override it per deployment with:

```sh
GEMINI_OAUTH_CLIENT_ID=your-oauth-client-id
```

## Supported models

`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`,
and the `gemini-3.*` / `gemini-flash-latest` previews. Reasoning (thinking) is
enabled on capable models via a per-request effort (`off`/`low`/`medium`/`high`).

## Notes / limitations

- Image input is not yet forwarded to Gemini (text and tool calls are).
- The adapter is a sibling of `llm-pi-ai`; both mount from the base bundle.
