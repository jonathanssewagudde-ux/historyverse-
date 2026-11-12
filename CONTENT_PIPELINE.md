# Content pipeline

> **Status:** steps 1–2 (research and the grounded article draft) and the job infrastructure are implemented (Milestone 8). Steps 3–11 follow in Milestones 9–12. See ROADMAP.md for how each rule below is enforced.

## Generate History Project

An administrator enters a topic (for example _"The Complete History of the Buganda Kingdom"_). A `ContentProject` is created, and each step below is an independent, persisted `ProductionJob`. Each job can be retried, cancelled and inspected, and survives page reloads.

| #   | Step                     | Output                                                                                                                         | Approval checkpoint                 |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | Research                 | Source set, periods, people, events, dates, **conflicting accounts**                                                           | ✔ review the source set             |
| 2   | Article draft            | Structured, cited, editable draft                                                                                              | ✔ Research Review                   |
| 3   | Archival media discovery | Candidates with licence and attribution metadata                                                                               | ✔ select and verify licences        |
| 4   | Reconstruction prompts   | Evidence-based prompts. Images only with a configured provider and an approved budget                                          | ✔ approve the cost estimate         |
| 5   | Documentary script       | Hook → background → origins → developments → figures → turning points → consequences → significance → conclusion               | ✔ editor approval                   |
| 6   | Scene plan               | Per scene: narration, visual description, assets, duration, references, status                                                 |                                     |
| 7   | Narration                | Per-scene audio (local or paid TTS, or an uploaded recording)                                                                  | ✔ approve the cost estimate if paid |
| 8   | Video render             | Remotion + FFmpeg MP4 (16:9 and/or 9:16), with captions and music                                                              |                                     |
| 9   | YouTube assets           | Title, description, chapters, tags, SRT subtitles, thumbnail, source and licence manifest                                      |                                     |
| 10  | Review                   | Article plus documentary preview                                                                                               | ✔ **explicit approval**             |
| 11  | Publication              | Article published. Video uploaded **private**, then scheduled or published, and the verified video ID is linked to the article | ✔ **explicit approval**             |

## Rules

- AI output is a **draft**. It is never treated as fact-checked because a model produced it.
- No quotation, event or reference is generated without a retrievable source. Unsupported claims are flagged and never silently kept.
- Every documentary ships with a **source and licensing manifest**.
- AI reconstructions are labelled on screen ("AI-Generated Historical Reconstruction — Not an Authentic Photograph"), in thumbnails, and in the YouTube altered/synthetic content disclosure.
- Paid operations show a cost estimate and stop at the budget ceiling.

## Job states

`queued → running → succeeded | failed | cancelled`, with `attempts`, `error`, `progress`, `costEstimate` and `actualCost` recorded on each job.
