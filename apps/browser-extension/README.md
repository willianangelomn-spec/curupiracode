# CurupiraCode extension for Chrome and Edge

English | [中文](README.zh.md)

Manifest V3 extension with persistent side-panel chat, reviewed browser automation, restricted form answering, and portable form macros. It reuses the model configured in the local CurupiraCode and contains no API key.

## Development installation

1. Run `pnpm --filter @deepseek-ai/dsh-browser-extension build` from the repository root.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable developer mode and choose **Load unpacked**.
4. Select `apps/browser-extension/dist`.
5. Start CurupiraCode with `pnpm curupiracode web` and open the printed `?token=` address once in the same browser, so it is signed in.
6. Click the extension icon, open **Conexão local**, and check the address (default `http://127.0.0.1:3080`).
7. Click **Parear**. A tab opens the CurupiraCode pairing page; click **Aprovar e gerar código** and copy the code it shows.
8. Paste the code into **Código de pareamento** and click **Salvar**. The indicator turns green.

The manifest `key` fixes the id `ndfighammhdpfaejmadojjaaelmpadek`, and the Web bundle's [extension bridge](../../packages/host/extension-bridge/README.md) admits exactly that origin; `pnpm --filter @deepseek-ai/dsh-browser-extension verify` checks both. The panel sends the pairing code as a bearer token to the bridge's fixed endpoints, which drive only the tool-free `browser` and `browser-chat` presets. Approving again replaces the code, and **Revogar** on the pairing page stops it immediately; the panel then asks for a new pairing. Local macro recording and replay need no pairing.

## Security flow

The **Conversation** tab keeps one CurupiraCode session and restores its history when the panel reopens. **Include current page** captures the title, URL, selection, and visible text only when the user sends a message. The tool-free `browser-chat` preset treats captured content as untrusted data. **New conversation** starts another session without deleting earlier CurupiraCode history.

In **Automation**, the user explicitly selects **Read page** or **Plan with Curupira**. The extension captures bounded visible text and at most 250 controls without current field values. The tool-free `browser` preset produces a locally validated preview. Only **Execute approved actions** changes the page; submission, purchase, payment, publication, and deletion need an extra confirmation. Passwords, authentication codes, payment cards, uploads, and browser-internal pages stay blocked.

**Answer form** accepts user-provided facts and criteria, then asks Curupira to map questions, required fields, descriptions, and options into proposed answers with confidence. Every answer is editable and individually selectable; low-confidence answers start disabled. This mode accepts only `fill`, `select`, and `check`, so model output cannot click or submit the form. Final submission remains manual.

**Copy macro** records how the user fills `input`, `textarea`, `select`, checkbox, and radio controls, plus intermediate **Next**, **Continue**, and **Advance** buttons. Semantic fingerprints use field type, name, label, question context, and accessibility attributes instead of coordinates or executable selectors. Recording spans authorized frames and same-site pages, merges repeated changes, and removes every transition from the last page so replay stops before final submission. Sensitive and upload fields never enter a macro.

Macros stay in `chrome.storage.local` and can be deleted or exported as JSON for another installation. Exported files contain entered values and must be treated as personal data. Import validates version, limits, action types, and a single HTTP origin before replay.

## Model Experience

### Browser planning

#### What the model sees

The selected model receives a bounded page or eligible-form snapshot as explicitly untrusted text. It receives no browser execution tool; it only returns one JSON plan that the extension validates and previews.

#### Token effect

Captured visible text and control metadata add input tokens. Macro recording and replay are deterministic local operations and use no model tokens.

#### KV Cache effect

Each fresh page snapshot can change the request after the stable restricted preset. Conversation without page context can retain a more stable prefix.

## Known Limitations and Deferred Work

- Automation handles one captured page at a time; navigation requires a new capture and plan.
- Supported planned actions are `click`, `fill`, `select`, `check`, and `scroll`; form mode narrows this to `fill`, `select`, and `check`.
- Firefox requires a separate `sidebar_action` manifest and remains future work.
- Replies arrive after the turn ends: the panel polls the bridge about once a second and gives up after three minutes.
- The pairing code stays in `chrome.storage.local` until the user clears it or the server revokes it; anyone with access to the browser profile can read it.
