const { get, all, run } = require('./db');

async function getTasksWithMastery(userId, courseId) {
    const units = await all(
        'SELECT id, name, sort_order FROM units WHERE course_id = ? ORDER BY sort_order, id',
        [courseId]
    );
    const unitIds = units.map(u => u.id);
    if (!unitIds.length) return [];

    const placeholders = unitIds.map(() => '?').join(',');
    const tasks = await all(
        `SELECT t.id, t.name, t.sort_order, ut.unit_id
         FROM tasks t
         JOIN unit_tasks ut ON ut.task_id = t.id
         WHERE ut.unit_id IN (${placeholders})
         ORDER BY ut.unit_id, t.sort_order, t.id`,
        unitIds
    );

    if (!tasks.length) return [];

    const taskIds = tasks.map(t => t.id);
    const tmPlaceholders = taskIds.map(() => '?').join(',');
    const masteryRows = await all(
        `SELECT task_id, mastery
         FROM task_mastery
         WHERE user_id = ? AND course_id = ? AND task_id IN (${tmPlaceholders})`,
        [userId, courseId, ...taskIds]
    );
    const masteryByTask = {};
    masteryRows.forEach(r => {
        masteryByTask[r.task_id] = r.mastery;
    });

    return tasks.map(t => ({
        id: t.id,
        name: t.name,
        unitId: t.unit_id,
        taskSortOrder: t.sort_order,
        mastery: masteryByTask[t.id] != null ? masteryByTask[t.id] : 0
    }));
}

async function pickProgressQuestions(userId, courseId, count) {
    const desiredCount = count || 20;
    const tasks = await getTasksWithMastery(userId, courseId);
    if (!tasks.length) return [];

    // Group tasks by unit in order
    const unitsMap = new Map();
    for (const t of tasks) {
        if (!unitsMap.has(t.unitId)) {
            unitsMap.set(t.unitId, []);
        }
        unitsMap.get(t.unitId).push(t);
    }
    // Sort units by id (getTasksWithMastery already respects unit sort_order)
    const orderedUnitIds = Array.from(unitsMap.keys()).sort((a, b) => a - b);

    // Special case: if all tasks across all units have mastery 0,
    // use only the first task in the first unit.
    const allZeroMastery = tasks.every(t => !t.mastery || t.mastery === 0);
    let eligibleTasks = [];

    if (allZeroMastery) {
        if (!orderedUnitIds.length) return [];
        const firstUnitId = orderedUnitIds[0];
        const unitTasks = (unitsMap.get(firstUnitId) || []).slice().sort((a, b) => {
            const sa = (a.taskSortOrder != null ? a.taskSortOrder : 0);
            const sb = (b.taskSortOrder != null ? b.taskSortOrder : 0);
            return sa - sb || a.id - b.id;
        });
        if (!unitTasks.length) return [];
        eligibleTasks = [unitTasks[0]];
    } else {
        // Find the frontier unit: first unit where not all tasks have mastery >= 0.9
        let frontierUnitId = null;
        for (const uid of orderedUnitIds) {
            const unitTasks = unitsMap.get(uid) || [];
            if (!unitTasks.length) continue;
            const allHigh = unitTasks.every(t => (t.mastery || 0) >= 0.9);
            if (!allHigh) {
                frontierUnitId = uid;
                break;
            }
        }

        // If all units are fully mastered (>= 0.9 for all tasks), pick from the last unit
        if (frontierUnitId == null) {
            if (!orderedUnitIds.length) return [];
            frontierUnitId = orderedUnitIds[orderedUnitIds.length - 1];
        }

        const unitTasks = (unitsMap.get(frontierUnitId) || []).slice().sort((a, b) => {
            const sa = (a.taskSortOrder != null ? a.taskSortOrder : 0);
            const sb = (b.taskSortOrder != null ? b.taskSortOrder : 0);
            return sa - sb || a.id - b.id;
        });
        if (!unitTasks.length) return [];

        // Apply task gating within the unit
        const gatedTasks = [];
        for (let i = 0; i < unitTasks.length; i++) {
            const t = unitTasks[i];
            const m = t.mastery || 0;
            // Skip tasks at 100% mastery
            if (m >= 1) continue;
            // If this is not the first task and previous task is below 0.5 mastery, skip this and subsequent tasks
            if (i > 0) {
                const prevM = unitTasks[i - 1].mastery || 0;
                if (prevM < 0.5) {
                    break;
                }
            }
            gatedTasks.push(t);
        }

        if (!gatedTasks.length) return [];
        eligibleTasks = gatedTasks;
    }

    // Weight tasks by (1 - mastery)
    const weights = [];
    let totalWeight = 0;
    eligibleTasks.forEach((t, idx) => {
        const m = t.mastery || 0;
        let w = 1 - m;
        if (w < 0) w = 0;
        weights[idx] = w;
        totalWeight += w;
    });

    if (totalWeight === 0) {
        // All tasks fully mastered; allow equal weighting as a simple review strategy
        weights.fill(1);
        totalWeight = weights.length;
    }

    // Ideal real-valued allocation
    const idealCounts = [];
    const baseCounts = [];
    const remainders = [];
    let allocated = 0;
    for (let i = 0; i < eligibleTasks.length; i++) {
        const ideal = (desiredCount * weights[i]) / totalWeight;
        const base = Math.floor(ideal);
        idealCounts[i] = ideal;
        baseCounts[i] = base;
        remainders[i] = ideal - base;
        allocated += base;
    }

    // Distribute remaining questions using largest remainder
    let remaining = desiredCount - allocated;
    while (remaining > 0) {
        let bestIdx = -1;
        let bestRem = -1;
        for (let i = 0; i < remainders.length; i++) {
            if (remainders[i] > bestRem) {
                bestRem = remainders[i];
                bestIdx = i;
            }
        }
        if (bestIdx === -1 || bestRem <= 0) break;
        baseCounts[bestIdx] += 1;
        remainders[bestIdx] = 0;
        remaining -= 1;
    }

    // Fetch and sample questions per task
    const pickedQuestionIds = [];
    for (let i = 0; i < eligibleTasks.length; i++) {
        const t = eligibleTasks[i];
        const needed = baseCounts[i];
        if (needed <= 0) continue;
        const qs = await all(
            'SELECT id FROM questions WHERE task_id = ? ORDER BY id',
            [t.id]
        );
        if (!qs.length) continue;

        const pool = qs.slice();
        // If not enough questions, take all
        if (pool.length <= needed) {
            pickedQuestionIds.push(...pool.map(q => q.id));
        } else {
            // Randomly sample without replacement
            for (let k = 0; k < needed; k++) {
                const idx = Math.floor(Math.random() * pool.length);
                pickedQuestionIds.push(pool[idx].id);
                pool.splice(idx, 1);
            }
        }
    }

    // Shuffle questions so they are not grouped strictly by task order
    for (let i = pickedQuestionIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pickedQuestionIds[i], pickedQuestionIds[j]] = [pickedQuestionIds[j], pickedQuestionIds[i]];
    }

    return pickedQuestionIds.slice(0, desiredCount);
}

