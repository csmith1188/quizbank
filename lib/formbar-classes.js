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

        // Primary endpoint: all classes the user belongs to (owner or student).
        const allClassesRes = await axios.get(`${base}/user/${formbarId}/classes`, { headers });
        const allClasses = normalizeClassArray(allClassesRes.data);

        const result = [];

        (allClasses || []).forEach(c => {
            if (!c || c.id == null) return;
            const exists = result.some(existing => existing.id === c.id);
            if (!exists) {
                const isTeacher = c.isOwner === true || Number(c.owner) === Number(formbarId) || Number(c.permissions) >= 4;
                result.push({
                    id: c.id,
                    name: c.className || c.name || 'Class',
                    role: isTeacher ? 'teacher' : 'student'
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
    const syncedClassIds = [];

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

        syncedClassIds.push(row.id);
        resultClasses.push({ id: row.id, name: row.name, formbar_class_id: formbarClassId, role: memberRole });
    }

    // Reconcile local membership to the source of truth from Formbar.
    if (syncedClassIds.length) {
        const placeholders = syncedClassIds.map(() => '?').join(',');
        await run(
            `DELETE FROM class_members
             WHERE user_id = ?
               AND class_id IN (SELECT id FROM classes)
               AND class_id NOT IN (${placeholders})`,
            [userId, ...syncedClassIds]
        );
    } else {
        await run('DELETE FROM class_members WHERE user_id = ? AND class_id IN (SELECT id FROM classes)', [userId]);
    }

    return { classes: resultClasses };
}

module.exports = {
    fetchClassesForUser,
    syncClassesForUser
};

