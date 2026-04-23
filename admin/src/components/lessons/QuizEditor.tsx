import { Quiz } from '../../api/adminApi';

interface Props {
  quiz: Quiz;
  segmentCount: number;
  onChange: (quiz: Quiz) => void;
}

export default function QuizEditor({ quiz, segmentCount, onChange }: Props) {
  const updateOption = (index: number, text: string) => {
    const options = quiz.options.map((o, i) =>
      i === index ? { ...o, optionText: text } : o
    );
    onChange({ ...quiz, options });
  };

  const positionOptions = [
    { value: '', label: 'After all segments (default)' },
    { value: '0', label: 'Before first segment' },
    ...Array.from({ length: segmentCount }, (_, i) => ({
      value: String(i + 1),
      label: `After segment ${i + 1}`,
    })),
  ];

  return (
    <div className="quiz-editor">
      <div className="form-group">
        <label>Position</label>
        <select
          value={quiz.quizPosition != null ? String(quiz.quizPosition) : ''}
          onChange={(e) =>
            onChange({
              ...quiz,
              quizPosition: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        >
          {positionOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

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
        <label>Explanation (correct answer)</label>
        <textarea
          value={quiz.explanation}
          onChange={(e) => onChange({ ...quiz, explanation: e.target.value })}
          placeholder="Shown when the user picks the correct answer"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>Explanation (wrong answer)</label>
        <textarea
          value={quiz.wrongExplanation || ''}
          onChange={(e) => onChange({ ...quiz, wrongExplanation: e.target.value || undefined })}
          placeholder="Shown when the user picks a wrong answer (leave blank to use same explanation)"
          rows={3}
        />
      </div>
    </div>
  );
}
