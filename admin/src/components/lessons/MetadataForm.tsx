import { useRef, useState } from 'react';
import { ModuleSummary, uploadLessonImage } from '../../api/adminApi';

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
    dragonImageUrl: string;
    backgroundColor: string;
    ellipse77Color: string;
    ellipse78Color: string;
  };
  lessonId?: string;
  modules: ModuleSummary[];
  isEditing: boolean;
  onChange: (updates: Record<string, any>) => void;
}

export default function MetadataForm({ lesson, lessonId, modules, isEditing, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lessonId) return;

    setLocalPreview(URL.createObjectURL(file));
    setUploadError(null);
    setUploading(true);
    try {
      const { dragonImageUrl } = await uploadLessonImage(lessonId, file);
      onChange({ dragonImageUrl });
      setLocalPreview(null);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
      setLocalPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const previewSrc = localPreview || lesson.dragonImageUrl || null;

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

      {/* Lesson image */}
      <div className="form-group">
        <label>Lesson Image</label>
        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {previewSrc && (
              <img
                src={previewSrc}
                alt="Lesson"
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0 }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : previewSrc ? 'Replace Image' : 'Upload Image'}
              </button>
              {lesson.dragonImageUrl && !uploading && (
                <button
                  type="button"
                  className="btn-danger-sm"
                  onClick={() => onChange({ dragonImageUrl: '' })}
                >
                  Remove
                </button>
              )}
              {uploadError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{uploadError}</p>}
              {lesson.dragonImageUrl && (
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, wordBreak: 'break-all', maxWidth: 280 }}>
                  {lesson.dragonImageUrl}
                </p>
              )}
            </div>
          </div>
        ) : (
          <input
            type="text"
            value={lesson.dragonImageUrl}
            onChange={(e) => onChange({ dragonImageUrl: e.target.value })}
            placeholder="Image URL (available after saving)"
          />
        )}
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
