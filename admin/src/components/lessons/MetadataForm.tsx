import { ModuleSummary } from '../../api/adminApi';

const CONTENT_MODULES = [
  'FOUNDATION', 'EMOTIONS', 'COOPERATION', 'SIBLINGS', 'RELOCATION',
  'DIVORCE', 'DEVELOPMENT', 'PROCRASTINATION', 'PATIENCE', 'RESPONSIBILITY',
  'MEALS', 'AGGRESSION', 'CONFLICT', 'FOCUS', 'DEFIANCE', 'SAFETY',
  'SCREENS', 'SEPARATION', 'SPECIAL',
];

interface Props {
  lesson: {
    module: string;
    dayNumber: number;
    title: string;
    subtitle: string;
    shortDescription: string;
    objectives: string[];
    estimatedMinutes: number;
    teachesCategories: string[];
    backgroundColor: string;
    ellipse77Color: string;
    ellipse78Color: string;
  };
  modules: ModuleSummary[];
  isEditing: boolean;
  onChange: (updates: Record<string, any>) => void;
}

export default function MetadataForm({ lesson, modules, isEditing, onChange }: Props) {
  return (
    <div className="editor-section">
      <h2>Lesson Metadata</h2>

      <div className="form-row">
        <div className="form-group">
          <label>Module</label>
          <select
            value={lesson.module}
            onChange={(e) => onChange({ module: e.target.value })}
            disabled={isEditing}
          >
            {(modules.length > 0 ? modules.map((m) => m.key) : CONTENT_MODULES).map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ maxWidth: 100 }}>
          <label>Day #</label>
          <input
            type="number"
            min={1}
            value={lesson.dayNumber}
            onChange={(e) => onChange({ dayNumber: parseInt(e.target.value) || 1 })}
            disabled={isEditing}
          />
        </div>
        <div className="form-group" style={{ maxWidth: 100 }}>
          <label>Minutes</label>
          <input
            type="number"
            min={1}
            value={lesson.estimatedMinutes}
            onChange={(e) => onChange({ estimatedMinutes: parseInt(e.target.value) || 2 })}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          value={lesson.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Lesson title"
        />
      </div>

      <div className="form-group">
        <label>Subtitle</label>
        <input
          type="text"
          value={lesson.subtitle}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Optional subtitle"
        />
      </div>

      <div className="form-group">
        <label>Short Description</label>
        <textarea
          value={lesson.shortDescription}
          onChange={(e) => onChange({ shortDescription: e.target.value })}
          placeholder="Brief description for lesson cards"
          rows={2}
        />
      </div>

      <div className="form-group">
        <label>Objectives (one per line)</label>
        <textarea
          value={lesson.objectives.join('\n')}
          onChange={(e) =>
            onChange({ objectives: e.target.value.split('\n').filter((s) => s.trim()) })
          }
          placeholder="Learning objectives, one per line"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>Teaches Categories (comma-separated)</label>
        <input
          type="text"
          value={lesson.teachesCategories.join(', ')}
          onChange={(e) =>
            onChange({
              teachesCategories: e.target.value
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean),
            })
          }
          placeholder="e.g. LABELED_PRAISE, REFLECTION"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Background Color</label>
          <div className="color-input">
            <input
              type="color"
              value={lesson.backgroundColor}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
            />
            <input
              type="text"
              value={lesson.backgroundColor}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Ellipse 77 Color</label>
          <div className="color-input">
            <input
              type="color"
              value={lesson.ellipse77Color}
              onChange={(e) => onChange({ ellipse77Color: e.target.value })}
            />
            <input
              type="text"
              value={lesson.ellipse77Color}
              onChange={(e) => onChange({ ellipse77Color: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Ellipse 78 Color</label>
          <div className="color-input">
            <input
              type="color"
              value={lesson.ellipse78Color}
              onChange={(e) => onChange({ ellipse78Color: e.target.value })}
            />
            <input
              type="text"
              value={lesson.ellipse78Color}
              onChange={(e) => onChange({ ellipse78Color: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
