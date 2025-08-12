const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 1 minute(s)',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all routes
app.use(limiter);

// Middleware
app.use(cors());
app.use(express.json());

// Load hierarchy data
const hierarchyData = JSON.parse(fs.readFileSync(path.join(__dirname, '../hierarchy.json'), 'utf8'));

// Helper function to find a resource by ID
function findResourceById(data, id) {
    if (data.id === id) return data;
    if (data.sections) {
        for (const section of data.sections) {
            if (section.id === id) return section;
            if (section.units) {
                for (const unit of section.units) {
                    if (unit.id === id) return unit;
                    if (unit.tasks) {
                        for (const task of unit.tasks) {
                            if (task.id === id) return task;
                        }
                    }
                }
            }
        }
    }
    return null;
}

// Helper function to get random items from an array
function getRandomItems(array, count) {
    const maxCount = Math.min(count, 20); // Limit to maximum 20 questions
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, maxCount);
}

// Helper function to find parent information for a task
function findTaskParents(taskId) {
    for (const section of hierarchyData.sections) {
        for (const unit of section.units) {
            for (const task of unit.tasks) {
                if (task.id === taskId) {
                    return {
                        course: {
                            id: hierarchyData.id,
                            name: hierarchyData.name
                        },
                        section: {
                            id: section.id,
                            name: section.name
                        },
                        unit: {
                            id: unit.id,
                            name: unit.name
                        },
                        task: {
                            id: task.id,
                            name: task.name
                        }
                    };
                }
            }
        }
    }
    return null;
}

// Helper function to collect all questions from a resource and its children
function getAllQuestionsFromResource(resource) {
    let questions = [];
    
    if (resource.questions) {
        questions = questions.concat(resource.questions.map(q => ({
            ...q,
            hierarchy: findTaskParents(resource.id)
        })));
    }
    
    if (resource.sections) {
        for (const section of resource.sections) {
            questions = questions.concat(getAllQuestionsFromResource(section));
        }
    }
    
    if (resource.units) {
        for (const unit of resource.units) {
            questions = questions.concat(getAllQuestionsFromResource(unit));
        }
    }
    
    if (resource.tasks) {
        for (const task of resource.tasks) {
            questions = questions.concat(getAllQuestionsFromResource(task));
        }
    }
    
    return questions;
}

// Course endpoints
app.get('/course/:courseId', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
});

// Pick questions from course
app.get('/course/:courseId/pick/:number', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const allQuestions = getAllQuestionsFromResource(course);
    const count = parseInt(req.params.number);
    const selectedQuestions = getRandomItems(allQuestions, count);
    
    res.json(selectedQuestions);
});

// Section endpoints
app.get('/course/:courseId/section/:sectionId', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const section = course.sections.find(s => s.id === parseInt(req.params.sectionId));
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    
    res.json(section);
});

// Pick questions from section
app.get('/course/:courseId/section/:sectionId/pick/:number', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const section = course.sections.find(s => s.id === parseInt(req.params.sectionId));
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    
    const allQuestions = getAllQuestionsFromResource(section);
    const count = parseInt(req.params.number);
    const selectedQuestions = getRandomItems(allQuestions, count);
    
    res.json(selectedQuestions);
});

// Unit endpoints
app.get('/course/:courseId/section/:sectionId/unit/:unitId', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const section = course.sections.find(s => s.id === parseInt(req.params.sectionId));
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    
    const unit = section.units.find(u => u.id === parseInt(req.params.unitId));
    if (!unit) {
        return res.status(404).json({ error: 'Unit not found' });
    }
    
    res.json(unit);
});

// Pick questions from unit
app.get('/course/:courseId/section/:sectionId/unit/:unitId/pick/:number', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const section = course.sections.find(s => s.id === parseInt(req.params.sectionId));
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    
    const unit = section.units.find(u => u.id === parseInt(req.params.unitId));
    if (!unit) {
        return res.status(404).json({ error: 'Unit not found' });
    }
    
    const allQuestions = getAllQuestionsFromResource(unit);
    const count = parseInt(req.params.number);
    const selectedQuestions = getRandomItems(allQuestions, count);
    
    res.json(selectedQuestions);
});

// Task endpoints
app.get('/course/:courseId/section/:sectionId/unit/:unitId/task/:taskId', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const section = course.sections.find(s => s.id === parseInt(req.params.sectionId));
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    
    const unit = section.units.find(u => u.id === parseInt(req.params.unitId));
    if (!unit) {
        return res.status(404).json({ error: 'Unit not found' });
    }
    
    const task = unit.tasks.find(t => t.id === parseInt(req.params.taskId));
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    
    // Add hierarchy information to the task
    const taskWithHierarchy = {
        ...task,
        hierarchy: {
            course: {
                id: course.id,
                name: course.name
            },
            section: {
                id: section.id,
                name: section.name
            },
            unit: {
                id: unit.id,
                name: unit.name
            }
        }
    };
    
    res.json(taskWithHierarchy);
});

// List children endpoints
app.get('/course/:courseId/section', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course.sections);
});

app.get('/course/:courseId/section/:sectionId/unit', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const section = course.sections.find(s => s.id === parseInt(req.params.sectionId));
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    
    res.json(section.units);
});

app.get('/course/:courseId/section/:sectionId/unit/:unitId/task', (req, res) => {
    const course = findResourceById(hierarchyData, parseInt(req.params.courseId));
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    
    const section = course.sections.find(s => s.id === parseInt(req.params.sectionId));
    if (!section) {
        return res.status(404).json({ error: 'Section not found' });
    }
    
    const unit = section.units.find(u => u.id === parseInt(req.params.unitId));
    if (!unit) {
        return res.status(404).json({ error: 'Unit not found' });
    }
    
    res.json(unit.tasks);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 