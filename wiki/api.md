## QuizBank Public API

All endpoints below are mounted under the `/api` prefix, as configured in `app.js`:

- Base URL: `/api`
- Responses are JSON.
- Errors use HTTP status codes with a body of the form `{ "error": "message" }`.
- Any resource with a `sort_order` column in the database exposes it in the API payload.
- Questions marked bad are excluded from read/query endpoints (`COALESCE(quality, '') != 'bad'`).

Authentication / access:

- Many read-only endpoints are available for **public courses** (`is_public = 1`).
- Private courses can be accessed by their owner via session, or by providing a valid API key via:
  - Query: `?api_key=YOUR_KEY`
  - Header: `Authorization: Bearer YOUR_KEY`

Rate limits:

- Global API limiter on all `/api/*`: **120 requests / 60 seconds** per key (session user, API key, or IP fallback).
- Question generation limiter: **12 requests / 60 seconds** per key.
- On limit hit, API returns `429` with `Retry-After` plus `X-RateLimit-*` headers.

---

## Resources

### Course

#### List courses

- **GET** `/api/course`

Returns all public courses.

Response:

```json
[
  {
    "id": 1,
    "name": "Programming",
    "sort_order": 0,
    "is_public": true
  }
]
```

#### Course details, question picking, or question generation

- **GET** `/api/course/:id`
- `:id` is a single course id (e.g. `1`).

If neither `pick` nor `generate` is present, you get course metadata:

```json
{
  "id": 1,
  "name": "Programming",
  "sort_order": 0,
  "is_public": true,
  "units": [
    { "id": 1, "name": "Flowcharts & Algorithms", "sort_order": 0 }
  ],
  "tasks": [
    {
      "id": 3,
      "name": "Building Linear Flowcharts",
      "target": "Students can build a linear flowchart.",
      "sort_order": 2
    }
  ],
  "quizzes": [
    { "id": 5, "name": "Intro Quiz", "sort_order": 0 }
  ]
}
```

If a **`pick` query param is present**, the same endpoint returns **questions instead of course metadata**:

- `GET /api/course/1?pick=10`
- `GET /api/course/1?pick=10&student=123`

Parameters:

- `pick` (required for picking): integer, number of questions requested (capped by `MAX_PICK`, currently **25**).
- `student` (optional): integer student id. When present, question selection uses the same **mastery-weighted algorithm** as the Progress Test (`lib/progress-quiz.js`).
- `class` (optional): integer class id. Currently **not supported** on this endpoint and will return `400`.

Example response (single question):

```json
[
  {
    "id": 67,
    "ai": true,
    "prompt": "Which example best shows a <div> used as a layout container for a page section?",
    "correctAnswer": "<div class=\"sidebar\"> ... </div>",
    "correctIndex": 0,
    "answers": [
      "<div class=\"sidebar\"> ... </div>",
      "<div href=\"sidebar.html\">Sidebar</div>",
      "<div alt=\"sidebar\">Sidebar</div>",
      "<div src=\"sidebar.png\"></div>"
    ],
    "hierarchy": {
      "course": { "id": 1, "name": "Programming" },
      "task": { "id": 3, "name": "Building Linear Flowcharts" }
    }
  }
]
```

The question shape is:

```json
{
  "id": 0,
  "ai": false,
  "prompt": "",
  "correctAnswer": "",
  "correctIndex": 0,
  "answers": [],
  "hierarchy": {
    "course": { "id": 0, "name": "" },
    "unit": { "id": 0, "name": "" },
    "task": { "id": 0, "name": "" }
  }
}
```

Notes:

- The `hierarchy` object may omit `unit` when the question cannot be associated with a specific unit; `course` and `task` are always present for questions tied to tasks.
- `ai` is `true` for AI-generated questions (based on the `questions.ai` column) and `false` otherwise.

If `pick` is absent and **`generate` query param is present**, this endpoint returns generated questions (not saved to DB):

