import { Quiz } from '../../api/adminApi';

interface Props {
  quiz: Quiz;
  onChange: (quiz: Quiz) => void;
}

export default function QuizEditor({ quiz, onChange }: Props) {
  const updateOption = (index: number, text: string) => {
    const options = quiz.options.map((o, i) =>
      i === index ? { ...o, optionText: text } : o
    );
    onChange({ ...quiz, options });
  };

  return (
    <div className="quiz-editor">
      <div className="form-group">
        <label>Question</label>
        <textarea
          value={quiz.question}
          onChange={(e) => onChange({ ...quiz, question: e.target.value })}
          placeholder="Quiz question"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>Options</label>
        {quiz.options.map((opt, i) => (
          <div key={opt.optionLabel} className="quiz-option-row">
            <span
              className={`option-label ${quiz.correctAnswer === opt.optionLabel ? 'correct' : ''}`}
              onClick={() => onChange({ ...quiz, correctAnswer: opt.optionLabel })}
              title="Click to mark as correct answer"
            >
              {opt.optionLabel}
            </span>
            <input
              type="text"
              value={opt.optionText}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${opt.optionLabel}`}
            />
          </div>
        ))}
        <p className="form-hint">Click a letter to mark it as the correct answer. Current: {quiz.correctAnswer}</p>
      </div>

      <div className="form-group">
        <label>Explanation</label>
        <textarea
          value={quiz.explanation}
          onChange={(e) => onChange({ ...quiz, explanation: e.target.value })}
          placeholder="Explanation shown after answering"
          rows={3}
        />
      </div>
    </div>
  );
}