async function createProgressAttempt(userId, classId, courseId) {
    const questionIds = await pickProgressQuestions(userId, courseId, 10);
    if (!questionIds.length) {
        throw new Error('No questions available for progress test');
    }

    await run(
        'INSERT INTO quiz_attempts (user_id, class_id, quiz_id, total_questions, correct_questions, score, is_progress_quiz, metadata) VALUES (?, ?, ?, ?, 0, 0, 1, ?)',
        [userId, classId, 0, questionIds.length, JSON.stringify({ type: 'progress', courseId })]
    );
    const attempt = await get(
        'SELECT * FROM quiz_attempts WHERE user_id = ? AND class_id = ? AND is_progress_quiz = 1 ORDER BY id DESC LIMIT 1',
        [userId, classId]
    );
    if (!attempt) {
        throw new Error('Failed to create progress attempt');
    }

    for (const qid of questionIds) {
        const q = await get('SELECT id, task_id FROM questions WHERE id = ?', [qid]);
        if (!q) continue;
        let unitId = null;
        if (q.task_id != null) {
            const ut = await get(
                'SELECT unit_id FROM unit_tasks WHERE task_id = ? ORDER BY sort_order LIMIT 1',
                [q.task_id]
            );
            unitId = ut ? ut.unit_id : null;
        }
        await run(
            'INSERT INTO quiz_attempt_answers (attempt_id, question_id, task_id, unit_id) VALUES (?, ?, ?, ?)',
            [attempt.id, q.id, q.task_id || null, unitId]
        );
    }

    return attempt;
}

module.exports = {
    getTasksWithMastery,
    pickProgressQuestions,
    createProgressAttempt
};

