import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLesson, getModules, createLesson, updateLesson, ModuleSummary, Segment, Quiz } from '../api/adminApi';
import MetadataForm from '../components/lessons/MetadataForm';
import SegmentList from '../components/lessons/SegmentList';
import QuizEditor from '../components/lessons/QuizEditor';
import LessonPreview from '../components/preview/LessonPreview';

interface LessonFormData {
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
}

const DEFAULT_LESSON: LessonFormData = {
  module: 'FOUNDATION',
  dayNumber: 1,
  title: '',
  subtitle: '',
  shortDescription: '',
  objectives: [],
  estimatedMinutes: 2,
  teachesCategories: [],
  dragonImageUrl: '',
  backgroundColor: '#E4E4FF',
  ellipse77Color: '#9BD4DF',
  ellipse78Color: '#A6E0CB',
};

const DEFAULT_SEGMENT: Segment = {
  order: 1,
  sectionTitle: '',
  contentType: 'TEXT',
  bodyText: '',
};

const DEFAULT_QUIZ: Quiz = {
  question: '',
  correctAnswer: 'A',
  explanation: '',
  options: [
    { optionLabel: 'A', optionText: '', order: 1 },
    { optionLabel: 'B', optionText: '', order: 2 },
    { optionLabel: 'C', optionText: '', order: 3 },
    { optionLabel: 'D', optionText: '', order: 4 },
  ],
};

export default function LessonEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [lesson, setLesson] = useState<LessonFormData>(DEFAULT_LESSON);
  const [segments, setSegments] = useState<Segment[]>([{ ...DEFAULT_SEGMENT }]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [previewSegmentIndex, setPreviewSegmentIndex] = useState(0);

  // Debounced preview state
  const [previewData, setPreviewData] = useState({ lesson, segments });
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    getModules().then(setModules).catch(console.error);
  }, []);

  useEffect(() => {
    if (id) {
      setLoading(true);
      getLesson(id)
        .then((data) => {
          setLesson({
            module: data.module,
            dayNumber: data.dayNumber,
            title: data.title,
            subtitle: data.subtitle || '',
            shortDescription: data.shortDescription,
            objectives: data.objectives || [],
            estimatedMinutes: data.estimatedMinutes,
            teachesCategories: data.teachesCategories || [],
            dragonImageUrl: data.dragonImageUrl || '',
            backgroundColor: data.backgroundColor,
            ellipse77Color: data.ellipse77Color,
            ellipse78Color: data.ellipse78Color,
          });
          setSegments(
            data.segments.length > 0
              ? data.segments.map((s) => ({
                  order: s.order,
                  sectionTitle: s.sectionTitle || '',
                  contentType: s.contentType,
                  bodyText: s.bodyText,
                  imageUrl: s.imageUrl,
                  iconType: s.iconType,
                  aiCheckMode: s.aiCheckMode,
                  idealAnswer: s.idealAnswer,
                }))
              : [{ ...DEFAULT_SEGMENT }]
          );
          setQuiz(data.quiz);
        })
        .catch((err) => {
          alert('Failed to load lesson: ' + err.message);
          navigate('/lessons');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Debounced preview updates
  const updatePreview = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPreviewData({ lesson: { ...lesson }, segments: [...segments] });
    }, 300);
  }, [lesson, segments]);

  useEffect(() => {
    updatePreview();
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [lesson, segments, updatePreview]);

  const handleSave = async () => {
    if (!lesson.title.trim()) {
      alert('Title is required');
      return;
    }
    if (segments.length === 0) {
      alert('At least one segment is required');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateLesson(id!, lesson, segments, quiz);
      } else {
        await createLesson(lesson, segments, quiz);
      }
      navigate('/lessons');
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page"><div className="loading-state">Loading lesson...</div></div>;
  }

  return (
    <div className="page editor-page">
      <div className="page-header">
        <div>
          <h1>{isEditing ? 'Edit Lesson' : 'New Lesson'}</h1>
          {isEditing && <p className="page-subtitle">ID: {id}</p>}
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/lessons')}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Lesson'}
          </button>
        </div>
      </div>

      <div className="editor-split">
        <div className="editor-form">
          <MetadataForm
            lesson={lesson}
            modules={modules}
            isEditing={isEditing}
            onChange={(updates) => setLesson((prev) => ({ ...prev, ...updates }))}
          />

          <SegmentList
            segments={segments}
            onChange={setSegments}
            onSelectSegment={setPreviewSegmentIndex}
            selectedIndex={previewSegmentIndex}
          />

          <div className="editor-section">
            <div className="section-header">
              <h2>Quiz</h2>
              {!quiz ? (
                <button className="btn-secondary-sm" onClick={() => setQuiz({ ...DEFAULT_QUIZ })}>
                  + Add Quiz
                </button>
              ) : (
                <button className="btn-danger-sm" onClick={() => setQuiz(null)}>
                  Remove Quiz
                </button>
              )}
            </div>
            {quiz && <QuizEditor quiz={quiz} onChange={setQuiz} />}
          </div>
        </div>

        <div className="editor-preview">
          <div className="preview-header">
            <span>Preview</span>
            <div className="preview-nav">
              <button
                className="btn-icon"
                disabled={previewSegmentIndex === 0}
                onClick={() => setPreviewSegmentIndex((i) => i - 1)}
              >
                &larr;
              </button>
              <span>{previewSegmentIndex + 1} / {segments.length}</span>
              <button
                className="btn-icon"
                disabled={previewSegmentIndex >= segments.length - 1}
                onClick={() => setPreviewSegmentIndex((i) => i + 1)}
              >
                &rarr;
              </button>
            </div>
          </div>
          <LessonPreview
            lesson={previewData.lesson}
            segments={previewData.segments}
            currentSegmentIndex={previewSegmentIndex}
          />
        </div>
      </div>
    </div>
  );
}
