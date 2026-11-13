# Recitation Tracker — HTML, CSS, JavaScript starter

## Run it
1. Extract the ZIP file.
2. Open `index.html` in a modern browser (Chrome or Edge recommended).
3. The app starts with a 15-learner class list (Grade 11 – Class List) plus 35 sample learners and four sample groups.
4. Use the left navigation to test Dashboard, Classes, Attendance, Recitation, Groups, Students, Reports, and Settings.

## Included
- Responsive teacher dashboard for laptop and mobile
- Class/section management
- Spreadsheet-style monthly attendance grid (learners as rows, school days as columns; P / A / L / E marks, no-class days, monthly totals, CSV export and printing)
- "Magic Wheel" random picker for recitation (animated name wheel with optional fairness weighting and skip-already-recited)
- Live recitation timer and rubric inputs
- Correct / Partial / Incorrect scoring
- Group points
- Student list, search, and editing
- CSV exports that open in Excel
- Printable individual student report
- JSON backup and restore
- Browser-local persistence using `localStorage`

## Important limitations
This is a front-end prototype, not a production school information system.
- Data is saved only in the current browser on the current device.
- It does not yet synchronize mobile and web devices.
- It does not yet use Supabase authentication, PostgreSQL, or Row Level Security.
- `localStorage` is suitable for a small prototype; use IndexedDB (for example, Dexie.js) for a larger offline-first release.
- CSV exports open in Excel, but they are not a formatted official DepEd grading sheet.
- Use fictional learner data while testing. Before deployment, add authentication, access controls, backups, privacy safeguards, and school approval.

## Suggested next development stage
Migrate local storage to IndexedDB, then implement a sync queue and Supabase backend. Keep local saves immediate and synchronize in the background when connectivity returns.

## Random Group Generator

Open **Group Generator** from the sidebar. Group by size (3–6), by number of groups, or as random partners; pick a team-name theme; reveal members one by one; save groupings (the generator then avoids repeating teammates); export to Excel (.xlsx) or PDF. The module lives in `generator.js`.
