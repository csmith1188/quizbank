const axios = require('axios');
const { get, all, run } = require('./db');

const AUTH_URL = process.env.AUTH_URL;
const API_KEY = process.env.API_KEY;

function getFormbarApiBase() {
    if (!AUTH_URL) return null;
    const trimmed = AUTH_URL.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : trimmed + '/api';
}

async function fetchClassesForUser(formbarId) {
    const base = getFormbarApiBase();
    if (!base || !API_KEY || !formbarId) return [];
    try {
        const headers = {
            API: API_KEY,
            'Content-Type': 'application/json'
        };

        // Classes the user owns (teacher)
        const ownedRes = await axios.get(`${base}/user/${formbarId}/ownedClasses`, { headers });
        const ownedClasses = Array.isArray(ownedRes.data) ? ownedRes.data : (ownedRes.data.classes || []);

        // Active class (could be student or teacher)
        let activeClass = null;
        try {
            const activeRes = await axios.get(`${base}/user/${formbarId}/class`, { headers });
            activeClass = activeRes.data && activeRes.data.id ? activeRes.data : null;
        } catch (e) {
            // 404 or similar just means no active class; ignore
            activeClass = null;
        }

        const result = [];

        (ownedClasses || []).forEach(c => {
            result.push({
                id: c.id,
                name: c.className || c.name || 'Class',
                role: 'teacher'
            });
        });

        if (activeClass) {
            const exists = result.some(c => c.id === activeClass.id);
            if (!exists) {
                result.push({
                    id: activeClass.id,
                    name: activeClass.className || activeClass.name || 'Class',
                    role: 'student'
                });
            }
        }

        return result;
    } catch (err) {
        console.error('Error fetching classes from Formbar:', err.message);
        return [];
    }
}

async function syncClassesForUser(userId, formbarId) {
    if (!formbarId) return { classes: [] };
    const classes = await fetchClassesForUser(formbarId);
    const resultClasses = [];

    for (const c of classes) {
        const formbarClassId = c.id;
        const name = c.name || c.className || 'Class';
        let row = await get('SELECT id, name FROM classes WHERE formbar_class_id = ?', [formbarClassId]);
        if (!row) {
            await run('INSERT INTO classes (formbar_class_id, name) VALUES (?, ?)', [formbarClassId, name]);
            row = await get('SELECT id, name FROM classes WHERE formbar_class_id = ?', [formbarClassId]);
        }
        if (!row) continue;

        const memberRole = c.role || (c.isTeacher ? 'teacher' : 'student') || 'student';
        await run(
            'INSERT OR REPLACE INTO class_members (class_id, user_id, role) VALUES (?, ?, ?)',
            [row.id, userId, memberRole]
        );

        resultClasses.push({ id: row.id, name: row.name, formbar_class_id: formbarClassId, role: memberRole });
    }

    return { classes: resultClasses };
}

module.exports = {
    fetchClassesForUser,
    syncClassesForUser
};

