import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { handleBoldShortcut, insertTextareaMarker } from '../utils/textFormatting';
import {
  getHomeCards,
  createHomeCard,
  updateHomeCard,
  deleteHomeCard,
  uploadHomeCardImage,
  removeHomeCardImage,
  getHomeCardBadges,
  createHomeCardBadge,
  uploadHomeCardComponentImage,
  HomeCard,
  HomeCardInput,
  HomeCardType,
  HomeCardFontSize,
  HomeCardGender,
  HomeCardBadge,
  HomeCardComponent,
  HomeCardComponentType,
  HomeCardComponentInput,
} from '../api/adminApi';

const BADGE_COLOR_PRESETS = [
  { label: 'Purple', value: '#8C49D5' },
  { label: 'Green', value: '#10B981' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Pink', value: '#EC4899' },
];

// Target-tag pickers for HomeCard.targetTags — the exact vocabularies
// User.issue/User.parentGoal are written in (see the onboarding pickers in
// nora-mobile's ChildIssueScreen.tsx/ParentGoalScreen.tsx) plus the derived
// ClinicalLevel enum (Child.primaryIssue/secondaryIssue). Legacy issue values
// (behavior_challenges, big_emotions, etc.) are intentionally left off this
// picker — still valid to match against for existing users, just not offered
// for new tagging. See homeCardScore in server/routes/config.cjs for how
// these drive ranking.
const ISSUE_TAG_OPTIONS = [
  { value: 'big_feelings_tantrums', label: 'Big feelings / tantrums' },
  { value: 'listening_cooperation', label: 'Listening & cooperation' },
  { value: 'social', label: 'Social' },
  { value: 'attention_focus', label: 'Attention & focus' },
  { value: 'parenting_strategies', label: 'Parenting strategies' },
  { value: 'adhd', label: 'ADHD' },
  { value: 'anxiety_confidence', label: 'Anxiety / confidence' },
  { value: 'developmental_concerns', label: 'Developmental concerns' },
  { value: 'other', label: 'Other' },
];
const PARENT_GOAL_TAG_OPTIONS = [
  { value: 'truly_understanding_kid', label: 'Truly understanding kid' },
  { value: 'boost_kid_development', label: 'Boost kid development' },
  { value: 'feeling_more_connected', label: 'Feeling more connected' },
  { value: 'feeling_less_overwhelmed', label: 'Feeling less overwhelmed' },
  { value: 'less_chaos_day_to_day', label: 'Less chaos day-to-day' },
  { value: 'respond_calmly', label: 'Respond calmly' },
  { value: 'confident_in_parenting', label: 'Confident in parenting' },
];
const CLINICAL_LEVEL_TAG_OPTIONS = [
  { value: 'STABILIZE', label: 'Stabilize' },
  { value: 'DE_ESCALATE', label: 'De-escalate' },
  { value: 'DIRECT', label: 'Direct' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'FLOURISH', label: 'Flourish' },
];
const GENDER_TAG_OPTIONS: { value: HomeCardGender | ''; label: string }[] = [
  { value: '', label: 'Any' },
  { value: 'BOY', label: 'Boy' },
  { value: 'GIRL', label: 'Girl' },
  { value: 'OTHER', label: 'Other' },
];

// Mirrors SubActionCard's FONT_SIZE_MAP in HomeScreen_v2.tsx — keep in sync
// so this preview matches what actually renders on mobile.
const FONT_SIZE_OPTIONS: { label: string; value: HomeCardFontSize; px: number }[] = [
  { label: 'Small', value: 'SMALL', px: 13 },
  { label: 'Medium', value: 'MEDIUM', px: 15 },
  { label: 'Large', value: 'LARGE', px: 18 },
];

// Mirrors SUB_ACTION_CARD_ICONS in HomeScreen_v2.tsx, keyed by exact badge
// name — served from admin/public/subaction-icons (copies of the same files
// under nora-mobile/assets/images/SubActionCard_icon). A badge with no
// matching icon shows none, same as mobile.
const SUB_ACTION_CARD_ICON_URLS: Record<string, string> = {
  'Science Bite': '/subaction-icons/science_bite.png',
  'Try This Today': '/subaction-icons/try_this_today.png',
  'Quick Reflection': '/subaction-icons/quick_reflection.png',
  "Today's Thought": '/subaction-icons/today_thought.png',
  'Community Wisdom': '/subaction-icons/community_wisdom.png',
};

// Select text and click Bold (or Ctrl/Cmd+B) to wrap it in **...** — same
// markdown-lite convention as the lesson/demo-video editors, parsed by
// formatLessonContentV2 on mobile. `getTextarea` (rather than a single
// RefObject) lets one toolbar component serve a dynamic list of textareas
// (the component builder's Text blocks), each keyed by its own ref.
function FormattingToolbar({ getTextarea, onChange }: { getTextarea: () => HTMLTextAreaElement | null; onChange: (value: string) => void }) {
  const applyBold = () => {
    const ta = getTextarea();
    if (!ta) return;
    insertTextareaMarker(ta, onChange, { before: '**', after: '**' });
  };
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
      <button type="button" className="btn-secondary-sm" onClick={applyBold}>Bold</button>
    </div>
  );
}

