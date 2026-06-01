const fs = require('fs');
const JSDOM = require('jsdom').JSDOM;

const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
    <div id="agent-insights-display"></div>
</body>
</html>
`, { runScripts: "dangerously" });

const window = dom.window;
const document = window.document;

const agentInsightsDisplay = document.getElementById('agent-insights-display');
const uniqueIdBase = Date.now().toString(36) + Math.random().toString(36).substr(2);
const actionId = `${uniqueIdBase}-0`;
const quiz = { question: "Q1", options: ["A", "B", "C"], correctAnswer: "B" };
let optionsHtml = '';
quiz.options.forEach((opt, idx) => {
    const optId = `quiz-${actionId}-opt-${idx}`;
    optionsHtml += `
        <div style="margin: 4px 0;">
            <input type="radio" id="${optId}" name="quiz-${actionId}" value="${opt}">
            <label for="${optId}" style="cursor: pointer;">${opt}</label>
        </div>
    `;
});
const insightsHtml = `
    <div style="margin-bottom: 16px; padding: 12px; background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: #333;">
        <h4 style="margin: 0 0 8px 0; color: #8a2be2;">📝 Pop Quiz</h4>
        <p style="margin: 0 0 8px 0; font-weight: 500;">${quiz.question}</p>
        ${optionsHtml}
        <div class="quiz-feedback" id="feedback-${actionId}" style="margin-top: 8px; font-weight: 500; display: none;"></div>
        <button class="quiz-submit-btn" data-quiz-id="${actionId}" data-correct-answer="${quiz.correctAnswer}" style="margin-top: 8px; padding: 6px 12px; font-size: 0.9em; background: #8a2be2; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Submit Answer</button>
    </div>
`;
agentInsightsDisplay.insertAdjacentHTML('afterbegin', insightsHtml);

document.addEventListener('click', function(ev) {
    var tgt = ev && ev.target ? ev.target : null;
    if (tgt && tgt.classList && tgt.classList.contains('quiz-submit-btn')) {
        const quizId = tgt.getAttribute('data-quiz-id');
        const correctAnswer = tgt.getAttribute('data-correct-answer');
        const selectedInput = document.querySelector(`input[name="quiz-${quizId}"]:checked`);
        const feedbackDiv = document.getElementById(`feedback-${quizId}`);
        console.log('Quiz', quizId, 'Selected', selectedInput ? selectedInput.value : 'none');
        if (feedbackDiv) {
            feedbackDiv.style.display = 'block';
            if (!selectedInput) {
                feedbackDiv.style.color = '#ff9800';
                feedbackDiv.innerHTML = 'Please select an answer first!';
                console.log('Feedback: Please select');
            } else if (selectedInput.value === correctAnswer) {
                feedbackDiv.style.color = '#4caf50';
                feedbackDiv.innerHTML = '✅ Correct!';
                console.log('Feedback: Correct');
            } else {
                feedbackDiv.style.color = '#f44336';
                feedbackDiv.innerHTML = `❌ Incorrect. The right answer was: ${correctAnswer}`;
                console.log('Feedback: Incorrect');
            }
        }
    }
});

// Simulate click on option B
const radio = document.getElementById(`quiz-${actionId}-opt-1`);
radio.checked = true;

// Simulate click on button
const btn = document.querySelector('.quiz-submit-btn');
const event = new window.MouseEvent('click', { bubbles: true });
btn.dispatchEvent(event);

