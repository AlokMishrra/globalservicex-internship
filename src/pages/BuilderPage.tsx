import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { Link } from 'react-router-dom';
import type { DraftFormState, FormField, PublishedForm } from '../types';
import { fieldTemplates, createFieldFromTemplate, buildSlug, formatDateTime } from '../utils/form';
import { loadDraft, loadPublishedForms, resetDraft, saveDraft, savePublishedForm } from '../utils/storage';

const defaultDraft: DraftFormState = {
  title: 'Untitled internship form',
  description: 'Outline your internship intake requirements.',
  fields: [],
};

const BuilderPage = () => {
  const [draft, setDraft] = useState<DraftFormState>(defaultDraft);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [forms, setForms] = useState<PublishedForm[]>([]);

  useEffect(() => {
    setDraft(loadDraft());
    setForms(loadPublishedForms());
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;
    const template = JSON.parse(raw) as Omit<FormField, 'id'>;
    setDraft((prev) => ({
      ...prev,
      fields: [...prev.fields, createFieldFromTemplate(template)],
    }));
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((field) => (field.id === id ? { ...field, ...updates } : field)),
    }));
  };

  const removeField = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.filter((field) => field.id !== id),
    }));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    setDraft((prev) => {
      const nextFields = [...prev.fields];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nextFields.length) return prev;
      [nextFields[index], nextFields[targetIndex]] = [nextFields[targetIndex], nextFields[index]];
      return { ...prev, fields: nextFields };
    });
  };

  const handlePublish = (payload: { name: string; openHours: number }) => {
    if (!draft.fields.length) return;
    const now = new Date();
    const close = new Date(now.getTime() + payload.openHours * 60 * 60 * 1000);
    const slug = buildSlug(payload.name);
    const newForm: PublishedForm = {
      id: crypto.randomUUID(),
      slug,
      name: payload.name,
      openAt: now.toISOString(),
      closeAt: close.toISOString(),
      fields: draft.fields,
      createdAt: now.toISOString(),
    };
    savePublishedForm(newForm);
    resetDraft();
    setDraft(defaultDraft);
    setForms(loadPublishedForms());
    const url = `${window.location.origin}/form/${slug}`;
    setShareUrl(url);
    setPublishModalOpen(false);
  };

  const dropZoneMessage = draft.fields.length ? 'Drag new fields here or edit existing ones' : 'Drop fields here to start building';

  const sortedForms = useMemo(
    () => [...forms].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [forms],
  );

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="tag">Internship intake</p>
          <h1>Create and publish forms in minutes</h1>
          <p className="muted">Drag and drop questions, set the publishing window, and instantly share a public link with applicants.</p>
        </div>
        <button className="primary" onClick={() => setPublishModalOpen(true)} disabled={!draft.fields.length}>
          Publish form
        </button>
      </header>

      {shareUrl && (
        <div className="share-card">
          <strong>Live form link</strong>
          <p>{shareUrl}</p>
          <button className="ghost" onClick={() => navigator.clipboard.writeText(shareUrl)}>
            Copy link
          </button>
        </div>
      )}

      <section className="builder-grid">
        <div className="palette">
          <h3>Field picker</h3>
          <p className="muted small">Drag a block into the builder panel</p>
          <div className="palette-items">
            {fieldTemplates.map((template) => (
              <button
                key={template.type + template.label}
                className="palette-item"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/json', JSON.stringify(template));
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    fields: [...prev.fields, createFieldFromTemplate(template)],
                  }))
                }
              >
                <span>{template.label}</span>
                <span className="type">{template.type}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="builder-canvas"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="form-header">
            <input
              className="title-input"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
            <textarea
              className="description-input"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>

          {!draft.fields.length && <p className="empty-state">{dropZoneMessage}</p>}

          <div className="field-stack">
            {draft.fields.map((field, index) => (
              <div key={field.id} className="field-card">
                <div className="field-meta">
                  <input
                    value={field.label}
                    onChange={(event) => updateField(field.id, { label: event.target.value })}
                  />
                  <div className="field-actions">
                    <button onClick={() => moveField(index, 'up')} disabled={index === 0}>
                      ↑
                    </button>
                    <button onClick={() => moveField(index, 'down')} disabled={index === draft.fields.length - 1}>
                      ↓
                    </button>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateField(field.id, { required: event.target.checked })}
                      />
                      Required
                    </label>
                    <button className="danger" onClick={() => removeField(field.id)}>
                      Remove
                    </button>
                  </div>
                </div>

                {field.type === 'dropdown' && (
                  <div className="options">
                    <p className="muted small">Dropdown options</p>
                    {field.options?.map((option, optionIndex) => (
                      <div key={optionIndex} className="option-row">
                        <input
                          value={option}
                          onChange={(event) => {
                            const nextOptions = [...(field.options || [])];
                            nextOptions[optionIndex] = event.target.value;
                            updateField(field.id, { options: nextOptions });
                          }}
                        />
                        <button
                          onClick={() => {
                            updateField(field.id, {
                              options: (field.options || []).filter((_, idx) => idx !== optionIndex),
                            });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      className="ghost"
                      onClick={() =>
                        updateField(field.id, {
                          options: [...(field.options || []), `Option ${(field.options || []).length + 1}`],
                        })
                      }
                    >
                      Add option
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="history">
        <h3>Published forms</h3>
        {!sortedForms.length && <p className="muted small">Nothing published yet.</p>}
        <div className="history-list">
          {sortedForms.map((form) => (
            <article key={form.id} className="history-card">
              <div>
                <h4>{form.name}</h4>
                <p className="muted small">
                  Live window: {formatDateTime(form.openAt)} → {formatDateTime(form.closeAt)}
                </p>
                <p className="muted small">{form.fields.length} fields</p>
              </div>
              <Link to={`/form/${form.slug}`} className="ghost">
                Open link
              </Link>
            </article>
          ))}
        </div>
      </section>

      {publishModalOpen && (
        <PublishModal
          onClose={() => setPublishModalOpen(false)}
          onSubmit={handlePublish}
          disabled={!draft.fields.length}
        />
      )}
    </div>
  );
};

const PublishModal = ({
  onClose,
  onSubmit,
  disabled,
}: {
  onClose: () => void;
  onSubmit: (payload: { name: string; openHours: number }) => void;
  disabled: boolean;
}) => {
  const [name, setName] = useState('Internship Application');
  const [hours, setHours] = useState(72);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header>
          <h3>Publish form</h3>
          <button onClick={onClose}>✕</button>
        </header>
        <label>
          Form name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Keep form open (hours)
          <input
            type="number"
            min={1}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          />
        </label>
        <p className="muted small">A unique public link will be generated automatically.</p>
        <footer>
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={disabled || !name || !hours} onClick={() => onSubmit({ name, openHours: hours })}>
            Publish now
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BuilderPage;

