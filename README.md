# Draw-to-Life World

An exhibition prototype where a child's drawing becomes an animated character with a voice and a tiny story.

## Run the demo

Requirements: Node.js 18 or newer.

```bash
npm start
```

Open the URL printed by the server in Chrome or Edge. The project runs in mock mode without API keys and demonstrates the complete loop: live camera capture or image/PDF upload, character creation, story generation, speech output, and child conversation.

The character stage preserves the child's original image and applies a living reaction layer: arrival motion, breathing, glow, shadow, movement while speaking, and voice bubbles. The voice panel supports English (`en-US`), Sinhala (`si-LK`), and Tamil (`ta-LK`) when the browser has a matching speech voice installed, plus warm, bright, and deep voice styles.

The exhibition flow is now step-based: welcome prompt → camera or image/PDF choice → automatic understanding sequence → creation success screen → text/voice conversation → end and reset for the next child.

Camera mode needs HTTPS or `localhost` permission. PDF mode accepts the file and shows it as a scan-ready document; the production vision service should rasterize the first page before recognition.

The backend is in `server.js`. The frontend is in `dist/`. API keys should never be placed in browser code.

Available endpoints:

- `GET /api/health` — check the service.
- `POST /api/scan` — turns a drawing filename into character data in mock mode.
- `POST /api/story` — generates a character story.
- `POST /api/chat` — generates a character reply.

## Two-member build split

### Member 1 — Experience & Frontend

- Own the interface in `dist/index.html` and `dist/styles.css`.
- Own the scan/upload flow, exhibition layout, responsive behavior, animation, and accessibility.
- Replace the local sample avatar with a transparent generated character asset when the AI pipeline is ready.
- Suggested branch: `member-1-experience`

### Member 2 — AI & Interaction Layer

- Own the interaction logic in `dist/app.js` and the service layer in `server.js`.
- Connect drawing recognition / image segmentation, character naming, text-to-speech, speech-to-text, and story generation.
- Keep the UI contract stable: update `current` with `name`, `type`, `speech`, and `story`.
- Suggested branch: `member-2-ai-services`

## GitHub workflow

```bash
git init
git add .
git commit -m "Build Draw-to-Life World exhibition prototype"
git branch -M main
git remote add origin https://github.com/<YOUR-ACCOUNT>/<YOUR-REPO>.git
git push -u origin main
```

Each member should branch from `main`, push their branch, and open a pull request. Merge Member 1's visual contract first, then Member 2 can wire services against the stable DOM and `current` object.

## Next integration seam

The demo intentionally uses mock endpoints so it works without credentials. Replace the mock implementations in `server.js` with the chosen vision, language, speech-to-text, and text-to-speech providers. Keep the endpoint response shape stable so Member 1 does not need to change the UI. For a real avatar, return a transparent character asset or animation state alongside the character JSON.
