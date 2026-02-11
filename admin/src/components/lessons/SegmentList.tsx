import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Segment } from '../../api/adminApi';
import SegmentEditor from './SegmentEditor';

interface Props {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  onSelectSegment: (index: number) => void;
  selectedIndex: number;
}

function SortableSegment({
  segment,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  canRemove,
}: {
  segment: Segment;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<Segment>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `seg-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="drag-handle" {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </div>
      <SegmentEditor
        segment={segment}
        index={index}
        isSelected={isSelected}
        onSelect={onSelect}
        onChange={onUpdate}
        onRemove={onRemove}
        canRemove={canRemove}
      />
    </div>
  );
}

export default function SegmentList({ segments, onChange, onSelectSegment, selectedIndex }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(String(active.id).replace('seg-', ''));
    const newIndex = parseInt(String(over.id).replace('seg-', ''));

    const reordered = arrayMove(segments, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order: i + 1,
    }));
    onChange(reordered);

    if (selectedIndex === oldIndex) {
      onSelectSegment(newIndex);
    }
  };

  const addSegment = () => {
    const newSeg: Segment = {
      order: segments.length + 1,
      sectionTitle: '',
      contentType: 'TEXT',
      bodyText: '',
    };
    onChange([...segments, newSeg]);
    onSelectSegment(segments.length);
  };

  const updateSegment = (index: number, updates: Partial<Segment>) => {
    const updated = segments.map((s, i) => (i === index ? { ...s, ...updates } : s));
    onChange(updated);
  };

  const removeSegment = (index: number) => {
    const updated = segments
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order: i + 1 }));
    onChange(updated);
    if (selectedIndex >= updated.length) {
      onSelectSegment(Math.max(0, updated.length - 1));
    }
  };

  return (
    <div className="editor-section">
      <div className="section-header">
        <h2>Segments ({segments.length})</h2>
        <button className="btn-secondary-sm" onClick={addSegment}>
          + Add Segment
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={segments.map((_, i) => `seg-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          {segments.map((seg, i) => (
            <SortableSegment
              key={`seg-${i}`}
              segment={seg}
              index={i}
              isSelected={i === selectedIndex}
              onSelect={() => onSelectSegment(i)}
              onUpdate={(updates) => updateSegment(i, updates)}
              onRemove={() => removeSegment(i)}
              canRemove={segments.length > 1}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
