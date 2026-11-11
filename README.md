# Clerk

Clerk is a simple AI assistant made for the CS4680 AI Agent Project. You can type a request in plain English to manage tasks and notes, export files, or check the weather.

It uses React, JavaScript, Gemini, and Vercel Functions.

## What it can do

- Add, edit, search, and delete tasks and notes
- Mark tasks as done
- Export saved tasks and notes as CSV, Markdown, or JSON
- Get the current weather and a five-day forecast
- Show what the agent did in the Activity tab

The app asks for confirmation before deleting items or replacing a note.

## Run it locally

You'll need Node.js 22.22.2 or newer within version 22, and a [Gemini API key](https://aistudio.google.com/apikey).

1. Run `npm install` in the project folder.
2. Copy `.env.example` to `.env`.
3. Open `.env` and replace `your_gemini_api_key_here` with your key.
4. Start the app:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000) in your browser. This command starts both the frontend and the API.

Keep your API key in `.env` and don't upload that file to GitHub. Without a key, you can still manage tasks and notes manually, but AI requests won't work.

## Example requests

- "Add a high-priority task to finish my project tomorrow."
- "Save a note titled Demo checklist with three steps for my presentation."
- "Mark the task about finishing my project as done."
- "Export my tasks as CSV."
- "Check the weather in Los Angeles in Fahrenheit."

For exports, click **Download** when the file is ready.

## Deploy on Vercel

1. Push the project to GitHub. Keep `package.json` at the root of the repository, and leave out `node_modules`, `dist`, and `.env`.
2. Import the repository into [Vercel](https://vercel.com/new).
3. Use the Vite preset, `npm run build` as the build command, and `dist` as the output folder.
4. Add `GEMINI_API_KEY` in the project's environment variables, then deploy.

If you change the key later, redeploy the app. Don't put the key in the frontend or name it with a `VITE_` prefix.

## A few things to know

Tasks and notes are saved in your browser using IndexedDB. They stay after a refresh, but won't appear on another browser or device. Clearing the site's data removes them, so export anything you want to keep. There isn't an import feature yet.

AI requests send your current tasks, notes, and recent conversation to Gemini. The API key stays on the server. The deployed app uses your Gemini quota and doesn't have a login system.

Weather data comes from [Open-Meteo](https://open-meteo.com/).

## Check the project

```bash
npm test
npm run build
```

The automated tests use mocked Gemini responses. To check the real connection, run the app with your key and try one of the example requests.

## More details

- [Project notes](docs/PROJECT_NOTES.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Deployment and submission checklist](docs/DEPLOY_AND_SUBMIT.md)
