## QuizBank Public API

All endpoints below are mounted under the `/api` prefix, as configured in `app.js`:

- Base URL: `/api`
- Responses are JSON.
- Errors use HTTP status codes with a body of the form `{ "error": "message" }`.
- Any resource with a `sort_order` column in the database exposes it in the API payload.

Authentication / access:

- Many read-only endpoints are available for **public courses** (`is_public = 1`).
- Private courses can be accessed by their owner via session, or by providing a valid API key via:
  - Query: `?api_key=YOUR_KEY`
  - Header: `Authorization: Bearer YOUR_KEY`

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

#### Course details or course-level question picking

- **GET** `/api/course/:id`
- `:id` is a single course id (e.g. `1`).

If **no `pick` query param** is present, you get course metadata:

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

- `pick` (required for picking): integer, number of questions requested (capped by `MAX_PICK`, currently 20).
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

#### Course vocab

- **GET** `/api/course/:id/vocab`

Returns all vocab terms for the given course.

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

#### Course-level random picking (legacy path)

- **GET** `/api/course/:id/pick/:number`

Equivalent in behavior to `GET /api/course/:id?pick=X`, but uses a path segment for `number` instead of a query param.

- `number` is capped by `MAX_PICK` (20).
- Optional `student` query param enables mastery-weighted selection using `pickProgressQuestions`.
- Optional `class` is currently not supported (400).

Examples:

- `/api/course/1/pick/5`
- `/api/course/1/pick/5?student=123`

---

### Unit

#### Unit details

- **GET** `/api/course/:courseId/unit/:unitId`

Returns tasks and vocab for a specific unit within a course.

Response:

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

- **GET** `/api/course/:courseId/unit/:unitId/questions`

Returns all questions for the tasks in a given unit.

Each question is in the standard shape documented above; `hierarchy.course`, `hierarchy.unit`, and `hierarchy.task` are all populated.

#### Unit-level random picking

- **GET** `/api/course/:courseId/unit/:unitId/pick/:number`

Returns `number` random questions from the unit.

Notes:

- `number` is capped by `MAX_PICK` (20).
- Currently this endpoint only supports **uniform random** picking; there is no `student`/`class` weighting here.

---

### Task

#### Task details

- **GET** `/api/course/:courseId/task/:taskId`

Returns basic metadata for a single task and its containing course.

Response:

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

- **GET** `/api/course/:courseId/task/:taskId/questions`

Returns all questions for a specific task in a course.

Questions use the standard question shape; `hierarchy.course` and `hierarchy.task` are populated.

#### Task-level random picking

- **GET** `/api/course/:courseId/task/:taskId/pick/:number`

Returns `number` random questions from that task (capped at `MAX_PICK`).

Currently this endpoint uses uniform random sampling and does **not** support `student`/`class` weighting.

---

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

- **GET** `/api/course/:courseId/question/:questionId`

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
- `/api/course/1/pick/10`
- `/api/course/1/pick/10?student=123`

Rules:

- `pick` / `number` is capped by `MAX_PICK` (20).
- If **no `student` or `class`** is provided, questions are selected using uniform random sampling without replacement.
- If `student` is provided at the **course** level, selection is **mastery-weighted** using the same algorithm as the Progress Test:
  - Logic lives in `lib/progress-quiz.js` (`pickProgressQuestions`).
  - Tasks are weighted by `(1 - mastery)`, with gating and unit/frontier rules as in the Progress Test.
  - Resulting question ids are then expanded into full question objects using the standard question shape.
- If `class` is provided on the course-level picking endpoints, the current implementation returns `400` (not yet implemented).

### Where weighting is implemented

- **Implemented**:
  - `/api/course/:id?pick=X&student=Y`
  - `/api/course/:id/pick/:number?student=Y`
- **Random only**:
  - `/api/course/:id?pick=X` (no `student`/`class`)
  - `/api/course/:id/pick/:number` (no `student`/`class`)
  - `/api/course/:courseId/unit/:unitId/pick/:number`
  - `/api/course/:courseId/task/:taskId/pick/:number`

Class-level weighting and multi-id (`+`) sources can be layered on top of this using the same patterns as `pickProgressQuestions` plus the existing mastery aggregation queries in `routes/teacher.js`.