- `GET /api/course/1?generate=10`
- `GET /api/course/1?generate=10&task=3`
- `GET /api/course/1?generate=10&task=3&context=Focus%20on%20scenario-based%20questions`

Generation parameters:

- `generate` (optional value): requested question count, capped at **10**.
- `task` or `taskId` (optional): task context source. If omitted, first task in course by `sort_order, id` is used.
- `context` (optional): extra prompt instructions passed as additional context.

Generation notes:

- Runs only when `pick` is **not** present.
- Uses the same generation logic as the teacher question generator.
- Returns generated questions only; does not insert/update DB records.

#### Course vocab

- **GET** `/api/course/:id/vocab`

Returns all vocab terms for the given course.
Supports optional random picking with `?pick=N` (capped by `MAX_PICK`).

Response:

```json
[
  {
    "id": 10,
    "term": "Algorithm",
    "definition": "A step-by-step set of instructions.",
    "sort_order": 0
  }
]
```

#### Course units

- **GET** `/api/course/:id/unit`

Returns all units for the given course with ids, names, and sort orders.

Response:

```json
[
  { "id": 1, "name": "Flowcharts & Algorithms", "sort_order": 0 }
]
```

#### Course quizzes

- **GET** `/api/course/:id/quiz`

Returns all quizzes for the given course.

Response:

```json
[
  { "id": 5, "name": "Intro Quiz", "sort_order": 0 }
]
```

### Unit

#### Unit details

- **GET** `/api/unit/:unitId`

Returns tasks and vocab for a specific unit within a course.

`:unitId` may be a single id or several ids joined with `+`. With multiple ids and **no** `pick` query, the response is a **JSON array** of unit detail objects (same shape as below).

Optional query: **`?pick=N`** — returns **N** random questions (capped by `MAX_PICK`) from the union of non-`bad` questions for all tasks linked to the listed units (via `unit_tasks`). Response is a **JSON array** of questions with `hierarchy.course`, `hierarchy.unit`, and `hierarchy.task`. If the pool is empty, `[]`. If the same question would appear twice (e.g. shared task across units), it is included once.

Response (single unit):

```json
{
  "id": 1,
  "name": "Flowcharts & Algorithms",
  "sort_order": 0,
  "tasks": [
    {
      "id": 3,
      "name": "Building Linear Flowcharts",
      "target": "Students can build a linear flowchart."
    }
  ],
  "vocab": [
    {
      "id": 10,
      "term": "Algorithm",
      "definition": "A step-by-step set of instructions."
    }
  ]
}
```

#### Unit questions

- **GET** `/api/unit/:unitId/questions`

Returns all questions for the tasks in one unit, or the combined set when `:unitId` lists multiple ids joined with `+` (duplicates removed).

Each question is in the standard shape documented above; `hierarchy.course`, `hierarchy.unit`, and `hierarchy.task` are all populated.

#### Unit vocab

- **GET** `/api/unit/:unitId/vocab`

Returns vocab terms associated to the unit (`unit_vocab`). With multiple unit ids joined with `+`, terms are merged and duplicate vocab ids appear once.
Supports optional random picking with `?pick=N` (capped by `MAX_PICK`).

### Task

#### Task details

- **GET** `/api/task/:taskId`

Returns basic metadata for a single task and its containing course.

`:taskId` may be a single id or several ids joined with `+` (e.g. `117+118+119+121`). With multiple ids and **no** `pick` query, the response is a **JSON array** of task metadata objects (same shape as below, plus optional `description`).

Optional query: **`?pick=N`** — returns **N** random questions (capped by `MAX_PICK`, same as course picking) drawn from the union of non-`bad` questions for all listed tasks. Response is a **JSON array** of questions in the standard shape (with `hierarchy.course` and `hierarchy.task`). If there are no eligible questions, the response is `[]`.

Single-task response:

