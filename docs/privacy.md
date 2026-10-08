# Privacy & Security Model — Resume Studio

Resume Studio is built on a **local-first, privacy-by-design** architecture. Your personal resume data belongs entirely to you and never touches remote servers.

---

## 1. Zero Network Transmission

1. **Hosted Mode (Cloudflare Pages):**
   - When using the public static website, the application executes **100% inside your browser**.
   - All schema validation, form editing, and A4 pagination happen locally in JavaScript.
   - **Zero network requests** are sent with your resume content. No APIs, no telemetry, no analytics, no third-party CDNs.
   - Fonts and styling use native system font stacks (`-apple-system`, `system-ui`, `Segoe UI`, `Georgia`, etc.) to eliminate tracking requests to external font services.

2. **Offline Capable:**
   - Once static assets (`index.html`, bundle JS, CSS) are downloaded, the application works completely offline.

---

## 2. In-Memory Drafts & Opt-in Device Autosave

1. **In-Memory by Default:**
   - By default, your resume draft exists solely in active browser RAM.
   - Closing the browser tab clears the in-memory draft (the browser prompts with an unsaved changes warning if dirty).
2. **Explicit Import and Export:**
   - Use **Open JSON** to load a local file into memory.
   - Use **Export JSON** to download a clean, validated JSON document to your device's filesystem.
3. **Opt-in Device Autosave:**
   - Device autosave is strictly **disabled by default**.
   - If enabled via the checkbox in the editor, candidate drafts are saved to browser `localStorage` under `resume-studio:v1:draft`.
   - **Unencrypted Storage Warning:** Browser `localStorage` is unencrypted on your local disk. Do not enable autosave on shared, public, or untrusted machines.
   - The stored draft can be permanently erased at any time using the **Clear Stored** button.

---

## 3. Local Loopback Bridge Security

When launching preview via `node dist/cli/main.js preview --file resumes/my-resume.json`:

1. **IPv4 Loopback Binding Only:**
   - The preview server binds strictly to `127.0.0.1` on an ephemeral port. It will never bind to `0.0.0.0` or any public/LAN network interface.
2. **256-Bit Ephemeral Capability:**
   - Every preview session generates a cryptographically secure 256-bit random capability.
   - The URL opened by `--open` includes `#local=<capability>`.
   - The browser immediately extracts the capability into a JavaScript memory variable and removes the fragment from the URL and browser history via `history.replaceState` before any network call.
   - The capability is never written to `localStorage`, `sessionStorage`, cookies, or terminal logs.
3. **Origin & DNS-Rebinding Protection:**
   - The server verifies the `Host` header on all requests, rejecting DNS-rebinding attacks.
   - The `POST /local/save` endpoint strictly enforces an exact matching `Origin` header (`http://127.0.0.1:<port>`).
4. **Single-File Scope:**
   - The bridge is bound to the single selected resume file specified at startup. It does not accept path parameters over HTTP and cannot access other files on your system.
5. **Strict Request Bounds:**
   - Save requests enforce a strict 160 KiB payload limit. Requests exceeding this limit are terminated immediately (HTTP 413).

---

## 4. Transaction Backups & PII Retention

When modifying files via CLI `apply` or the local save bridge:

1. **Cooperative Lock & Backups:**
   - A `.lock` directory lock serializes writes.
   - Before atomically updating the file, the previous version is backed up.
   - Backups rotate up to 10 versions (`<filename>.bak.1` through `<filename>.bak.10`). Older tool backups are pruned automatically.
2. **File Permissions:**
   - Temporary write files are created with restricted `0o600` permissions on POSIX systems (accessible only to the owner).
3. **Sensitive Data Caution:**
   - Backup files contain your resume PII.
   - The root `.gitignore` file excludes `*.bak*`, `resumes/`, and temporary files to prevent accidental commits to public repositories.
   - Keep your working resume files in the ignored `resumes/` folder or outside repository checkouts.
