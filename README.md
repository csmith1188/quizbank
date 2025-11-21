# Quiz Bank API

A RESTful API for accessing quiz bank hierarchy data.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make the database
```bash
node db/database-init.js
```

3. Start the server:
```bash
npm start
```

The server will run on port 3000 by default.

## Database

The application uses SQLite as the database, with Sequelize as the ORM (Object-Relational Mapping) tool. The database file is located at [`db/database.sqlite`]. Sequelize provides a simple way to define models and relationships, making it easy to interact with the database.

### Database Models

The database consists of the following models:

- **Course**: Represents a course, which contains multiple sections.
- **Section**: Represents a section within a course, which contains multiple units.
- **Unit**: Represents a unit within a section, which contains multiple tasks.
- **Task**: Represents a task within a unit, which contains multiple questions.
- **Question**: Represents a question within a task.

### Relationships

- A `Course` has many `Sections`.
- A `Section` belongs to a `Course` and has many `Units`.
- A `Unit` belongs to a `Section` and has many `Tasks`.
- A `Task` belongs to a `Unit` and has many `Questions`.
- A `Question` belongs to a `Task`.

## Seeding System

The seeding system is designed to populate the database with initial data for courses, sections, units, tasks, and questions. This allows for easier testing and development of the API.

### Seeding Process

1. **Define Seed Data**: The seed data is defined in a JSON file located at `quizsources/courses.json`. This file contains the hierarchy of courses, sections, units, tasks, and questions.

3. **Example Seed Data**: Below is an example structure of the `courses.json` file:
   ```json
   {
     "courses": [
       {
   
         "id": 1,
         "name": "Course 1",
         "sections": [
           {
   
             "id": 1,
             "name": "Section 1",
             "units": [
               {
   
                 "id": 1,
                 "name": "Unit 1",
                 "tasks": [
                   {
                     "id": 1,
                     "name": "Task 1",
                     "questions": [
                       {
                         "id": 1,
                         "ai": false,
                         "prompt": "What is 2 + 2?",
                         "correctAnswer": "4",
                         "correctIndex": 0,
                         "answers": ["4", "3", "5", "6"]
                       }
                     ]
                   }
                 ]
               }
             ]
           }
         ]
       }
     ]
   }
   ```

4. **Output**: After running the seeder, you should see the following message:
   ```
   ✅ Database seeded successfully!
   ```

## API Endpoints

### Get Course Details
```
GET /api/resource/course/:courseId
```

### Pick Random Questions from a Course
```
GET /api/resource/course/:courseId/pick/?pick=:amount
```

### List Sections in a Course
```
GET /api/resource/course/:courseId/section
```

### Get Section Details
```
GET /api/resource/course/:courseId/section/:sectionId
```

### Pick Random Questions from a Section
```
GET /api/resource/course/:courseId/section/:sectionId/?pick=:amount
```

### List Units in a Section
```
GET /api/resource/course/:courseId/section/:sectionId/unit
```

### Get Unit Details
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId
```

**Multiple Units:** You can combine multiple units by separating their IDs with `+` signs:
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId1+unitId2+unitId3
```

### Pick Random Questions from a Unit
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId/?pick=:amount
```

**Multiple Units:** You can pick questions from multiple units by separating their IDs with `+` signs:
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId1+unitId2/?pick=:number
```

### List Tasks in a Unit
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId/task
```

### Get Task Details
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId/task/:taskId
```

**Multiple Tasks:** You can combine multiple tasks by separating their IDs with `+` signs:
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId/task/:taskId1+taskId2+taskId3
```

### Pick Random Questions from a Task
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId/task/:taskId/?pick=:amount
```

**Multiple Tasks:** You can pick questions from multiple tasks by separating their IDs with `+` signs:
```
GET /api/resource/course/:courseId/section/:sectionId/unit/:unitId/task/:taskId1+taskId2/?pick=:amount
```

## Example Usage

1. Get all sections in course 1:
```
GET /api/resource/course/1/section
```

2. Get all units in section 2 of course 1:
```
GET /api/resource/course/1/section/2/unit
```

3. Pick 10 random questions from unit 1 in section 2 of course 1:
```
GET /api/resource/course/1/section/2/unit/1/?pick=10
```

4. Pick 5 random questions from units 1 and 2 in section 2 of course 1:
```
GET /api/resource/course/1/section/2/unit/1+2/?pick=5
```

5. Pick 10 random multiple choice questions from units 1, 2, and 3 of section 4 of course 1:
```
GET /api/resource/course/1/section/2/unit/1+2/?pick=5&type=multiple-choice
```

6. Get details for tasks 2 and 3 in unit 1, section 2, course 1:
```
GET /api/resource/course/1/section/2/unit/1/task/2+3
```

7. Pick 3 random questions from tasks 2 and 3 in unit 1, section 2, course 1:
```
GET /api/resource/course/1/section/2/unit/1/task/2+3/?pick=3
```

## Response Format

All endpoints return JSON responses. For list endpoints (without an ID at the end), the response includes an array of objects with `id` and `name` properties.

Example response for `/course/1/section`:
```json
[
    {
        "id": 1,
        "name": "Section1"
    },
    {
        "id": 2,
        "name": "Section2"
    }
]
```

For detail endpoints (with an ID at the end), the response includes the full object with all its properties.

### Multiple Resource Responses

When requesting multiple resources (using `+` separated IDs), the API returns a combined response:

**Multiple Units:**
```json
{
    "id": "1+2",
    "name": "Combined Units: Unit1, Unit2",
    "units": [...]
}
```

**Multiple Tasks:**
```json
{
    "id": "2+3",
    "name": "Combined Tasks: Task2, Task3",
    "tasks": [...],
    "hierarchy": {...}
}
```

## Rate Limiting

The API includes rate limiting to prevent abuse:
- **Limit:** 100 requests per minute per IP address
- **Window:** 1 minute
- **Headers:** Rate limit information is included in response headers 
