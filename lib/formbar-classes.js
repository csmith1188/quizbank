const axios = require('axios');
const { get, run } = require('./db');

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

        const normalizeClassArray = (payload) => {
            if (Array.isArray(payload)) return payload;
            if (!payload || typeof payload !== 'object') return [];
            const candidates = [
                payload.classes,
                payload.classrooms,
                payload.data
            ];
            for (const candidate of candidates) {
                if (Array.isArray(candidate)) return candidate;
            }
            return [];
        };

        // Classes the user owns (teacher)
        const ownedRes = await axios.get(`${base}/user/${formbarId}/ownedClasses`, { headers });
        const ownedClasses = normalizeClassArray(ownedRes.data);

        // Classes the user is enrolled in (student). Try several endpoint shapes for compatibility.
        const studentCandidates = [
            `/user/${formbarId}/classes`,
            `/user/${formbarId}/enrolledClasses`,
            `/user/${formbarId}/classrooms`
        ];
        let studentClasses = [];
        for (const path of studentCandidates) {
            try {
                const res = await axios.get(`${base}${path}`, { headers });
                const parsed = normalizeClassArray(res.data);
                if (parsed.length) {
                    studentClasses = parsed;
                    break;
                }
            } catch (e) {
                // Continue through fallback endpoints.
            }
        }

        // Legacy fallback: /user/{id}/class returns one active class only.
        // In some deployments this can be inaccurate, so verify membership before trusting it.
        if (!studentClasses.length) {
            try {
                const activeRes = await axios.get(`${base}/user/${formbarId}/class`, { headers });
                const activeClass = activeRes.data && activeRes.data.id ? activeRes.data : null;
                if (activeClass && activeClass.id != null) {
                    try {
                        const studentsRes = await axios.get(`${base}/class/${activeClass.id}/students`, { headers });
                        const studentsPayload = studentsRes.data;
                        let students = [];
                        if (Array.isArray(studentsPayload)) {
                            students = studentsPayload;
                        } else if (studentsPayload && Array.isArray(studentsPayload.students)) {
                            students = studentsPayload.students;
                        } else if (studentsPayload && typeof studentsPayload.students === 'object') {
                            students = Object.values(studentsPayload.students || {});
                        }
                        const isMember = students.some(s => {
                            const sid = s && (s.id != null ? s.id : s.studentId);
                            return Number(sid) === Number(formbarId);
                        });
                        if (isMember) {
                            studentClasses = [activeClass];
                        }
                    } catch (e) {
                        // If we cannot verify membership for active class, do not trust it.
                    }
                }
            } catch (e) {
                // No active class available for this user.
            }
        }

        const result = [];

        (ownedClasses || []).forEach(c => {
            result.push({
                id: c.id,
                name: c.className || c.name || 'Class',
                role: 'teacher'
            });
        });

        (studentClasses || []).forEach(c => {
            if (!c || c.id == null) return;
            const exists = result.some(existing => existing.id === c.id);
            if (!exists) {
                result.push({
                    id: c.id,
                    name: c.className || c.name || 'Class',
                    role: 'student'
                });
            }
        });

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

