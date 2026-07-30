import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getHomeCards,
  createHomeCard,
  updateHomeCard,
  deleteHomeCard,
  uploadHomeCardImage,
  removeHomeCardImage,
  HomeCard,
  HomeCardInput,
  HomeCardType,
  HomeCardFontSize,
} from '../api/adminApi';

const BADGE_COLOR_PRESETS = [
  { label: 'Purple', value: '#8C49D5' },
  { label: 'Green', value: '#10B981' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Pink', value: '#EC4899' },
];

// Mirrors SubActionCard's FONT_SIZE_MAP in HomeScreen_v2.tsx — keep in sync
// so this preview matches what actually renders on mobile.
const FONT_SIZE_OPTIONS: { label: string; value: HomeCardFontSize; px: number }[] = [
  { label: 'Small', value: 'SMALL', px: 13 },
  { label: 'Medium', value: 'MEDIUM', px: 15 },
  { label: 'Large', value: 'LARGE', px: 18 },
];

export default function HomeCardsPage() {
  const [homeCards, setHomeCards] = useState<HomeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; card: HomeCard } | null>(null);

  const fetchHomeCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getHomeCards();
      setHomeCards(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load home cards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeCards();
  }, [fetchHomeCards]);

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
                  {card.cardType === 'CONTENT' ? (
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
                  ) : (
                    <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
                  )}
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
                <td colSpan={8} className="empty-state">
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
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function HomeCardModal({
  mode,
  card,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  card?: HomeCard;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cardType, setCardType] = useState<HomeCardType>(card?.cardType || 'CONTENT');
  const [badgeText, setBadgeText] = useState(card?.badgeText || '');
  const [badgeColor, setBadgeColor] = useState(card?.badgeColor || BADGE_COLOR_PRESETS[0].value);
  const [message, setMessage] = useState(card?.message || '');
  const [messageFontSize, setMessageFontSize] = useState<HomeCardFontSize>(card?.messageFontSize || 'MEDIUM');
  const [messageBold, setMessageBold] = useState(card?.messageBold ?? false);
  const [messageItalic, setMessageItalic] = useState(card?.messageItalic ?? false);
  const [attribution, setAttribution] = useState(card?.attribution || '');
  const [detailTitle, setDetailTitle] = useState(card?.detailTitle || '');
  const [detailContent, setDetailContent] = useState(card?.detailContent || '');
  const [isActive, setIsActive] = useState(card?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState(card?.imageUrl || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);

  const isEdit = mode === 'edit';
  const isContent = cardType === 'CONTENT';

  const previewImageSrc = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : imageUrl),
    [imageFile, imageUrl]
  );

  const handleSubmit = async () => {
    if (isContent && !badgeText.trim()) { alert('Badge text is required'); return; }
    if (!message.trim()) { alert('Message is required'); return; }
    if (isContent && !detailTitle.trim()) { alert('Detail title is required for Content cards'); return; }
    if (isContent && !detailContent.trim()) { alert('Detail content is required for Content cards'); return; }

    setSaving(true);
    try {
      const input: HomeCardInput = {
        cardType,
        badgeText: isContent ? badgeText : (badgeText.trim() || 'Quote'),
        badgeColor,
        message,
        messageFontSize,
        messageBold,
        messageItalic,
        isActive,
        ...(isContent ? { detailTitle, detailContent } : { attribution }),
      };
      let id = card?.id;
      if (isEdit && id) {
        await updateHomeCard(id, input);
      } else {
        const created = await createHomeCard(input);
        id = created.id;
      }

      if (imageFile && id) {
        setUploadingImage(true);
        await uploadHomeCardImage(id, imageFile);
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

        {isContent && (
          <>
            <div className="form-group">
              <label>Badge text</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="e.g. New, Tip, Reminder"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Badge color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {BADGE_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setBadgeColor(preset.value)}
                    title={preset.label}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: preset.value,
                      border: badgeColor === preset.value ? '2px solid #1E2939' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={badgeColor}
                  onChange={(e) => setBadgeColor(e.target.value)}
                  style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                  title="Custom color"
                />
                <span
                  style={{
                    marginLeft: 4,
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: badgeColor,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badgeText || 'Preview'}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="form-group">
          <label>{isContent ? 'Message (teaser shown on the card)' : 'Quote text'}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isContent ? 'Short teaser — the full content is below...' : "Every action you take is a vote for the person you wish to become. (no surrounding quote marks — those are added automatically)"}
            rows={4}
            autoFocus={!isContent}
          />
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
            <p
              style={{
                marginTop: 10,
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: '#F9FAFB',
                fontSize: FONT_SIZE_OPTIONS.find((o) => o.value === messageFontSize)!.px,
                fontWeight: messageBold ? 700 : 400,
                fontStyle: messageItalic ? 'italic' : 'normal',
                color: '#1E2939',
              }}
            >
              {message || 'Preview of the message text...'}
            </p>
          ) : (
            // Mirrors SubActionCard's QUOTE branch in HomeScreen_v2.tsx exactly
            // (same colors/spacing/radius) so this preview matches the app.
            <div
              style={{
                position: 'relative',
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
                {message || 'Every action you take is a vote for the person you wish to become.'}
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
              <textarea
                value={detailContent}
                onChange={(e) => setDetailContent(e.target.value)}
                placeholder="Full content shown when the card is tapped. Supports **bold**, *italic*, '* ' bullet lines, '### ' headings, and blank-line paragraph breaks, same as lesson content."
                rows={10}
              />
              <p className="form-hint">{detailContent.length} chars</p>
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
