# Quiz Bank API

A RESTful API for accessing quiz bank hierarchy data.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on port 3000 by default.

## API Endpoints

### Get Course Details
```
GET /course/:courseId
```

### List Sections in a Course
```
GET /course/:courseId/section
```

### Get Section Details
```
GET /course/:courseId/section/:sectionId
```

### List Units in a Section
```
GET /course/:courseId/section/:sectionId/unit
```

### Get Unit Details
```
GET /course/:courseId/section/:sectionId/unit/:unitId
```

### List Tasks in a Unit
```
GET /course/:courseId/section/:sectionId/unit/:unitId/task
```

### Get Task Details
```
GET /course/:courseId/section/:sectionId/unit/:unitId/task/:taskId
```

### Pick Random Questions from a Unit
```
GET /course/:courseId/section/:sectionId/unit/:unitId/pick/:number
```

## Example Usage

1. Get all sections in course 1:
```
GET /course/1/section
```

2. Get all units in section 2 of course 1:
```
GET /course/1/section/2/unit
```

3. Pick 10 random questions from unit 1 in section 2 of course 1:
```
GET /course/1/section/2/unit/1/pick/10
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