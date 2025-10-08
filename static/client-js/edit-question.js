function renderQuestionDetail(question) {
    const area = document.getElementById('browserListArea');
    area.classList.add('question-detail-mode');

    let answers = [];
    try {
        answers = typeof question.answers === "string" ? JSON.parse(question.answers) : question.answers;
    } catch {
        answers = question.answers || [];
    }

    let correctIdx = (typeof question.correct_index !== "undefined" ? question.correct_index : question.correctIndex);
    let correctAns = question.correctAnswer || question.correct_answer;

    area.innerHTML = `
      <div class="question-detail">
        <h3>${question.prompt || question.text}</h3>
        <div class="question-meta">
          <p><strong>AI Generated:</strong> ${question.ai ? "Yes" : "No"}</p>
          <p><strong>Course:</strong> ${question.parentCourse?.name || "Unknown"}</p>
          <p><strong>Section:</strong> ${question.parentSection?.name || "Unknown"}</p>
          <p><strong>Unit:</strong> ${question.parentUnit?.name || "Unknown"}</p>
          <p><strong>Task:</strong> ${question.parentTask?.name || "Unknown"}</p>
        </div>
        <div class="answer-list">
          <strong>Choices:</strong>
          <ul>
            ${answers.map((ans, idx) =>
        `<li class="${(correctIdx === idx || ans === correctAns) ? 'correct-answer' : ''}">
                    ${ans}${(correctIdx === idx || ans === correctAns) ? " <b>(Correct)</b>" : ""}
                </li>`
    ).join("")}
          </ul>
        </div>
        <div class="question-detail-actions">
          <button id="questionDetailEditBtn" class="edit-btn">✎ Edit</button>
          <button id="questionDetailBackBtn" class="back-btn">← Back</button>
        </div>
      </div>
    `;

    // ✅ Back button
    document.getElementById('questionDetailBackBtn').onclick = () => {
        questionDetail = null;
        area.classList.remove('question-detail-mode');
        currentView = "questions";
        renderView(currentView);
    };

    // ✅ Edit button
    document.getElementById('questionDetailEditBtn').onclick = () => {
        renderQuestionEditForm(question); // use the new inline edit form below
    };
}

function renderQuestionEditForm(question) {
    const area = document.getElementById('browserListArea');
    area.innerHTML = `
      <div class="question-detail">
        <h3>Edit Question</h3>
        <label>Prompt:</label>
        <textarea id="editPrompt" rows="3">${question.prompt || question.text || ""}</textarea>

        <label>Answers (comma-separated):</label>
        <input type="text" id="editAnswers" value="${(question.answers || []).join(", ")}">

        <label>Correct Answer Index:</label>
        <input type="number" id="editCorrectIndex" value="${question.correct_index ?? question.correctIndex ?? 0}" min="0">

        <div class="question-detail-actions">
          <button id="saveQuestionBtn" class="edit-btn">💾 Save</button>
          <button id="cancelEditBtn" class="back-btn">Cancel</button>
        </div>
      </div>
    `;

    document.getElementById('cancelEditBtn').onclick = () => renderQuestionDetail(question);

    document.getElementById('saveQuestionBtn').onclick = () => {
        question.prompt = document.getElementById('editPrompt').value.trim();
        question.answers = document.getElementById('editAnswers').value.split(',').map(a => a.trim());
        question.correct_index = parseInt(document.getElementById('editCorrectIndex').value);

        // Re-render detail view after saving
        renderQuestionDetail(question);
    };
}
