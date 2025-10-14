function renderQuestionEdit(question) {
    const area = document.getElementById('browserListArea');
    if (!area) return;

    let answers = [];
    try {
        answers = typeof question.answers === "string" ? JSON.parse(question.answers) : (question.answers || []);
    } catch {
        answers = question.answers || [];
    }

    const correctIdx = (typeof question.correct_index !== "undefined"
        ? question.correct_index
        : (typeof question.correctIndex !== "undefined" ? question.correctIndex : 0));

    // format numbered question with * before correct answer
    const formattedText = [
        `1. ${question.prompt || question.text || ""}`,
        ...answers.map((ans, idx) =>
            `${(idx === correctIdx) ? "*" : ""}${String.fromCharCode(97 + idx)}) ${ans}`
        )
    ].join("\n");

    area.innerHTML = `
      <div class="question-detail">
        <h3>Question Export / Edit</h3>
        <p style="font-size:0.95em; color:var(--browser-muted); margin-top:-0.2em;">
          Copy the text below, then paste it back into the box to update the question.
        </p>

        <textarea id="editExportText" rows="10" style="width:100%; font-family:monospace; font-size:1em; padding:0.8em; border-radius:8px; border:1px solid var(--browser-border); background:var(--browser-bg); color:var(--browser-text);">${formattedText}</textarea>

        <div class="question-detail-actions" style="margin-top:12px;">
          <button id="saveExportBtn" class="edit-btn">⬆ Paste & Update</button>
          <button id="cancelEditBtn" class="back-btn">Cancel</button>
        </div>
      </div>
    `;

    // Cancel button
    document.getElementById('cancelEditBtn').onclick = () => {
        const tab = document.querySelector('.browser-tab[data-view="questionEdit"]');
        if (tab) tab.remove();
        currentView = "questionDetail";
        renderView(currentView);
    };

    async function updateQuestionOnServer(q) {
        const payload = {
            prompt: q.prompt,
            answers: JSON.stringify(q.answers || []),
            correct_index: (typeof q.correct_index !== 'undefined') ? q.correct_index : null,
            correct_answer: (q.answers && q.answers[q.correct_index]) ? q.answers[q.correct_index] : (q.correctAnswer || q.correct_answer || null),
            ai: q.ai || false
        };

        const resp = await fetch(`/api/questions/${q.uid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `Server responded ${resp.status}`);
        }
        return resp.json();
    }

    function updateLocalAllCourseData(updatedQuestionObj) {
        if (!window.ALL_COURSE_DATA || !Array.isArray(window.ALL_COURSE_DATA.courses)) return;
        const uidToMatch = Number(updatedQuestionObj.uid ?? updatedQuestionObj.id);
        for (const course of window.ALL_COURSE_DATA.courses) {
            for (const section of (course.sections || [])) {
                for (const unit of (section.units || [])) {
                    for (const task of (unit.tasks || [])) {
                        for (let i = 0; i < (task.questions || []).length; i++) {
                            const q = task.questions[i];
                            if (Number(q.uid ?? q.id) === uidToMatch) {
                                // update fields on the found question object
                                try {
                                    task.questions[i].prompt = updatedQuestionObj.prompt ?? task.questions[i].prompt;
                                    task.questions[i].text = updatedQuestionObj.prompt ?? task.questions[i].text;
                                    // answers in DB are stored as JSON string; parse if needed
                                    let parsedAnswers = updatedQuestionObj.answers;
                                    if (typeof parsedAnswers === 'string') {
                                        parsedAnswers = JSON.parse(parsedAnswers);
                                    }
                                    task.questions[i].answers = parsedAnswers;
                                    task.questions[i].correct_index = (typeof updatedQuestionObj.correct_index !== 'undefined') ? updatedQuestionObj.correct_index : task.questions[i].correct_index;
                                    task.questions[i].correct_answer = (typeof updatedQuestionObj.correct_answer !== 'undefined') ? updatedQuestionObj.correct_answer : task.questions[i].correct_answer;
                                } catch (e) {
                                    console.warn('Error updating local question object', e);
                                }
                                return;
                            }
                        }
                    }
                }
            }
        }
    }

    // Save button
    document.getElementById('saveExportBtn').onclick = async () => {
        const text = document.getElementById('editExportText').value.trim();
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

        if (lines.length < 2) {
            alert("Invalid format. Must include question and at least one answer.");
            return;
        }

        // first line: question prompt
        question.prompt = question.text = lines[0].replace(/^1\.\s*/, "");

        // remaining lines: answers
        question.answers = [];
        question.correct_index = 0;

        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            const isCorrect = line.startsWith("*");
            if (isCorrect) line = line.slice(1);
            line = line.replace(/^[a-d]\)\s*/i, "");
            question.answers.push(line);
            if (isCorrect) question.correct_index = i - 1;
        }

        // persist to server
        try {
            const btn = document.getElementById('saveExportBtn');
            const orig = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Saving...";

            const result = await updateQuestionOnServer(question);

            if (result && result.success) {
                // parse returned answers if necessary
                const returned = result.question || result;
                if (typeof returned.answers === 'string') {
                    try { returned.answers = JSON.parse(returned.answers); } catch { /* ignore */ }
                }

                // update questionDetail shown in UI
                questionDetail = Object.assign({}, questionDetail, returned);

                // update local in-memory ALL_COURSE_DATA so lists reflect change
                updateLocalAllCourseData(returned);

                // remove edit tab and show detail
                const tab = document.querySelector('.browser-tab[data-view="questionEdit"]');
                if (tab) tab.remove();
                currentView = "questionDetail";
                renderView(currentView);

            } else {
                throw new Error((result && result.error) || 'Unknown server response');
            }

            btn.disabled = false;
            btn.textContent = orig;
        } catch (err) {
            alert("Failed to save question: " + (err.message || err));
            const btn = document.getElementById('saveExportBtn');
            btn.disabled = false;
            btn.textContent = "⬆ Paste & Update";
        }
    };
}