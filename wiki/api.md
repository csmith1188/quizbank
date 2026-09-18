# QuizBank Public API

All endpoints below are mounted under `/api`, as configured in `app.js`.

- Base URL: `/api` (example: `http://localhost:3000/api`)
- Responses are JSON.
- Errors use HTTP status codes with a body of the form `{ "error": "message" }`.
- Any resource with a `sort_order` column in the database exposes it in the API payload.
- Questions marked **bad** are excluded from read/query endpoints (`COALESCE(quality, '') != 'bad'`).

For a non-technical overview of QuizBank itself, see the [user guide](home.md).

## Contents

1. [Authentication](#authentication--access)
2. [Rate limits](#rate-limits)
3. [Tutorials](#tutorials)
    - [HTML page](#tutorial-html-page)
    - [Node.js](#tutorial-nodejs)
    - [Python](#tutorial-python)
4. [Question shape](#question-shape)
5. [Resources](#resources)
6. [Combining IDs](#combining-ids)
7. [Question selection and mastery weighting](#question-selection-and-mastery-weighting)

---

## Authentication / access

- `GET /api/course` returns **public courses only** (`is_public = 1`).
- Other **read** endpoints (`/api/course/:id`, `/api/unit/:id`, `/api/task/:id`, `/api/question/:id`, and their question/vocab helpers) currently return the resource if the id exists. They do not require a session or API key.
- **Mastery**, listing your own courses, and all create/update/delete endpoints require a logged-in QuizBank session **or** a valid Formbar API key for a user already linked to QuizBank by `formbar_id`.
- Course mastery accepts:
  - the logged-in session, or
  - a teacher/manager Formbar API key when viewing another enrolled student (`?student=`), or
  - the student’s own Formbar API key when viewing their own mastery.

Send a Formbar API key in any of these ways:

- Formbar-compatible header: `API: YOUR_KEY`
- Header: `X-API-Key: YOUR_KEY`
- Header: `Authorization: Bearer YOUR_KEY`
- Query: `?api_key=YOUR_KEY`

Keys are checked with Formbar (`/api/me`). An unknown or invalid key returns `401`. If Formbar cannot be reached, the API returns `502`.

---

## Rate limits

- Global limiter on all `/api/*`: **120 requests / 60 seconds** per key (session user, API key, or IP fallback). Defaults can be changed with `API_RATE_LIMIT_MAX` and `API_RATE_LIMIT_WINDOW_MS`.
- Question generation limiter: **12 requests / 60 seconds** per key (`QUESTION_GENERATE_RATE_LIMIT_MAX` / `QUESTION_GENERATE_RATE_LIMIT_WINDOW_MS`).
- On limit hit, the API returns `429` with `Retry-After` plus `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

---

## Tutorials

Replace `http://localhost:3000` with your QuizBank host. Public course ids change per install; start with `GET /api/course` to see what is available.

These examples only **read** questions. They do not grade answers or write mastery. To personalize picks by student, add `&student=FORMBAR_ID` on the course pick URL and send that student’s (or a teacher’s) API key.

### Tutorial: HTML page

This page lists public courses, then loads random questions from the course you choose.

Browsers only allow this `fetch` when the HTML is served from the **same origin** as QuizBank (or another origin that QuizBank has allowed). QuizBank does not currently send CORS headers, so a page hosted on a different website will be blocked. In that case, call the API from [Node.js](#tutorial-nodejs) or [Python](#tutorial-python) instead and return the JSON to your page.

#### Step 1. Create the page

Save a file as `quizbank-demo.html` with a course dropdown, a button, and a place to show results. Replace `http://localhost:3000` with your QuizBank host.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>QuizBank demo</title>
</head>
<body>
  <h1>QuizBank demo</h1>
  <label>
    Course
    <select id="course"></select>
  </label>
  <button id="load" type="button">Load 5 questions</button>
  <pre id="out">Loading courses…</pre>
  <script>
    const BASE = 'http://localhost:3000/api';
    const out = document.getElementById('out');
    const select = document.getElementById('course');
  </script>
</body>
</html>
```

#### Step 2. Add a JSON helper

Inside the `<script>` tag, add a helper that calls the API and turns error responses into thrown errors.

```javascript
async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
```

#### Step 3. List public courses

On page load, call `GET /api/course` and fill the dropdown.

```javascript
async function loadCourses() {
  const courses = await getJson(BASE + '/course');
  if (!courses.length) {
    out.textContent = 'No public courses found.';
    return;
  }
  select.innerHTML = courses.map(function (c) {
    return '<option value="' + c.id + '">' + c.name + ' (id ' + c.id + ')</option>';
  }).join('');
  out.textContent = 'Choose a course, then load questions.';
}

loadCourses().catch(function (err) {
  out.textContent = 'Error: ' + err.message +
    '\nIf this page is not on the same site as QuizBank, use Node.js or Python instead.';
});
```

#### Step 4. Pick questions from the selected course

When the button is clicked, call `GET /api/course/:id?pick=5` and show the JSON.

```javascript
document.getElementById('load').addEventListener('click', async function () {
  const id = select.value;
  if (!id) return;
  out.textContent = 'Loading…';
  try {
    const questions = await getJson(BASE + '/course/' + id + '?pick=5');
    out.textContent = JSON.stringify(questions, null, 2);
  } catch (err) {
    out.textContent = 'Error: ' + err.message;
  }
});
```

#### Step 5 (optional). Send an API key

Same-origin only, and only if you are comfortable exposing that key to the page. Prefer keeping keys on a server; the Node.js and Python tutorials do that.

```javascript
await fetch(BASE + '/course/1/mastery', {
  headers: { 'Authorization': 'Bearer YOUR_KEY' }
});
```

#### Complete HTML example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>QuizBank demo</title>
</head>
<body>
  <h1>QuizBank demo</h1>
  <label>
    Course
    <select id="course"></select>
  </label>
  <button id="load" type="button">Load 5 questions</button>
  <pre id="out">Loading courses…</pre>

  <script>
    const BASE = 'http://localhost:3000/api';
    const out = document.getElementById('out');
    const select = document.getElementById('course');

    async function getJson(url) {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    }

    async function loadCourses() {
      const courses = await getJson(BASE + '/course');
      if (!courses.length) {
        out.textContent = 'No public courses found.';
        return;
      }
      select.innerHTML = courses.map(function (c) {
        return '<option value="' + c.id + '">' + c.name + ' (id ' + c.id + ')</option>';
      }).join('');
      out.textContent = 'Choose a course, then load questions.';
    }

    document.getElementById('load').addEventListener('click', async function () {
      const id = select.value;
      if (!id) return;
      out.textContent = 'Loading…';
      try {
        const questions = await getJson(BASE + '/course/' + id + '?pick=5');
        out.textContent = JSON.stringify(questions, null, 2);
      } catch (err) {
        out.textContent = 'Error: ' + err.message;
      }
    });

    loadCourses().catch(function (err) {
      out.textContent = 'Error: ' + err.message +
        '\nIf this page is not on the same site as QuizBank, use Node.js or Python instead.';
    });
  </script>
</body>
</html>
```

### Tutorial: Node.js

Works in Node.js 18+ with built-in `fetch`. Save as `quizbank-demo.js` and run `node quizbank-demo.js`.

#### Step 1. Set the base URL

```javascript
const BASE = process.env.QUIZBANK_URL || 'http://localhost:3000/api';
const API_KEY = process.env.QUIZBANK_API_KEY || ''; // optional Formbar key
```

#### Step 2. Add a request helper

This helper attaches an API key when one is set, parses JSON, and throws on error responses.

```javascript
async function quizbank(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (API_KEY) headers.Authorization = 'Bearer ' + API_KEY;

  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || ('HTTP ' + res.status));
  }
  return data;
}
```

#### Step 3. List public courses

```javascript
const courses = await quizbank('/course');
console.log('Public courses:', courses.map(c => `${c.id}: ${c.name}`));
```

#### Step 4. Read course details

Use the first public course, or replace `courseId` with an id you already know.

```javascript
const courseId = courses[0].id;
const details = await quizbank('/course/' + courseId);
console.log('Units:', details.units);
console.log('Tasks:', details.tasks.map(t => `${t.id}: ${t.name}`));
```

#### Step 5. Pick questions

```javascript
const questions = await quizbank('/course/' + courseId + '?pick=5');
questions.forEach((q, i) => {
  console.log('\n' + (i + 1) + '. ' + q.prompt);
  (q.answers || []).forEach((a, idx) => {
    const mark = idx === q.correctIndex ? ' (correct)' : '';
    console.log('   ' + idx + ': ' + a + mark);
  });
});
```

#### Step 6 (optional). Pick from a unit or several tasks

Join ids with `+`.

```javascript
const fromUnit = await quizbank('/unit/1?pick=10');
const fromTasks = await quizbank('/task/117+118+119?pick=10');
```

#### Step 7 (optional). Generate unsaved questions

Rate-limited. The QuizBank server must have `OPENAI_API_KEY` set.

```javascript
const generated = await quizbank(
  '/course/' + courseId + '?generate=5&task=3&context=' +
  encodeURIComponent('Focus on scenario-based questions')
);
console.log(generated);
```

#### Step 8 (optional). Read course mastery

Requires an API key and an enrolled student.

```javascript
const mastery = await quizbank('/course/' + courseId + '/mastery?student=123');
console.log('Overall mastery:', mastery.overallMastery);
```

#### Complete Node.js example

```javascript
const BASE = process.env.QUIZBANK_URL || 'http://localhost:3000/api';
const API_KEY = process.env.QUIZBANK_API_KEY || ''; // optional Formbar key

async function quizbank(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (API_KEY) headers.Authorization = 'Bearer ' + API_KEY;

  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || ('HTTP ' + res.status));
  }
  return data;
}

async function main() {
  const courses = await quizbank('/course');
  console.log('Public courses:', courses.map(c => `${c.id}: ${c.name}`));

  if (!courses.length) return;
  const courseId = courses[0].id;

  const details = await quizbank('/course/' + courseId);
  console.log('Units:', details.units);
  console.log('Tasks:', details.tasks.map(t => `${t.id}: ${t.name}`));

  const questions = await quizbank('/course/' + courseId + '?pick=5');
  questions.forEach((q, i) => {
    console.log('\n' + (i + 1) + '. ' + q.prompt);
    (q.answers || []).forEach((a, idx) => {
      const mark = idx === q.correctIndex ? ' (correct)' : '';
      console.log('   ' + idx + ': ' + a + mark);
    });
  });

  // const fromUnit = await quizbank('/unit/1?pick=10');
  // const fromTasks = await quizbank('/task/117+118+119?pick=10');
  // const generated = await quizbank(
  //   '/course/' + courseId + '?generate=5&task=3&context=' +
  //   encodeURIComponent('Focus on scenario-based questions')
  // );
  // const mastery = await quizbank('/course/' + courseId + '/mastery?student=123');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

### Tutorial: Python

This uses only the Python standard library (3.8+). Save as `quizbank_demo.py` and run `python quizbank_demo.py`.

#### Step 1. Import modules and set the base URL

```python
import json
import os
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("QUIZBANK_URL", "http://localhost:3000/api")
API_KEY = os.environ.get("QUIZBANK_API_KEY", "")  # optional Formbar key
```

#### Step 2. Add a request helper

```python
def quizbank(path):
    req = urllib.request.Request(
        BASE + path,
        headers={"Accept": "application/json"},
    )
    if API_KEY:
        req.add_header("Authorization", "Bearer " + API_KEY)

    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(body).get("error") or body
        except json.JSONDecodeError:
            message = body
        raise RuntimeError(f"HTTP {err.code}: {message}") from err
```

#### Step 3. List public courses

```python
courses = quizbank("/course")
print("Public courses:", [(c["id"], c["name"]) for c in courses])
```

#### Step 4. Read course details

Use the first public course, or replace `course_id` with an id you already know.

```python
course_id = courses[0]["id"]
details = quizbank(f"/course/{course_id}")
print("Units:", details.get("units"))
print("Tasks:", [(t["id"], t["name"]) for t in details.get("tasks", [])])
```

#### Step 5. Pick questions

```python
questions = quizbank(f"/course/{course_id}?pick=5")
for i, q in enumerate(questions, start=1):
    print(f"\n{i}. {q['prompt']}")
    for idx, answer in enumerate(q.get("answers") or []):
        mark = " (correct)" if idx == q.get("correctIndex") else ""
        print(f"   {idx}: {answer}{mark}")
```

#### Step 6 (optional). Pick from a unit or several tasks

```python
from_unit = quizbank("/unit/1?pick=10")
from_tasks = quizbank("/task/117+118+119?pick=10")
```

#### Step 7 (optional). Generate unsaved questions

Rate-limited. The QuizBank server must have `OPENAI_API_KEY` set.

```python
query = urllib.parse.urlencode({
    "generate": 5,
    "task": 3,
    "context": "Focus on scenario-based questions",
})
generated = quizbank(f"/course/{course_id}?{query}")
```

#### Step 8 (optional). Read course mastery

Requires an API key and an enrolled student.

```python
mastery = quizbank(f"/course/{course_id}/mastery?student=123")
print("Overall mastery:", mastery["overallMastery"])
```

If you prefer the `requests` library instead of `urllib`:

```python
import requests

BASE = "http://localhost:3000/api"
res = requests.get(f"{BASE}/course/1", params={"pick": 5}, timeout=30)
res.raise_for_status()
questions = res.json()
```

#### Complete Python example

```python
import json
import os
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("QUIZBANK_URL", "http://localhost:3000/api")
API_KEY = os.environ.get("QUIZBANK_API_KEY", "")  # optional Formbar key


def quizbank(path):
    req = urllib.request.Request(
        BASE + path,
        headers={"Accept": "application/json"},
    )
    if API_KEY:
        req.add_header("Authorization", "Bearer " + API_KEY)

    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(body).get("error") or body
        except json.JSONDecodeError:
            message = body
        raise RuntimeError(f"HTTP {err.code}: {message}") from err


def main():
    courses = quizbank("/course")
    print("Public courses:", [(c["id"], c["name"]) for c in courses])
    if not courses:
        return

    course_id = courses[0]["id"]
    details = quizbank(f"/course/{course_id}")
    print("Units:", details.get("units"))
    print("Tasks:", [(t["id"], t["name"]) for t in details.get("tasks", [])])

    questions = quizbank(f"/course/{course_id}?pick=5")
    for i, q in enumerate(questions, start=1):
        print(f"\n{i}. {q['prompt']}")
        for idx, answer in enumerate(q.get("answers") or []):
            mark = " (correct)" if idx == q.get("correctIndex") else ""
            print(f"   {idx}: {answer}{mark}")

    # from_unit = quizbank("/unit/1?pick=10")
    # from_tasks = quizbank("/task/117+118+119?pick=10")
    # query = urllib.parse.urlencode({
    #     "generate": 5,
    #     "task": 3,
    #     "context": "Focus on scenario-based questions",
    # })
    # generated = quizbank(f"/course/{course_id}?{query}")
    # mastery = quizbank(f"/course/{course_id}/mastery?student=123")


if __name__ == "__main__":
    main()
```

---

## Question shape

Stored questions returned by pick/read endpoints look like this:

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
  "time": 30,
  "hierarchy": {
    "course": { "id": 1, "name": "Programming" },
    "unit": { "id": 1, "name": "Flowcharts & Algorithms" },
    "task": { "id": 3, "name": "Building Linear Flowcharts" }
  }
}
```

Notes:

- `time` is the suggested seconds for the question (default `30` when unset).
- `ai` is `true` when the question was stored as AI-generated.
- `hierarchy.course` and `hierarchy.task` are present for questions tied to tasks.
- `hierarchy.unit` is included when the question is loaded through a unit endpoint. Course-level pick/read may omit `unit`.
- Empty `answers` means the item has no multiple-choice options.

**Generated** questions (`?generate=`) are **not** stored and use a different shape: `prompt`, `correct_answer`, `correct_index`, `answers` (no `id`, `ai`, `time`, or `hierarchy`).

---

## Resources

### Course

#### List public courses

- **GET** `/api/course`

Returns all public courses.

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
- `:id` is a single course id (e.g. `1`). Combined `+` ids are **not** supported here.

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
      "description": "Students arrange process steps in order.",
      "sort_order": 2
    }
  ],
  "vocab": [
    {
      "id": 10,
      "term": "Algorithm",
      "definition": "A step-by-step set of instructions.",
      "sort_order": 0
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

- `pick` (required for picking): integer, number of questions requested (capped by `API_PICK_MAX`, currently **25**).
- `student` (optional): integer student id (`formbar_id` first, then local user id). When present, question selection uses the same **mastery-weighted algorithm** as the Progress Test (`lib/progress-quiz.js`).
- `class` (optional): integer class id. Currently **not supported** on this endpoint and returns `400`.

If `pick` is absent and **`generate` is present**, this endpoint returns newly generated questions (not saved to the database):

- `GET /api/course/1?generate=10`
- `GET /api/course/1?generate=10&task=3`
- `GET /api/course/1?generate=10&task=3&context=Focus%20on%20scenario-based%20questions`

Generation parameters:

- `generate` (optional value): requested question count, capped at **10** (`API_GENERATE_MAX`). Bare `?generate` uses the max.
- `task` or `taskId` (optional): task to generate from. If omitted, the first task in the course by `sort_order, id` is used.
- `context` (optional): extra prompt instructions.

Generation notes:

- Runs only when `pick` is **not** present.
- Uses the same generation logic as the teacher question generator (`lib/question-generator.js`).
- Does not insert or update database records.
- Requires `OPENAI_API_KEY` on the server; otherwise returns `500`.
- Example generated item:

```json
{
  "prompt": "What is the first step in a linear flowchart?",
  "correct_answer": "Start",
  "correct_index": 0,
  "answers": ["Start", "Process", "Decision", "End"]
}
```

#### Course mastery

- **GET** `/api/course/:courseId/mastery`
- Returns the authenticated student’s mastery for the course.
- Teachers and managers may request another enrolled student with `?student=Y`, using the same id resolution as course picking (`formbar_id` first, then local user id).
- Students may request only their own mastery, and only for a course assigned to one of their classes.
- Each task appears once. If a task belongs to multiple units, `unit` is the first unit by sort order.
- `overallMastery` is the unweighted mean of those unique task scores (tasks with no mastery record count as `0`).

```json
{
  "course": { "id": 1, "name": "Programming" },
  "userId": 7,
  "name": "Student Name",
  "formbarId": 44,
  "overallMastery": 0.75,
  "tasks": [
    {
      "id": 3,
      "name": "Building Linear Flowcharts",
      "unit": { "id": 1, "name": "Algorithms" },
      "mastery": 0.75
    }
  ]
}
```

#### Course vocab

- **GET** `/api/course/:id/vocab`

Returns all vocab terms for the given course.
Supports optional random picking with `?pick=N` (capped by `API_PICK_MAX`).

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

```json
[
  { "id": 1, "name": "Flowcharts & Algorithms", "sort_order": 0 }
]
```

#### Course quizzes

- **GET** `/api/course/:id/quiz`

Returns all quizzes for the given course (id, name, `sort_order` only). There is no public `/api/quiz/:id` or `/api/course/:id/quiz/:quizId` that returns the quiz’s questions.

```json
[
  { "id": 5, "name": "Intro Quiz", "sort_order": 0 }
]
```

### Unit

#### Unit details

- **GET** `/api/unit/:unitId`

Returns tasks and vocab for a specific unit.

`:unitId` may be a single id or several ids joined with `+`. With multiple ids and **no** `pick` query, the response is a **JSON array** of unit detail objects (same shape as below). If any listed unit is missing, the response is `404`.

Optional query: **`?pick=N`** — returns **N** random questions (capped by `API_PICK_MAX`) from the union of non-`bad` questions for all tasks linked to the listed units (via `unit_tasks`). Response is a **JSON array** of questions with `hierarchy.course`, `hierarchy.unit`, and `hierarchy.task`. If the pool is empty, `[]`. If the same question would appear twice (for example a shared task across units), it is included once.

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
      "target": "Students can build a linear flowchart.",
      "description": "Students arrange process steps in order."
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

Each question is in the standard stored-question shape; `hierarchy.course`, `hierarchy.unit`, and `hierarchy.task` are all populated.

#### Unit vocab

- **GET** `/api/unit/:unitId/vocab`

Returns vocab terms associated with the unit (`unit_vocab`). With multiple unit ids joined with `+`, terms are merged and duplicate vocab ids appear once.
Supports optional random picking with `?pick=N` (capped by `API_PICK_MAX`).

### Task

#### Task details

- **GET** `/api/task/:taskId`

Returns basic metadata for a task and its containing course.

`:taskId` may be a single id or several ids joined with `+` (e.g. `117+118+119+121`). With multiple ids and **no** `pick` query, the response is a **JSON array** of task objects.

Optional query: **`?pick=N`** — returns **N** random questions (capped by `API_PICK_MAX`) drawn from the union of non-`bad` questions for all listed tasks. Response is a **JSON array** of stored questions (with `hierarchy.course` and `hierarchy.task`). If there are no eligible questions, the response is `[]`.

Single-task response (no `description` field):

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

Multi-task response objects also include `description` (or `null`).

#### Task questions

- **GET** `/api/task/:taskId/questions`

Returns all questions for one task, or for every listed task when `:taskId` uses `+`.

Questions use the standard stored-question shape; `hierarchy.course` and `hierarchy.task` are populated.

### Quiz

#### Course quizzes

See **Course quizzes** above: `GET /api/course/:courseId/quiz`.

#### Quiz questions

Quizzes store a fixed list of question ids in `quiz_questions`. The owner-only items endpoint is:

- `GET /api/courses/:courseId/quizzes/:quizId/items`

That route requires the course owner’s session or API key and returns `{ id, question_id, sort_order, prompt }` for each item—not the full public question shape.

There is **no unauthenticated** shortcut such as `/api/quiz/:id` that returns full question details for a quiz.

### Question

#### Single question by id

- **GET** `/api/question/:questionId`

Returns one stored question, including hierarchy (`course` and `task`). Questions marked **bad** return `404`.

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
  "time": 30,
  "hierarchy": {
    "course": { "id": 1, "name": "Programming" },
    "task": { "id": 3, "name": "Building Linear Flowcharts" }
  }
}
```

Owner create/update/delete routes live under `/api/courses/...` (plural) and require the course owner. They are used by the teacher UI and are not part of the public read API.

---

## Combining IDs

Several **unit** and **task** path segments accept multiple ids joined with `+`:

- `/api/unit/1+3+5`
- `/api/unit/1+3+5?pick=3`
- `/api/unit/1+3/questions`
- `/api/unit/1+3/vocab`
- `/api/task/117+118+119?pick=10`
- `/api/task/117+118/questions`

Rules:

- Ids are parsed with `String(param).split('+')`, keeping positive integers.
- With **no** `pick`, a single id returns one object; multiple ids return an array. Unit detail/questions/vocab return `404` if any listed unit is missing. Task **questions** also 404 if any task id is missing; task **metadata** (`GET /api/task/1+2` without `pick`) returns the tasks that exist.
- With `pick`, the listed ids are treated as one question pool. Duplicates are removed.

**Not** implemented:

- Combined course ids, such as `/api/course/1+2`
- Nested paths such as `/api/course/1/task/1+3+5`

For those, make separate calls and combine results in your client.

---

## Question Selection and Mastery Weighting

### `pick=X` query param

For endpoints that support question picking, `pick` controls how many questions are returned:

- `/api/course/1?pick=10`
- `/api/course/1?pick=10&student=123`
- `/api/unit/1+3?pick=5`
- `/api/task/117+118?pick=5`

Rules:

- `pick` is capped by `API_PICK_MAX` (**25** by default).
- If **no `student`** is provided, questions are selected with uniform random sampling without replacement.
- If `student` is provided on **`GET /api/course/:id`**, selection is **mastery-weighted** using the same algorithm as the Progress Test:
  - Logic lives in `lib/progress-quiz.js` (`pickProgressQuestions`).
  - Tasks are weighted by `(1 - mastery)`, with gating and unit/frontier rules as in the Progress Test.
  - Resulting question ids are expanded into full stored-question objects.
- Unit and task `pick` is always random (not mastery-weighted), even if you pass `student`.
- If `class` is provided on the course-level pick endpoint, the implementation returns `400` (not yet implemented).

### Where weighting is implemented

- **Implemented**: `/api/course/:id?pick=X&student=Y`
- **Random only**:
  - `/api/course/:id?pick=X` (no `student`)
  - `/api/unit/:id?pick=X`
  - `/api/task/:id?pick=X`
