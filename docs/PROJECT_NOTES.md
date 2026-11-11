# Clerk — project explanation

## Problem

Small commitments are easy to scatter across notes, task lists, and files. Entering the same information in several interfaces creates friction. Clerk gives a student one place to ask for a task, capture an idea, find saved information, export it, or check the weather before planning the day.

## Solution

A user writes an ordinary request. Gemini converts it into a structured plan of allowed actions. Clerk validates the plan, executes each action, shows the result, and records the outcome. Deletions and note replacements require explicit confirmation.

This is an agent because the model's output causes concrete actions. A successful request changes persistent browser records, creates a downloadable file, or triggers a live external API call.

## Architecture

1. React collects the natural-language request and current workspace context.
2. `/api/agent` validates the incoming request with Zod.
3. `server/gemini.js` sends a system instruction, current request, context, and recent results to Gemini.
4. Gemini returns JSON constrained by the action-plan schema.
5. Both server and browser validate the plan. Unknown actions, unknown IDs, impossible dates, extra fields, and oversized inputs are rejected.
6. Clerk obtains confirmation for destructive changes, then runs actions sequentially.
7. The executor updates IndexedDB, generates a file, performs a search, or calls the weather endpoint.
8. Results and failures are displayed and recorded in the local activity log.

The project deliberately uses browser persistence so Vercel deployment requires only one Gemini key. It does not rely on writable serverless disks or an in-memory server database.

## Prompt engineering techniques

| Technique                            | Where it appears                                              | Purpose                                                             |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Role and task definition             | `server/prompt.js`                                            | Defines Clerk as a practical workspace operator                     |
| Explicit tool vocabulary             | System prompt and shared schemas                              | Restricts output to implemented action types and parameters         |
| Few-shot examples                    | Task creation, deletion, export, unsupported command examples | Demonstrates the expected mapping from language to action JSON      |
| Structured output                    | Gemini generation configuration and JSON Schema               | Makes commands machine-readable rather than parsing prose           |
| Context grounding                    | Current records, IDs, local date and timezone                 | Resolves references and relative deadlines using actual data        |
| Authorization and ambiguity rules    | System prompt                                                 | Asks for clarification instead of inventing IDs or extra actions    |
| Separation of data from instructions | JSON input envelope and prompt rules                          | Treats saved content/history as data; reduces prompt-injection risk |
| Execution feedback                   | Actual action results in recent conversation                  | Supports follow-up requests based on retrieved information          |

Prompt instructions reduce mistakes, but runtime schemas and confirmation checks enforce application boundaries. Clerk does not execute generated JavaScript, shell commands, or arbitrary URLs.

## Action inventory

| Action             | Domain         | Concrete effect                                                        |
| ------------------ | -------------- | ---------------------------------------------------------------------- |
| `create_task`      | Database       | Persists a new task                                                    |
| `update_task`      | Database       | Changes title, description, priority, deadline, or completion          |
| `delete_task`      | Database       | Removes a task after confirmation                                      |
| `create_note`      | Database       | Persists a new note                                                    |
| `update_note`      | Database       | Replaces specified note fields after confirmation                      |
| `delete_note`      | Database       | Removes a note after confirmation                                      |
| `search_workspace` | Database query | Finds matching saved tasks and notes                                   |
| `export_file`      | Files          | Builds a real Markdown, CSV, or JSON file with a download control      |
| `get_weather`      | External API   | Retrieves resolved location, current conditions, and five-day forecast |

## Error handling and safety

- A missing server key produces setup instructions, while manual workspace features remain usable.
- Network errors and transient provider responses receive one bounded retry with backoff.
- Rate-limit errors show a wait period. Long `Retry-After` delays are returned to the interface rather than ignored.
- Invalid or unfinished model output is rejected before execution.
- The executor rejects unconfirmed destructive actions, even if called separately from the interface.
- The full pending plan is visible before confirmation; replacement note content can be reviewed.
- A workspace revision detects changes made while a plan was waiting.
- A failure stops the remaining actions. Completed changes remain saved and later actions are recorded as skipped.
- Text renders as text through React, rather than untrusted HTML.
- CSV cells are escaped and spreadsheet formula prefixes neutralized.
- API secrets stay on the server; browser fetches use same-origin endpoints.

## Assignment coverage

| Professor's criterion                       | Evidence to show                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Problem identification and relevance — 10%  | Explain the everyday friction of scattered tasks, notes, and small errands                          |
| Application design and implementation — 30% | Show the validated plan, task/note persistence, file export, and real weather lookup                |
| Prompt engineering — 20%                    | Open `server/prompt.js`; explain role, constraints, examples, structured JSON, and grounded context |
| UI/UX — 10%                                 | Show the overview, mobile layout, clear action statuses, helpful errors, and confirmation dialog    |
| Presentation and live demo — 30%            | Use `DEMO_SCRIPT.md` to show request → real action → result → safety/logging                        |

## Scope and honest limitations

- Workspace persistence is per browser and does not sync across devices.
- The activity log keeps 500 entries and can be edited by the browser owner; it is not a tamper-proof audit service.
- A plan has at most 12 actions and cannot reference newly returned tool output inside the same request. Retrieve live information first, then use it in a follow-up request.
- Actions are sequential and not a transaction across tools; earlier successful changes are kept if a later action fails.
- Confirmation and allowlists limit available operations, but the model can still misunderstand a request. Users should inspect results and confirmation details.
- Automated provider tests use controlled responses. Live key/model access and a final visual pass on Vercel must be verified before recording.

## A short explanation to practice

“Gemini is the planner, and my application is the executor. I send the request together with the workspace context and ask for a constrained JSON plan. I validate that plan against the same action schema on both sides. Then I execute only the allowed operations, save the outcomes, and stop for confirmation when a change is destructive.”
