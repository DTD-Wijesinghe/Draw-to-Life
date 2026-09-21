# ✦ Draw-to-Life World

An interactive exhibition prototype that turns children's drawings (monsters, animals, cars, superheroes, etc.) into talking digital characters with unique personalities and stories.

---

## 🌟 Key Features

- **📷 Camera & File Scan**: Live camera capture or image/PDF upload.
- **👁️ Vision AI Identification**: Automatically analyzes the drawing using Google Gemini / OpenAI Vision to identify what was drawn.
- **✨ Character Creation**: Generates a dynamic character name, personality description, and greeting.
- **📖 Automatic Mini Story**: Generates a magical 2-sentence mini story starring the child's character.
- **🗣️ Multilingual Voice & Chat**: Speech output and speech recognition in English (`en-US`), Sinhala (`si-LK`), and Tamil (`ta-LK`).
- **⚡ Zero Third-Party Node Dependencies**: Built with native Node.js standard modules (`http`, `fs`, `path`, `crypto`, `fetch`).

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: Version 18.0 or newer.

### Running the App

```bash
npm start
```

Open `http://localhost:4173` in **Google Chrome** or **Microsoft Edge**.

> [!NOTE]
> If no API keys are provided in `.env`, the server automatically falls back to **Mock Mode** so the exhibition flow runs smoothly out-of-the-box.

---

## ⚙️ Environment Configuration

To enable real Vision & LLM AI generation, create a `.env` file in the root directory:

```env
# Google Gemini API Key (Recommended)
GEMINI_API_KEY=your_gemini_api_key_here

# OR OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here
```

---

## 🔌 API Endpoints

### `GET /api/health`
Checks server status and reports if AI mode is active (`"mode": "ai"` or `"mode": "mock"`).

### `POST /api/scan`
Analyzes a drawing and creates a character.
- **Body**: `{ "fileName": "drawing.png", "source": "camera" | "upload", "drawingDataUrl": "data:image/png;base64,..." }`
- **Response**: `{ "ok": true, "mode": "ai", "character": { "id": "...", "name": "...", "type": "...", "speech": "..." } }`

### `POST /api/story`
Generates a mini adventure story for the character.
- **Body**: `{ "character": { "name": "...", "type": "..." } }`
- **Response**: `{ "ok": true, "story": ["Paragraph 1", "Paragraph 2"] }`

### `POST /api/chat`
Handles conversational replies in character.
- **Body**: `{ "message": "Hello!", "language": "en-US", "character": { ... } }`
- **Response**: `{ "ok": true, "reply": "Hello friend!" }`

---

## 👥 Two-Member Build Division

| Role | Responsibilities | Key Files |
| :--- | :--- | :--- |
| **Member 1 (Frontend & Experience)** | Exhibition UI layout, wizard steps, character stage animations, speech controls, CSS glassmorphism | `dist/index.html`, `dist/styles.css` |
| **Member 2 (AI & Backend)** | Vision recognition prompts, LLM story/chat logic, API routes, environment setup | `server.js`, `dist/app.js` |
