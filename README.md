# Quiz Bank API

A RESTful API for accessing quiz bank hierarchy data.

## Installation

1. Install dependencies:
```bash
npm install
Start the server:

bash
Copy code
npm start
For development with auto-reload:

bash
Copy code
npm run dev
The server will run on port 3000 by default.

API Endpoints
Get Course Details
bash
Copy code
GET /course/:courseId
Pick Random Questions from a Course
ruby
Copy code
GET /course/:courseId/pick/:number
List Sections in a Course
ruby
Copy code
GET /course/:courseId/section
Get Section Details
ruby
Copy code
GET /course/:courseId/section/:sectionId
Pick Random Questions from a Section
ruby
Copy code
GET /course/:courseId/section/:sectionId/pick/:number
List Units in a Section
ruby
Copy code
GET /course/:courseId/section/:sectionId/unit
Get Unit Details
ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId
Multiple Units: You can combine multiple units by separating their IDs with + signs:

ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId1+unitId2+unitId3
Pick Random Questions from a Unit
ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId/pick/:number
Multiple Units: You can pick questions from multiple units by separating their IDs with + signs:

ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId1+unitId2/pick/:number
List Tasks in a Unit
ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId/task
Get Task Details
ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId
Multiple Tasks: You can combine multiple tasks by separating their IDs with + signs:

ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId1+taskId2+taskId3
Pick Random Questions from a Task
ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId/pick/:number
Multiple Tasks: You can pick questions from multiple tasks by separating their IDs with + signs:

ruby
Copy code
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId1+taskId2/pick/:number
Example Usage
Get all sections in course 1:

bash
Copy code
GET /course/1/section
Get all units in section 2 of course 1:

bash
Copy code
GET /course/1/section/2/unit
Pick 10 random questions from unit 1 in section 2 of course 1:

bash
Copy code
GET /course/1/section/2/unit/1/pick/10
Pick 5 random questions from units 1 and 2 in section 2 of course 1:

bash
Copy code
GET /course/1/section/2/unit/1+2/pick/5
Get details for tasks 2 and 3 in unit 1, section 2, course 1:

bash
Copy code
GET /course/1/section/2/unit/1/task/2+3
Pick 3 random questions from tasks 2 and 3 in unit 1, section 2, course 1:

bash
Copy code
GET /course/1/section/2/unit/1/task/2+3/pick/3
Response Format
All endpoints return JSON responses. For list endpoints (without an ID at the end), the response includes an array of objects with id and name properties.

Example response for /course/1/section:

json
Copy code
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
For detail endpoints (with an ID at the end), the response includes the full object with all its properties.

Multiple Resource Responses
When requesting multiple resources (using + separated IDs), the API returns a combined response:

Multiple Units:

json
Copy code
{
    "id": "1+2",
    "name": "Combined Units: Unit1, Unit2",
    "units": [...]
}
Multiple Tasks:

json
Copy code
{
    "id": "2+3",
    "name": "Combined Tasks: Task2, Task3",
    "tasks": [...],
    "hierarchy": {...}
}
Rate Limiting
The API includes rate limiting to prevent abuse:

Limit: 100 requests per minute per IP address

Window: 1 minute

Headers: Rate limit information is included in response headers

🗄️ Database Seeding
The API uses Sequelize with SQLite for its database.
A data.json file and a seed.js script are included to populate the database with sample data.

JSON Structure
The JSON file mirrors the database hierarchy:

json
Copy code
{
  "courses": [
    {
      "name": "Course1",
      "sections": [
        {
          "name": "Section1",
          "units": [
            {
              "name": "Unit1",
              "tasks": [
                {
                  "name": "Task1",
                  "questions": [
                    {
                      "ai": true,
                      "prompt": "What does the kanji 日 mean?",
                      "correctAnswer": "Sun",
                      "correctIndex": 0,
                      "answers": ["Sun", "Tree", "Water", "Mountain"]
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
Running the Seeder
Ensure dependencies are installed:

bash
Copy code
npm install
Run the seeding script:

bash
Copy code
node db/seed.js
The script will:

Drop and recreate all tables (sequelize.sync({ force: true })).

Insert courses, sections, units, tasks, and questions from data.json.

Automatically generate primary keys and wire up all foreign key relationships.

Notes
IDs in the JSON file are not required — Sequelize auto-generates them.

The hierarchy is preserved:
Course → Section → Unit → Task → Question

Foreign key constraints are enforced in the database with cascading deletes (e.g. deleting a course also deletes its sections, units, tasks, and questions).
