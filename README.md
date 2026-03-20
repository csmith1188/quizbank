# QuizBank

## Brief User Guide

### For teachers

- Log in with your Formbar account, then open `My Courses`.
- Create a course with `New Course`, then expand its accordion card.
- From the course card, build content in this order:
  - `Tasks` (learning targets and task descriptions)
  - `Units` (group tasks and vocabulary)
  - `Vocabulary` (terms/definitions)
  - `Questions` (generate or manually curate)
  - `Quizzes` (assemble question sets for assignment)
- Use `Import from Excel/CSV` if you want to bulk-load course content.
- In the question generator, review generated questions before saving:
  - mark usable questions as `good`
  - mark weak questions as `bad` with a reason (used for better future generation)
- Use `Classes` to assign courses/quizzes to students and monitor mastery progress.

### For students

- Open `Classes`, then choose your class and assigned course.
- On mastery pages, use:
  - **Progress Test** for targeted mastery updates
  - **Overall Knowledge Test** for broad mixed review across course tasks
- Review results and use AI coach links when available for study guidance.

### Helpful tips

- Copy buttons copy full API URLs (not just IDs), useful for quick testing/integration.
- Questions marked `bad` are excluded from quizzes/tests/API retrieval.
- In most flows, mastery improves from correct task-linked answers over recent attempts.

## Brief API User Guide

- API base path is `/api` (for example: `http://localhost:3000/api`).
- Public course data:
  - `GET /api/course` (list public courses)
  - `GET /api/course/:id` (course metadata)
- Question retrieval/generation from a course:
  - `GET /api/course/:id?pick=10` (random, max 25)
  - `GET /api/course/:id?pick=10&student=123` (mastery-weighted)
  - `GET /api/course/:id?generate=10&task=5&context=...` (generated only, not saved; max 10)
- Access to private course API data requires either:
  - owner session, or
  - `?api_key=...` / `Authorization: Bearer ...`
- Rate limits:
  - all `/api/*`: 120 requests / 60s
  - generation: 12 requests / 60s

## Brief Setup Guide (Technical Users)

1. **Install dependencies**
   - `npm install`
2. **Configure environment**
   - Create/update `.env` with at least:
     - `PORT=3000`
     - `SESSION_SECRET=...`
     - `AUTH_URL=...`
     - `THIS_URL=http://localhost:3000` (base URL, no `/login` suffix needed)
     - `API_KEY=...`
     - `DATABASE_FILE=./db/app.db`
     - `OPENAI_API_KEY=...` (required for question generation)
3. **Initialize/migrate database**
   - `npm run init-db`
   - `npm run migrate`
4. **Run the app**
   - `npm start`
5. **Open in browser**
   - `http://localhost:3000`