```json
{
  "id": 3,
  "name": "Building Linear Flowcharts",
  "target": "Students can build a linear flowchart.",
  "hierarchy": {
    "course": { "id": 1, "name": "Programming" }
  }
}
```

#### Task questions

- **GET** `/api/task/:taskId/questions`

Returns all questions for one task, or for every task when `:taskId` lists multiple ids joined with `+`.

Questions use the standard question shape; `hierarchy.course` and `hierarchy.task` are populated.

### Quiz

#### Course quizzes

- See **Course quizzes** above: `GET /api/course/:id/quiz`.

#### Quiz questions

The core data model already links quizzes to specific questions via `quiz_questions`, and there is a teacher API for managing quiz items:

- `GET /api/courses/:courseId/quizzes/:quizId/items`

For public consumption, you will typically:

1. Get quizzes for a course: `GET /api/course/:courseId/quiz`.
2. For a selected quiz `quizId`, use the teacher items endpoint (requires appropriate auth) to fetch question ids and prompts.

At present there is **no unauthenticated public shortcut** like `/api/quiz/:id` that returns all question details for a quiz; this can be added later using the same `rowToQuestion` shape described above.

---

### Question

#### Single question by id

- **GET** `/api/question/:questionId`

Returns a single question, including hierarchy.

Response:

```json
{
  "id": 67,
  "ai": true,
  "prompt": "Which example best shows a <div> used as a layout container for a page section?",
  "correctAnswer": "<div class=\"sidebar\"> ... </div>",
  "correctIndex": 0,
  "answers": [
    "<div class=\"sidebar\"> ... </div>",
    "<div href=\"sidebar.html\">Sidebar</div>",
    "<div alt=\"sidebar\">Sidebar</div>",
    "<div src=\"sidebar.png\"></div>"
  ],
  "hierarchy": {
    "course": { "id": 1, "name": "Programming" },
    "task": { "id": 3, "name": "Building Linear Flowcharts" }
  }
}
```

---

## Combining IDs

The long-term design for this API allows combining multiple ids in a single `:id` segment, separated by `+`, for example:

- `/api/course/1/task/1+3+5`
- `/api/unit/1+3+5?pick=3`

The current implementation focuses on **single-id** paths for stability. Where `+`-combined ids are not yet implemented, you should instead perform multiple separate calls and combine results client-side.

If you add multi-id support in the future, follow this pattern:

- Parse ids with: `String(param).split('+').map(Number).filter(Boolean)`.
- Use `WHERE id IN (?, ?, ?)` queries with the appropriate number of placeholders.
- When a single id is passed, return a single object; when multiple ids are passed, return arrays of objects or merged question pools as appropriate.

---

## Question Selection and Mastery Weighting

### `pick=X` query param

For endpoints that support question picking, the `pick` param controls how many questions are returned:

- `/api/course/1?pick=10`
- `/api/course/1?pick=10&student=123`

Rules:

- `pick` is capped by `MAX_PICK` (**25**).
- If **no `student` or `class`** is provided, questions are selected using uniform random sampling without replacement.
- If `student` is provided at the **course** level, selection is **mastery-weighted** using the same algorithm as the Progress Test:
  - Logic lives in `lib/progress-quiz.js` (`pickProgressQuestions`).
  - Tasks are weighted by `(1 - mastery)`, with gating and unit/frontier rules as in the Progress Test.
  - Resulting question ids are then expanded into full question objects using the standard question shape.
- If `class` is provided on the course-level picking endpoints, the current implementation returns `400` (not yet implemented).

### Where weighting is implemented

- **Implemented**:
  - `/api/course/:id?pick=X&student=Y`
- **Random only**:
  - `/api/course/:id?pick=X` (no `student`/`class`)

Class-level weighting and multi-id (`+`) sources can be layered on top of this using the same patterns as `pickProgressQuestions` plus the existing mastery aggregation queries in `routes/teacher.js`.

