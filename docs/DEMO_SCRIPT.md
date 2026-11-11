# Demo script — approximately 1 minute 50 seconds

Before recording, deploy with a valid Gemini key and test each prompt. Use a clean browser workspace. Keep the app open at a comfortable zoom and hide notifications. Do not show your API key or environment variable values.

| Time      | Show                                                                             | Suggested narration                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:12 | Overview                                                                         | “This is Clerk, a workspace agent for small everyday tasks. Instead of filling in several forms, I can ask for tasks, notes, file exports, or live weather in ordinary language.”    |
| 0:12–0:38 | Enter prompt 1; show execution results and the new records                       | “Gemini turns my request into a structured action plan. Clerk validates the commands, executes them, and saves the results. These are persistent records, not just a text response.” |
| 0:38–0:55 | Enter prompt 2; click Download; open the CSV                                     | “The agent can also perform file operations. It reads my current tasks and creates a real CSV download.”                                                                             |
| 0:55–1:15 | Enter prompt 3; show the resolved location and forecast                          | “This action calls an external weather API. The result contains live conditions and a five-day forecast, with the data source shown.”                                                |
| 1:15–1:35 | Enter prompt 4; show the confirmation; click Cancel                              | “Deleting information requires confirmation. I can inspect the exact change and cancel before anything is removed.”                                                                  |
| 1:35–1:50 | Open Activity; expand one entry; briefly show `server/prompt.js` if time permits | “Every request and action is logged. My prompt uses an explicit role, tool definitions, examples, and strict JSON output. The implementation uses React, Gemini, and Vercel.”        |

## Copy these prompts

**1. Create two different records**

> Add a high-priority task called Finish the agent project due tomorrow, and save a note titled Demo checklist containing: show a real action, export a file, check weather, and show a safety confirmation.

**2. Produce a file**

> Export my tasks as a CSV named project-tasks.

Click **Download** in the result card, then briefly open the file. If opening a spreadsheet takes too long, show the downloaded filename and move on.

**3. Call an external API**

> Check the current weather and five-day forecast for Los Angeles in Fahrenheit.

**4. Demonstrate safety**

> Delete the note titled Demo checklist.

Show the confirmation, then **Cancel**. The note should remain. The activity log should contain the cancelled action.

## Recording checklist

- Aim for 1–2 minutes; provider response times can vary. Rehearse first and cut idle waiting if needed.
- Show actual execution and outcomes clearly.
- Use your own explanation of the code. Practice the architecture paragraph in `PROJECT_NOTES.md`.
- Upload to YouTube or another video host with permissions your professor can access. An unlisted YouTube video usually works well.
- Test the deployed URL and video link from a private browser window.
- Submit the GitHub URL, deployed URL, and video URL through the assignment's Google Form.
