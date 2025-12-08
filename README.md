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

## Rate Limiting

The API includes rate limiting to prevent abuse:
- **Limit:** 100 requests per minute per IP address
- **Window:** 1 minute
- **Headers:** Rate limit information is included in response headers 