// Lightweight **bold**/*italic* preview for the single-line Message field —
// mirrors InlineMessageText in HomeScreen_v2.tsx closely enough for a WYSIWYG
// preview without pulling in the full block parser for one line of text.
function renderInlineFormatted(text: string): React.ReactNode {
  return text.split(/(\*\*.+?\*\*|\*.+?\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// Mixes a hex color toward white — mirrors lightenHexColor in
// HomeScreen_v2.tsx so this preview's card/badge-pill tints match mobile.
function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const bigint = parseInt(full, 16);
  if (Number.isNaN(bigint)) return hex;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// Mirrors splitMessageBlocks in HomeScreen_v2.tsx: the first line break
// splits the CONTENT card's message into a bold headline and a lighter
// description — one Enter press after the headline is enough.
function splitPreviewMessage(message: string): { headline: string; description: string } {
  const idx = message.indexOf('\n');
  if (idx === -1) return { headline: message, description: '' };
  return { headline: message.slice(0, idx).trim(), description: message.slice(idx + 1).trim() };
}

// Simplified mirror of formatLessonContentV2 (mobile) for a Text block
// preview: consecutive non-blank lines join into one paragraph (blank line
// = paragraph break), "* " lines become bullets, "#" heading lines become
// headings, "---" becomes a divider. Folds (||...||) and image/video lines
// aren't supported here (not used in Home Card text blocks).
type DetailPreviewBlock =
  | { type: 'paragraph' | 'heading' | 'bullet'; text: string }
  | { type: 'divider' };

function parseDetailPreviewBlocks(content: string): DetailPreviewBlock[] {
  const blocks: DetailPreviewBlock[] = [];
  let paragraphLines: string[] = [];
  const flush = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
    paragraphLines = [];
  };
  for (const rawLine of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (line === '') { flush(); continue; }
    if (/^-{3,}$/.test(line)) { flush(); blocks.push({ type: 'divider' }); continue; }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) { flush(); blocks.push({ type: 'heading', text: heading[1] }); continue; }
    if (line.startsWith('* ')) { flush(); blocks.push({ type: 'bullet', text: line.slice(2) }); continue; }
    paragraphLines.push(line);
  }
  flush();
  return blocks;
}

export default function HomeCardsPage() {
  const [homeCards, setHomeCards] = useState<HomeCard[]>([]);
  const [badges, setBadges] = useState<HomeCardBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; card: HomeCard } | null>(null);

  const fetchHomeCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cards, badgeList] = await Promise.all([getHomeCards(), getHomeCardBadges()]);
      setHomeCards(cards);
      setBadges(badgeList);
    } catch (err: any) {
      setError(err.message || 'Failed to load home cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeCards();
  }, [fetchHomeCards]);

  const handleBadgeAdded = (badge: HomeCardBadge) => {
    setBadges((prev) => [...prev, badge].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleDelete = async (id: string, badgeText: string) => {
    if (!window.confirm(`Delete card "${badgeText}"? This cannot be undone.`)) return;
    try {
      await deleteHomeCard(id);
      setHomeCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleToggleActive = async (card: HomeCard) => {
    const prevCards = homeCards;
    setHomeCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, isActive: !c.isActive } : c)));
    try {
      await updateHomeCard(card.id, { isActive: !card.isActive });
    } catch (err: any) {
      setHomeCards(prevCards);
      alert('Failed to update: ' + err.message);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= homeCards.length) return;

    const a = homeCards[index];
    const b = homeCards[target];
    const reordered = [...homeCards];
    reordered[index] = b;
    reordered[target] = a;
    setHomeCards(reordered);

    try {
      await Promise.all([
        updateHomeCard(a.id, { displayOrder: b.displayOrder }),
        updateHomeCard(b.id, { displayOrder: a.displayOrder }),
      ]);
      fetchHomeCards();
    } catch (err: any) {
      alert('Failed to reorder: ' + err.message);
      fetchHomeCards();
    }
  };

  const handleSaved = () => {
    setModal(null);
    fetchHomeCards();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Home Cards</h1>
          <p className="page-subtitle">
            Sub-action cards shown on the mobile Home screen, below the main action card
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
          + Add Card
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading home cards...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Image</th>
              <th>Type</th>
              <th>Badge</th>
              <th>Message</th>
              <th>Likes</th>
              <th>Views</th>
              <th>Shares</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {homeCards.map((card, index) => (
              <tr key={card.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-secondary-sm"
                    style={{ marginRight: 4 }}
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn-secondary-sm"
                    disabled={index === homeCards.length - 1}
                    onClick={() => handleMove(index, 1)}
                    title="Move down"
                  >
                    ↓
                  </button>
                </td>
                <td>
                  {card.imageUrl ? (
                    <img src={card.imageUrl} style={{ width: 60, height: 34, objectFit: 'cover', borderRadius: 4, background: '#F3F4F6' }} />
                  ) : (
                    <div style={{ width: 60, height: 34, borderRadius: 4, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#9CA3AF' }}>
                      None
                    </div>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 13, color: '#6B7280' }}>
                  {card.cardType === 'CONTENT' ? '→ Content' : '⤴ Quote'}
                </td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: card.badgeColor,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.badgeText}
                  </span>
                </td>
                <td className="cell-definition">
                  {card.message}
                  {card.cardType === 'QUOTE' && card.attribution && (
                    <span style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      — {card.attribution}
                    </span>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>♥ {card.likeCount}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{card.cardType === 'CONTENT' ? card.viewCount : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{card.shareCount}</td>
                <td>
                  <button
                    className={`settings-toggle ${card.isActive ? 'active' : ''}`}
                    onClick={() => handleToggleActive(card)}
                    title={card.isActive ? 'Active — shown on mobile' : 'Inactive — hidden from mobile'}
                  >
                    <span className="settings-toggle-knob" />
                  </button>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-secondary-sm"
                    style={{ marginRight: 6 }}
                    onClick={() => setModal({ mode: 'edit', card })}
                  >
                    Edit
                  </button>
                  <button className="btn-danger-sm" onClick={() => handleDelete(card.id, card.badgeText)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {homeCards.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-state">
                  No home cards yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {modal && (
        <HomeCardModal
          mode={modal.mode}
          card={modal.mode === 'edit' ? modal.card : undefined}
          badges={badges}
          onBadgeAdded={handleBadgeAdded}
          allCards={homeCards}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

// A component block being edited in the modal. `key` is a stable React key
// (the real id once saved, a client-only temp id until then); `id` is only
// set for a block that already exists on the server, so the save flow knows
// which blocks to update in place vs. create.
interface LocalComponent {
  key: string;
  id?: string;
  type: HomeCardComponentType;
  text: string;
  imageUrl: string | null;
  imageFile: File | null;
  linkedCardId: string;
  ctaLabel: string;
  inputLabel: string;
  inputPlaceholder: string;
}

let tempKeySeq = 0;
const nextTempKey = () => `temp-${++tempKeySeq}`;

function componentToLocal(c: HomeCardComponent): LocalComponent {
  return {
    key: c.id,
    id: c.id,
    type: c.type,
    text: c.text || '',
    imageUrl: c.imageUrl,
    imageFile: null,
    linkedCardId: c.linkedCardId || '',
    ctaLabel: c.ctaLabel || '',
    inputLabel: c.inputLabel || '',
    inputPlaceholder: c.inputPlaceholder || '',
  };
}

const COMPONENT_TYPE_LABELS: Record<HomeCardComponentType, string> = {
  TEXT: 'Text',
  IMAGE: 'Image',
  OPEN_DETAILS: 'Open more details',
  USER_INPUT: 'User input',
};

function HomeCardModal({
  mode,
  card,
  badges,
  onBadgeAdded,
  allCards,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  card?: HomeCard;
  badges: HomeCardBadge[];
  onBadgeAdded: (badge: HomeCardBadge) => void;
  allCards: HomeCard[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cardType, setCardType] = useState<HomeCardType>(card?.cardType || 'CONTENT');
  const [badgeId, setBadgeId] = useState(card?.badgeId || '');
  const [addingBadge, setAddingBadge] = useState(false);
  const [newBadgeName, setNewBadgeName] = useState('');
  const [newBadgeColor, setNewBadgeColor] = useState(BADGE_COLOR_PRESETS[0].value);
  const [savingBadge, setSavingBadge] = useState(false);
  const [message, setMessage] = useState(card?.message || '');
  const [messageFontSize, setMessageFontSize] = useState<HomeCardFontSize>(card?.messageFontSize || 'MEDIUM');
  const [messageBold, setMessageBold] = useState(card?.messageBold ?? false);
  const [messageItalic, setMessageItalic] = useState(card?.messageItalic ?? false);
  const [attribution, setAttribution] = useState(card?.attribution || '');
  const [detailTitle, setDetailTitle] = useState(card?.detailTitle || '');
  const [components, setComponents] = useState<LocalComponent[]>(
    () => card?.components.map(componentToLocal) || []
  );
  const [isActive, setIsActive] = useState(card?.isActive ?? true);
  const [targetTags, setTargetTags] = useState<string[]>(card?.targetTags || []);
  const [minAgeYears, setMinAgeYears] = useState(card?.minAgeMonths != null ? String(card.minAgeMonths / 12) : '');
  const [maxAgeYears, setMaxAgeYears] = useState(card?.maxAgeMonths != null ? String(card.maxAgeMonths / 12) : '');
  const [targetGender, setTargetGender] = useState<HomeCardGender | ''>(card?.targetGender || '');
  const [imageUrl, setImageUrl] = useState(card?.imageUrl || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);

  const messageRef = useRef<HTMLTextAreaElement>(null);
  // Keyed by LocalComponent.key — one ref per Text block's textarea, so a
  // single FormattingToolbar type can serve however many blocks are on screen.
  const componentTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const isEdit = mode === 'edit';
  const isContent = cardType === 'CONTENT';

  const previewImageSrc = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : imageUrl),
    [imageFile, imageUrl]
  );

  const linkableCards = useMemo(
    () => allCards.filter((c) => c.cardType === 'CONTENT' && c.id !== card?.id),
    [allCards, card?.id]
  );

  const addComponent = (type: HomeCardComponentType) => {
    setComponents((prev) => [
      ...prev,
      { key: nextTempKey(), type, text: '', imageUrl: null, imageFile: null, linkedCardId: '', ctaLabel: '', inputLabel: '', inputPlaceholder: '' },
    ]);
  };

  const removeComponent = (key: string) => {
    setComponents((prev) => prev.filter((c) => c.key !== key));
  };

  const moveComponent = (index: number, direction: -1 | 1) => {
    setComponents((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateComponent = (key: string, patch: Partial<LocalComponent>) => {
    setComponents((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const toggleTag = (value: string) => {
    setTargetTags((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  };

  const handleAddBadge = async () => {
    if (!newBadgeName.trim()) { alert('Badge name is required'); return; }
    setSavingBadge(true);
    try {
      const badge = await createHomeCardBadge(newBadgeName.trim(), newBadgeColor);
      onBadgeAdded(badge);
      setBadgeId(badge.id);
      setAddingBadge(false);
      setNewBadgeName('');
    } catch (err: any) {
      alert('Failed to add badge: ' + err.message);
    } finally {
      setSavingBadge(false);
    }
  };

  const handleSubmit = async () => {
    if (!badgeId) { alert('Please choose a badge'); return; }
    if (!message.trim()) { alert('Message is required'); return; }
    if (isContent && !detailTitle.trim()) { alert('Detail title is required for Content cards'); return; }
    for (const c of components) {
      if (c.type === 'TEXT' && !c.text.trim()) { alert('Every Text component needs text'); return; }
      if (c.type === 'OPEN_DETAILS' && !c.linkedCardId) { alert('Every "Open more details" component needs a linked card'); return; }
      if (c.type === 'USER_INPUT' && !c.inputLabel.trim()) { alert('Every User input component needs a prompt/label'); return; }
    }

    const minAgeMonths = minAgeYears.trim() ? Math.round(parseFloat(minAgeYears) * 12) : null;
    const maxAgeMonths = maxAgeYears.trim() ? Math.round(parseFloat(maxAgeYears) * 12) : null;
    if (minAgeYears.trim() && Number.isNaN(minAgeMonths as number)) { alert('Min age must be a number'); return; }
    if (maxAgeYears.trim() && Number.isNaN(maxAgeMonths as number)) { alert('Max age must be a number'); return; }
    if (minAgeMonths != null && maxAgeMonths != null && minAgeMonths > maxAgeMonths) {
      alert('Min age cannot be greater than max age');
      return;
    }

    setSaving(true);
    try {
      const componentsInput: HomeCardComponentInput[] | undefined = isContent
        ? components.map((c) => ({
            id: c.id,
            type: c.type,
            text: c.type === 'TEXT' ? c.text : undefined,
            linkedCardId: c.type === 'OPEN_DETAILS' ? c.linkedCardId : undefined,
            ctaLabel: c.type === 'OPEN_DETAILS' ? c.ctaLabel : undefined,
            inputLabel: c.type === 'USER_INPUT' ? c.inputLabel : undefined,
            inputPlaceholder: c.type === 'USER_INPUT' ? c.inputPlaceholder : undefined,
          }))
        : undefined;

      const input: HomeCardInput = {
        cardType,
        badgeId,
        message,
        messageFontSize,
        messageBold,
        messageItalic,
        isActive,
        targetTags,
        minAgeMonths,
        maxAgeMonths,
        targetGender: targetGender || null,
        ...(isContent ? { detailTitle, components: componentsInput } : { attribution }),
      };
      let id = card?.id;
      let savedCard: HomeCard;
      if (isEdit && id) {
        savedCard = await updateHomeCard(id, input);
      } else {
        savedCard = await createHomeCard(input);
        id = savedCard.id;
      }

      if (imageFile && id) {
        setUploadingImage(true);
        await uploadHomeCardImage(id, imageFile);
      }

      // Components are sent/returned in the same order, so pair them up by
      // index to find the real id assigned to any newly-created block, then
      // upload its pending image (two-phase, same as the card banner above).
      const pendingImageUploads = components
        .map((c, index) => ({ c, saved: savedCard.components[index] }))
        .filter(({ c }) => c.type === 'IMAGE' && c.imageFile);
      if (pendingImageUploads.length > 0 && id) {
        setUploadingImage(true);
        await Promise.all(
          pendingImageUploads.map(({ c, saved }) => uploadHomeCardComponentImage(id!, saved.id, c.imageFile!))
        );
      }

      onSaved();
    } catch (err: any) {
      alert(`Failed to ${isEdit ? 'update' : 'create'} home card: ` + err.message);
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!card) return;
    setRemovingImage(true);
    try {
      await removeHomeCardImage(card.id);
      setImageUrl(null);
    } catch (err: any) {
      alert('Failed to remove image: ' + err.message);
    } finally {
      setRemovingImage(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Home Card' : 'Add Home Card'}</h2>
          <button className="btn-remove" onClick={onClose}>&times;</button>
        </div>

        <div className="form-group">
          <label>Card type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={cardType === 'CONTENT' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setCardType('CONTENT')}
            >
              Content (opens a page)
            </button>
            <button
              type="button"
              className={cardType === 'QUOTE' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setCardType('QUOTE')}
            >
              Quote (share button)
            </button>
          </div>
          <p className="form-hint">
            {isContent
              ? 'Tapping the card on mobile opens a detail page with an arrow affordance.'
              : 'The card gets a share button instead of a detail page — no further content needed.'}
          </p>
        </div>

        <div className="form-group">
          <label>Badge</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {badges.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBadgeId(b.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: b.color,
                  border: badgeId === b.id ? '2px solid #1E2939' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {b.name}
              </button>
            ))}
            <button type="button" className="btn-secondary-sm" onClick={() => setAddingBadge((v) => !v)}>
              + Add new badge
            </button>
          </div>
          {addingBadge && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={newBadgeName}
                onChange={(e) => setNewBadgeName(e.target.value)}
                placeholder="New badge name"
                style={{ maxWidth: 180 }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {BADGE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setNewBadgeColor(preset.value)}
                    title={preset.label}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: preset.value,
                      border: newBadgeColor === preset.value ? '2px solid #1E2939' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <button type="button" className="btn-primary" onClick={handleAddBadge} disabled={savingBadge}>
                {savingBadge ? 'Adding...' : 'Add'}
              </button>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>{isContent ? 'Message (teaser shown on the card)' : 'Quote text'}</label>
          <FormattingToolbar getTextarea={() => messageRef.current} onChange={setMessage} />
          <textarea
            ref={messageRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => handleBoldShortcut(e, setMessage)}
            placeholder={isContent ? 'Headline\nOptional smaller description on the next line...' : "Every action you take is a vote for the person you wish to become. (no surrounding quote marks — those are added automatically)"}
            rows={4}
            autoFocus={!isContent}
          />
          <p className="form-hint">
            Select text and click Bold (or Ctrl/Cmd+B).
            {isContent && ' Press Enter after the first line to add it as a smaller description below the bold headline.'}
          </p>
        </div>

        {!isContent && (
          <div className="form-group">
            <label>Attribution (optional)</label>
            <input
              type="text"
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              placeholder="e.g. James Clear"
            />
            <p className="form-hint">Shown below a divider under the quote. Leave blank to omit both.</p>
          </div>
        )}

        <div className="form-group">
          <label>Message style</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {FONT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={messageFontSize === opt.value ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setMessageFontSize(opt.value)}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              className={`settings-toggle ${messageBold ? 'active' : ''}`}
              onClick={() => setMessageBold((v) => !v)}
              style={{ marginLeft: 8 }}
              title="Bold"
            >
              <span className="settings-toggle-knob" />
            </button>
            <span style={{ fontSize: 13, color: '#6B7280' }}>Bold</span>
            <button
              type="button"
              className={`settings-toggle ${messageItalic ? 'active' : ''}`}
              onClick={() => setMessageItalic((v) => !v)}
              style={{ marginLeft: 8 }}
              title="Italic"
            >
              <span className="settings-toggle-knob" />
            </button>
            <span style={{ fontSize: 13, color: '#6B7280' }}>Italic</span>
          </div>
          {isContent ? (
            // Mirrors SubActionCard's CONTENT branch in HomeScreen_v2.tsx —
            // pastel card tinted from the badge color, bold headline +
            // optional description, divider, Learn more + like/share — so
            // this preview matches the app.
            (() => {
              const previewBadge = badges.find((b) => b.id === badgeId);
              const previewColor = previewBadge?.color || BADGE_COLOR_PRESETS[0].value;
              const basePx = FONT_SIZE_OPTIONS.find((o) => o.value === messageFontSize)!.px;
              const { headline, description } = splitPreviewMessage(message);
              const iconUrl = previewBadge ? SUB_ACTION_CARD_ICON_URLS[previewBadge.name] : undefined;
              return (
                <div
                  style={{
                    // Matches a phone card's actual rendered width (device
                    // width minus SubActionCard's 20px marginHorizontal on
                    // each side) — the modal itself is much wider, so
                    // without this the preview stretches far past what the
                    // card looks like in the app.
                    maxWidth: 350,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    marginTop: 10,
                    padding: 20,
                    borderRadius: 20,
                    backgroundColor: lightenHex(previewColor, 0.92),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '5px 12px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color: previewColor,
                          backgroundColor: lightenHex(previewColor, 0.82),
                          marginBottom: 12,
                        }}
                      >
                        {previewBadge?.name || 'Badge'}
                      </span>
                      <p
                        style={{
                          margin: '0 0 6px',
                          fontSize: basePx + 4,
                          fontWeight: 700,
                          fontStyle: messageItalic ? 'italic' : 'normal',
                          color: '#1E2939',
                        }}
                      >
                        {headline ? renderInlineFormatted(headline) : 'Preview of the headline text...'}
                      </p>
                      {description && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: basePx - 1,
                            fontWeight: messageBold ? 700 : 400,
                            fontStyle: messageItalic ? 'italic' : 'normal',
                            color: '#6B7280',
                          }}
                        >
                          {renderInlineFormatted(description)}
                        </p>
                      )}
                    </div>
                    {(previewImageSrc || iconUrl) && (
                      <img
                        src={previewImageSrc || iconUrl}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 12,
                          objectFit: previewImageSrc ? 'cover' : 'contain',
                          background: previewImageSrc ? 'rgba(255,255,255,0.5)' : 'transparent',
                        }}
                      />
                    )}
                  </div>
                  <div style={{ height: 1, backgroundColor: 'rgba(30,41,57,0.08)', margin: '16px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#8C49D5', fontWeight: 600, fontSize: 14 }}>Learn more &rarr;</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 15, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>♡</span>
                      <span style={{ width: 30, height: 30, borderRadius: 15, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>⤴</span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            // Mirrors SubActionCard's QUOTE branch in HomeScreen_v2.tsx exactly
            // (same colors/spacing/radius) so this preview matches the app.
            <div
              style={{
                position: 'relative',
                // Matches a phone card's actual rendered width — see the
                // comment on the CONTENT preview's maxWidth above.
                maxWidth: 350,
                marginLeft: 'auto',
                marginRight: 'auto',
                marginTop: 10,
                padding: '28px 24px',
                borderRadius: 20,
                backgroundColor: '#F7F3EC',
                textAlign: 'center',
              }}
            >
              <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#B99089' }}>♡</span>
                <span style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#B99089' }}>⤴</span>
              </div>

              {previewImageSrc && (
                <img
                  src={previewImageSrc}
                  style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 12, marginBottom: 12, background: '#F3F4F6' }}
                />
              )}

              <p
                style={{
                  marginTop: 20,
                  fontStyle: messageItalic ? 'italic' : 'normal',
                  fontSize: FONT_SIZE_OPTIONS.find((o) => o.value === messageFontSize)!.px,
                  lineHeight: 1.6,
                  fontWeight: messageBold ? 700 : 400,
                  color: '#1E2939',
                }}
              >
                {message ? renderInlineFormatted(message) : 'Every action you take is a vote for the person you wish to become.'}
              </p>
              {attribution && (
                <>
                  <div style={{ width: 40, height: 2, borderRadius: 1, backgroundColor: '#DDAEA5', margin: '16px auto 14px' }} />
                  <p style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 15, color: '#1E2939', margin: 0 }}>{attribution}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Card image (optional)</label>
          {previewImageSrc && (
            <img
              src={previewImageSrc}
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, marginBottom: 8, background: '#F3F4F6' }}
            />
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            {isEdit && (imageUrl || imageFile) && (
              <button
                type="button"
                className="btn-secondary-sm"
                onClick={() => {
                  if (imageFile) setImageFile(null);
                  else handleRemoveImage();
                }}
                disabled={removingImage}
              >
                {removingImage ? 'Removing...' : imageFile ? 'Clear selection' : 'Remove image'}
              </button>
            )}
          </div>
          <p className="form-hint">JPG, PNG, WebP, or GIF. Up to 10 MB. Shown as a banner at the top of the card.</p>
        </div>

        <div className="form-group">
          <label>Target tags (optional — leave empty to show to everyone)</label>
          <p className="form-hint" style={{ marginTop: 0, marginBottom: 8 }}>
            When this card sets a tag, age range, and/or gender below, a parent must match ALL of the ones set
            (not just one) for it to rank as relevant — it still shows to everyone either way, just lower.
          </p>
          {[
            { title: 'Issue', options: ISSUE_TAG_OPTIONS },
            { title: 'Parent goal', options: PARENT_GOAL_TAG_OPTIONS },
            { title: 'Clinical level', options: CLINICAL_LEVEL_TAG_OPTIONS },
          ].map(({ title, options }) => (
            <div key={title} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: '0 0 6px' }}>{title}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleTag(opt.value)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      color: targetTags.includes(opt.value) ? '#fff' : '#374151',
                      backgroundColor: targetTags.includes(opt.value) ? '#8C49D5' : '#F3F4F6',
                      border: '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 6 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: '0 0 6px' }}>Target age range (years, optional)</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={minAgeYears}
                  onChange={(e) => setMinAgeYears(e.target.value)}
                  placeholder="Min"
                  style={{ width: 80 }}
                />
                <span>–</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={maxAgeYears}
                  onChange={(e) => setMaxAgeYears(e.target.value)}
                  placeholder="Max"
                  style={{ width: 80 }}
                />
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: '0 0 6px' }}>Target gender (optional)</p>
              <select value={targetGender} onChange={(e) => setTargetGender(e.target.value as HomeCardGender | '')}>
                {GENDER_TAG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isContent && (
          <>
            <div className="form-group">
              <label>Detail page title</label>
              <input
                type="text"
                value={detailTitle}
                onChange={(e) => setDetailTitle(e.target.value)}
                placeholder="Title shown at the top of the detail page"
              />
            </div>

            <div className="form-group">
              <label>Detail page content</label>
              <p className="form-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Build the page from blocks, in the order they should appear.
              </p>

              {components.map((c, index) => (
                <div
                  key={c.key}
                  style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {COMPONENT_TYPE_LABELS[c.type]}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        disabled={index === 0}
                        onClick={() => moveComponent(index, -1)}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-sm"
                        disabled={index === components.length - 1}
                        onClick={() => moveComponent(index, 1)}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-danger-sm"
                        onClick={() => removeComponent(c.key)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {c.type === 'TEXT' && (
                    <>
                      <FormattingToolbar
                        getTextarea={() => componentTextareaRefs.current.get(c.key) || null}
                        onChange={(text) => updateComponent(c.key, { text })}
                      />
                      <textarea
                        ref={(el) => {
                          if (el) componentTextareaRefs.current.set(c.key, el);
                          else componentTextareaRefs.current.delete(c.key);
                        }}
                        value={c.text}
                        onChange={(e) => updateComponent(c.key, { text: e.target.value })}
                        onKeyDown={(e) => handleBoldShortcut(e, (text) => updateComponent(c.key, { text }))}
                        placeholder="Supports **bold**, *italic*, '* ' bullet lines, '### ' headings, and blank-line paragraph breaks, same as lesson content."
                        rows={6}
                      />
                    </>
                  )}

                  {c.type === 'IMAGE' && (
                    <>
                      {(c.imageFile || c.imageUrl) && (
                        <img
                          src={c.imageFile ? URL.createObjectURL(c.imageFile) : c.imageUrl!}
                          style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, marginBottom: 8, background: '#F3F4F6' }}
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => updateComponent(c.key, { imageFile: e.target.files?.[0] || null })}
                      />
                    </>
                  )}

                  {c.type === 'OPEN_DETAILS' && (
                    <>
                      <select
                        value={c.linkedCardId}
                        onChange={(e) => updateComponent(c.key, { linkedCardId: e.target.value })}
                      >
                        <option value="">Select a card to link to...</option>
                        {linkableCards.map((lc) => (
                          <option key={lc.id} value={lc.id}>
                            {lc.badgeText} — {lc.detailTitle || lc.message}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={c.ctaLabel}
                        onChange={(e) => updateComponent(c.key, { ctaLabel: e.target.value })}
                        placeholder="Button label (e.g. Learn more)"
                        style={{ marginTop: 8 }}
                      />
                    </>
                  )}

                  {c.type === 'USER_INPUT' && (
                    <>
                      <input
                        type="text"
                        value={c.inputLabel}
                        onChange={(e) => updateComponent(c.key, { inputLabel: e.target.value })}
                        placeholder="Prompt shown above the input (e.g. What's one thing you'll try this week?)"
                      />
                      <input
                        type="text"
                        value={c.inputPlaceholder}
                        onChange={(e) => updateComponent(c.key, { inputPlaceholder: e.target.value })}
                        placeholder="Placeholder text (optional)"
                        style={{ marginTop: 8 }}
                      />
                    </>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary-sm" onClick={() => addComponent('TEXT')}>+ Text</button>
                <button type="button" className="btn-secondary-sm" onClick={() => addComponent('IMAGE')}>+ Image</button>
                <button type="button" className="btn-secondary-sm" onClick={() => addComponent('OPEN_DETAILS')}>+ Open more details</button>
                <button type="button" className="btn-secondary-sm" onClick={() => addComponent('USER_INPUT')}>+ User input</button>
              </div>
            </div>

            <div className="form-group">
              <label>Detail page preview</label>
              <p className="form-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Mirrors what tapping "Learn more" opens on mobile (HomeCardDetailScreen).
              </p>
              {(() => {
                const previewBadge = badges.find((b) => b.id === badgeId);
                const previewColor = previewBadge?.color || BADGE_COLOR_PRESETS[0].value;
                const linkedTitle = (linkedCardId: string) =>
                  linkableCards.find((lc) => lc.id === linkedCardId)?.detailTitle
                  || linkableCards.find((lc) => lc.id === linkedCardId)?.message
                  || 'Select a card to link to...';
                return (
                  <div
                    style={{
                      maxWidth: 350,
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      marginTop: 10,
                      border: '1px solid #E5E7EB',
                      borderRadius: 20,
                      overflow: 'hidden',
                      background: '#fff',
                    }}
                  >
                    {previewImageSrc && (
                      <img
                        src={previewImageSrc}
                        style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: '#F3F4F6' }}
                      />
                    )}
                    <div style={{ padding: '16px 18px 20px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: previewColor,
                          marginBottom: 8,
                        }}
                      >
                        {previewBadge?.name || 'Badge'}
                      </span>
                      <p style={{ margin: '0 0 16px', fontSize: 19, fontWeight: 700, lineHeight: 1.3, color: '#1E2939' }}>
                        {detailTitle || 'Detail page title...'}
                      </p>

                      {components.length === 0 && (
                        <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>No content blocks yet.</p>
                      )}

                      {components.map((c) => {
                        if (c.type === 'TEXT') {
                          const blocks = parseDetailPreviewBlocks(c.text);
                          return (
                            <div key={c.key} style={{ marginBottom: 14 }}>
                              {blocks.length === 0 && <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>Empty text block</p>}
                              {blocks.map((b, i) => {
                                if (b.type === 'divider') return <div key={i} style={{ height: 1, background: '#E5E7EB', margin: '10px 0' }} />;
                                if (b.type === 'heading') return <p key={i} style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1E2939' }}>{renderInlineFormatted(b.text)}</p>;
                                if (b.type === 'bullet') return (
                                  <div key={i} style={{ display: 'flex', gap: 6, margin: '0 0 6px' }}>
                                    <span style={{ color: '#6B7280' }}>•</span>
                                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#374151' }}>{renderInlineFormatted(b.text)}</p>
                                  </div>
                                );
                                return <p key={i} style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.6, color: '#374151' }}>{renderInlineFormatted(b.text)}</p>;
                              })}
                            </div>
                          );
                        }
                        if (c.type === 'IMAGE') {
                          const src = c.imageFile ? URL.createObjectURL(c.imageFile) : c.imageUrl;
                          return src ? (
                            <img key={c.key} src={src} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 12, marginBottom: 14, background: '#F3F4F6' }} />
                          ) : (
                            <div key={c.key} style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12, marginBottom: 14, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9CA3AF' }}>
                              No image selected
                            </div>
                          );
                        }
                        if (c.type === 'OPEN_DETAILS') {
                          return (
                            <div key={c.key} style={{ marginBottom: 14 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  border: '1px solid #8C49D5',
                                  borderRadius: 14,
                                  padding: '12px 14px',
                                }}
                              >
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#8C49D5' }}>{c.ctaLabel || 'Learn more'}</span>
                                <span style={{ color: '#8C49D5' }}>&rarr;</span>
                              </div>
                              <p style={{ margin: '4px 2px 0', fontSize: 11, color: '#9CA3AF' }}>
                                Links to: {c.linkedCardId ? linkedTitle(c.linkedCardId) : 'Select a card to link to...'}
                              </p>
                            </div>
                          );
                        }
                        // USER_INPUT
                        return (
                          <div key={c.key} style={{ marginBottom: 14 }}>
                            {c.inputLabel && <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#1E2939' }}>{c.inputLabel}</p>}
                            <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 10, minHeight: 60, fontSize: 13, color: '#9CA3AF' }}>
                              {c.inputPlaceholder || 'Type your answer...'}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                              <span style={{ background: '#8C49D5', color: '#fff', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>Save</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`settings-toggle ${isActive ? 'active' : ''}`}
              onClick={() => setIsActive((v) => !v)}
            >
              <span className="settings-toggle-knob" />
            </button>
            Active (shown on mobile Home screen)
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {uploadingImage ? 'Uploading image...' : saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Card'}
          </button>
        </div>
      </div>
    </div>
  );
}
