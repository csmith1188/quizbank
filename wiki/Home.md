# QuizBank User Guide

QuizBank is a classroom tool for storing questions, organizing them into courses, and helping students practice until they master each skill.

Teachers use it to build question banks, generate new questions, make quizzes, and assign work to classes. Students use it to take assigned quizzes, run practice tests, and see how they are doing on each task.

You sign in with your **Formbar** account. QuizBank uses the same login and the same classes you already have in Formbar.

For developers who want to pull questions into another page or program, see the [API guide](api.md).

## Contents

1. [Getting started](#getting-started)
2. [How a course is organized](#how-a-course-is-organized)
3. [For teachers](#for-teachers)
4. [For students](#for-students)
5. [Importing and exporting](#importing-and-exporting)
6. [Helpful tips](#helpful-tips)

---

## Getting started

1. Open QuizBank in your browser.
2. Log in with your Formbar account when prompted.
3. After login you will see two main places in the top navigation:
   - **Classes** — your Formbar classes, assigned courses, and assigned quizzes
   - **My Courses** — only teachers see this; this is where you build content

If you do not see **My Courses**, your Formbar account is treated as a student account. Ask a teacher or manager if you should have teacher access.

---

## How a course is organized

Think of a course as a folder for one subject, such as Programming or Biology.

Inside a course you will find:

| Piece | What it is |
| --- | --- |
| **Task** | A skill or learning target, such as “Students can build a linear flowchart.” Questions always belong to a task. |
| **Unit** | A group of related tasks and vocabulary, such as “Flowcharts & Algorithms.” |
| **Vocabulary** | Terms and definitions you want students to know. |
| **Question** | Usually a multiple-choice item tied to a task. Weak questions can be marked **bad** so they are hidden from quizzes, tests, and the API. |
| **Quiz** | A saved list of questions you can assign to a class or export to Kahoot, Gimkit, Blooket, or QTI. |

A good order to build a course is: **tasks first**, then units, vocabulary, questions, then quizzes.

---

## For teachers

### 1. Create a course

1. Open **My Courses**.
2. Click **New Course** and give it a name.
3. Optionally mark the course **Public** so other tools can list it through the API.
4. Open the course card (the accordion) to see links for Tasks, Units, Vocabulary, Quizzes, Questions, and Import.

You can rename a course from that card, drag the ⋮⋮ handle to reorder courses, or delete the course if you no longer need it. Deleting a course also deletes its units, tasks, vocab, questions, and quizzes.

### 2. Add tasks

Tasks are the foundation. Every question is attached to a task.

1. Open the course and click **Tasks**.
2. Click **New Task**.
3. Fill in:
   - **Name** — a short title
   - **Target** — what students should be able to do
   - **Description** — extra detail for you and for the question generator
4. Save, then drag tasks to put them in the order you teach them.

From a task you can also open **Edit questions** to add or change questions by hand.

### 3. Add units

Units are how you group tasks for teaching and for student mastery.

1. Open **Units** and click **New Unit**.
2. Give the unit a name.
3. Inside the unit, attach the tasks that belong there.
4. Attach vocabulary terms the same way.

The same task can appear in more than one unit if that is useful.

### 4. Add vocabulary

1. Open **Vocabulary** and click **New term**.
2. Enter the term and its definition.
3. Attach terms to units from the unit page if you want them grouped with a specific unit.

### 5. Add or generate questions

Open **Questions** from the course card.

You can:

- **Search** existing question prompts in the course
- **Generate** new questions with AI:
  1. Choose a unit (or all units), then a task
  2. Optionally add extra instructions, such as “use 9th-grade vocabulary”
  3. Click **Generate**
  4. Review each question before you keep it

When you review generated questions:

- Mark usable ones **good** so they can appear in quizzes and tests
- Mark weak ones **bad** and give a short reason. QuizBank uses those examples to write better questions next time.

You can also add questions by hand from a task’s **Edit questions** page.

Questions marked **bad** are left out of quizzes, progress tests, overall tests, and API results.

### 6. Build quizzes

1. Open **Quizzes** and click **New Quiz**.
2. Open the quiz and add questions from a course, unit, or task.
3. Choose **All questions** or **Random N**. Questions are copied into the quiz at that moment, so later changes to the bank do not automatically change an existing quiz.
4. Drag questions to reorder them.
5. Use **Preview** to see the quiz as students will see it.

From the quiz list you can also export:

- **QTI** for many learning platforms
- **Kahoot XLSX**
- **Gimkit CSV**
- **Blooket CSV**

### 7. Assign work to a class

Classes come from Formbar. You do not create them inside QuizBank.

1. Open **Classes**.
2. Find a class you teach and click **Manage**.
3. **Assign a course** so students can see mastery and take practice tests.
4. Optionally set **Mastery intensity** for that course:
   - Relaxed — shorter recent-attempt window
   - Standard — default
   - Intense — longer window, so mastery is harder to keep high
5. **Assign a quiz** if you want students to take a specific quiz.

On the class page you can also open each student and check their mastery by course.

### 8. Send a Formbar poll

On course and unit lists, the ◎ button creates a Formbar poll from a random eligible question. Use this when you want a quick live check with the class that is currently active in Formbar.

---

## For students

1. Log in with your Formbar account.
2. Open **Classes** and expand your class.
3. Under **Courses**, click a course to open your **mastery** page.
4. Under **Assigned quizzes**, click **Take quiz**. After you finish, you can open **See best attempt** if you have already taken it.

On a mastery page you will see each unit and task with a percentage. Overall mastery is the average of those task scores.

From your own mastery page you can:

- **Start progress test** — a shorter practice set aimed at the skills you still need. Correct answers help update mastery.
- **Start overall knowledge test** — a broader mixed review across the course.
- **Ask the AI Coach** — study suggestions based on how you are doing.

If a page says you have no mastery data yet, take a progress test or an assigned quiz to get started.

---

## Importing and exporting

### Import a whole course from Excel

If you already have content in a spreadsheet:

1. Open the course card and click **Import from Excel/CSV**.
2. Download `upload_template.xlsx` (or the sample `10th_import.xlsx`).
3. Fill in the three sheets: course/unit/task structure, vocabulary, and questions.
4. Upload the `.xlsx` file.
5. On the next screen, choose which parts to import and confirm. Nothing is saved until you confirm.

You can also **Export to Excel** from the course card if you want a workbook of the current course.

### Export a quiz to another tool

Open the quiz in **Quizzes**, then choose QTI, Kahoot, Gimkit, or Blooket export. Those files are for running the quiz in those other apps; they do not replace assigning the quiz in QuizBank.

---

## Helpful tips

- Drag the ⋮⋮ handle to reorder courses, tasks, units, quizzes, and many lists inside a course.
- The small copy button (⧉) copies an API path, such as `/api/course/1`. That is useful if someone is connecting another app; most teachers and students can ignore it.
- Questions marked **bad** stay in the bank for the generator to learn from, but students will not see them.
- Mastery is tracked per task. Assigning a course to a class is what lets students practice and lets you see their progress.
- If a student is missing from a class, fix the roster in Formbar, then return to QuizBank.

If you are building a web page or script that should pull questions automatically, continue with the [API guide](api.md).
