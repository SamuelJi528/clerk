# Deploy and submit

## 1. Extract the project

Unzip the package. Open the `clerk` folder. This is the project root: it contains `package.json`, `vercel.json`, `README.md`, and the source folders.

## 2. Put the project on GitHub

Create a new GitHub repository and upload the contents of `clerk` into its root. Make sure the `api`, `server`, `shared`, `src`, `tests`, and `docs` folders are included.

Include `package-lock.json`, `.gitignore`, and `.env.example`. Do not upload a real `.env` file, `node_modules`, or `dist`.

If you prefer the terminal, run these commands **inside the extracted `clerk` folder**:

```bash
git init
git add .
git commit -m "Build Clerk workspace agent"
git branch -M main
```

Then follow GitHub's “push an existing repository” instructions using the exact repository URL GitHub gives you. Do not paste your Gemini key into a Git command.

## 3. Connect Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import your GitHub repository.
3. Keep the root directory at the repository root if `package.json` is there. Otherwise select the folder that contains it.
4. Framework: **Vite**.
5. Build command: **`npm run build`**.
6. Output directory: **`dist`**.
7. Node version: **22.x** (also declared in `package.json`).
8. Add **`GEMINI_API_KEY`** as an environment variable with your real key.
9. Leave `GEMINI_MODEL` unset unless you need a different available model. The app defaults to `gemini-3.5-flash-lite`.
10. Deploy.

Vercel deploys `api/*.js` as server functions alongside the built frontend. You do not need to create a separate backend service or database.

## 4. Verify the live app

Submit: “Add a high-priority task to finish my project tomorrow.” See a successful action and a new task. Refresh and verify the task remains.

Then test a note, a CSV export/download, a weather lookup, and a cancelled deletion. Open Activity and check that actions were logged.

Try it on your phone. Final visual verification on the deployed site is necessary because the project preparation environment could not run a full browser preview.

## 5. If something fails

| Symptom                                   | What to do                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| “Gemini setup needed”                     | Add `GEMINI_API_KEY` in the correct Vercel environment, then redeploy                                   |
| Model unavailable / 404                   | Set `GEMINI_MODEL` to an exact model ID enabled for your Google AI Studio account, then redeploy        |
| Gemini rejected request                   | Check key validity, Gemini API access/restrictions, model access, and billing/quota in Google AI Studio |
| Rate-limit message                        | Wait for the timer; inspect your Google AI Studio quota if it keeps happening                           |
| Local page opens but API is unreachable   | Use `npm run dev`, then open port 3000; `npm run preview` only serves the frontend                      |
| Vercel API returns 404                    | Check that `api/` is inside the selected project root, next to `package.json`                           |
| Page is unavailable to professor          | Check Vercel deployment protection and make the production site accessible to your intended reviewer    |
| Records differ on another device          | Expected: each browser has its own IndexedDB workspace                                                  |
| Cannot save / browser storage unavailable | Allow site storage, check private browsing restrictions, and export a backup when possible              |

The configuration indicator reports whether a key is present. Only a successful agent request verifies that the key/model/quota work together.

## 6. Finish the required submission

Use `DEMO_SCRIPT.md` to record and upload a 1–2 minute demonstration. Fill out [the assignment Google Form](https://forms.gle/nMHp5owwYidszwt58) with:

- GitHub repository URL.
- Live Vercel application URL.
- Demo video URL.

Check Canvas for the due date. Test all three links as the professor would see them.
