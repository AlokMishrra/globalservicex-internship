import { useEffect, useMemo, useState, useRef } from 'react';
import type { DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DraftFormState, FormField, PublishedForm, FormSubmission, FormTheme } from '../types';
import { fieldTemplates, createFieldFromTemplate, buildSlug, formatDateTime } from '../utils/form';
import { db } from '../services/db';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  loadDraft,
  loadSubmissions,
  resetDraft,
  saveDraft,
  setDefaultDescription,
  setDefaultTitle,
} from '../utils/storage';

const defaultDraft: DraftFormState = {
  title: 'Untitled internship form',
  description: 'Outline your internship intake requirements.',
  fields: [],
};

const choiceTypes: FormField['type'][] = ['multipleChoice', 'checkboxes', 'dropdown'];
const gridTypes: FormField['type'][] = ['multipleChoiceGrid', 'checkboxGrid'];

const BuilderPage = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftFormState>(defaultDraft);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [brandPreview, setBrandPreview] = useState<string>('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareForm, setShareForm] = useState<PublishedForm | null>(null);
  const [forms, setForms] = useState<PublishedForm[]>([]);
  const [submissionsModal, setSubmissionsModal] = useState<{ form: PublishedForm | null; submissions: FormSubmission[] }>({
    form: null,
    submissions: [],
  });
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning'
  });

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    navigate('/gsxi/login');
  };

  useEffect(() => {
    setDraft(loadDraft());
    const fetchForms = async () => {
      try {
        const data = await db.getAllForms();
        setForms(data);
      } catch (error) {
        console.error('Failed to load forms:', error);
      }
    };
    fetchForms();
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (titleRef.current && titleRef.current.innerText !== draft.title) {
      titleRef.current.innerText = draft.title;
    }
  }, [draft.title]);

  useEffect(() => {
    if (descriptionRef.current && descriptionRef.current.innerText !== draft.description) {
      descriptionRef.current.innerText = draft.description;
    }
  }, [draft.description]);

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
  const handlePublish = async (payload: { name: string; openAt: string; closeAt: string }) => {
    if (!draft.fields.length) return;

    try {
      const slug = buildSlug(payload.name);

      await db.createForm({
        ...draft,
        name: payload.name,
        slug,
        status: 'published',
        openAt: payload.openAt,
        closeAt: payload.closeAt,
      });

      // Update default title and description for next form
      if (draft.title && draft.title.trim() !== '') {
        setDefaultTitle(draft.title);
      }
      if (draft.description && draft.description.trim() !== '') {
        setDefaultDescription(draft.description);
      }

      resetDraft();
      // Load new draft with updated defaults
      const newDraft = loadDraft();
      setDraft(newDraft);

      const publishedForms = await db.getAllForms();
      setForms(publishedForms);

      const url = `${window.location.origin}/form/${slug}`;
      const referenceUrl = url.replace(window.location.origin, 'https://globalservicex.in');
      setShareUrl(url);
      setBrandPreview(referenceUrl);
      setPublishModalOpen(false);
    } catch (error) {
      console.error('Failed to publish form:', error);
      alert('Failed to publish form. Please try again.');
    }
  };

  const updateTheme = (updates: Partial<FormTheme>) => {
    setDraft((prev) => ({
      ...prev,
      theme: { ...prev.theme, ...updates },
    }));
  };

  const applyFormatting = (command: string, value?: string) => {
    // Prevent default button behavior
    const selection = window.getSelection();
    let targetField: HTMLDivElement | null = null;

    // Determine which field to target
    if (titleRef.current && (
      document.activeElement === titleRef.current ||
      (selection && selection.rangeCount > 0 && titleRef.current.contains(selection.getRangeAt(0).commonAncestorContainer))
    )) {
      targetField = titleRef.current;
    } else if (descriptionRef.current && (
      document.activeElement === descriptionRef.current ||
      (selection && selection.rangeCount > 0 && descriptionRef.current.contains(selection.getRangeAt(0).commonAncestorContainer))
    )) {
      targetField = descriptionRef.current;
    } else if (descriptionRef.current) {
      targetField = descriptionRef.current;
    } else if (titleRef.current) {
      targetField = titleRef.current;
    }

    if (!targetField) return;

    // Save current selection
    let savedRange: Range | null = null;
    if (selection && selection.rangeCount > 0) {
      try {
        savedRange = selection.getRangeAt(0).cloneRange();
      } catch (error) {
        console.error('Failed to save selection:', error);
      }
    }

    // Focus the target field
    targetField.focus();

    // Restore selection if we had one
    if (savedRange && selection) {
      try {
        // Verify the range is still valid
        const container = savedRange.commonAncestorContainer;
        if (targetField.contains(container) || targetField === container) {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        } else {
          // Range is invalid, place cursor at end
          const range = document.createRange();
          range.selectNodeContents(targetField);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch {
        // If restore fails, place cursor at end
        try {
          const range = document.createRange();
          range.selectNodeContents(targetField);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (err) {
          console.error('Failed to set cursor:', err);
        }
      }
    } else if (selection) {
      // No saved selection, place cursor at end
      try {
        const range = document.createRange();
        range.selectNodeContents(targetField);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        console.error('Failed to set cursor:', e);
      }
    }

    // Apply the formatting command
    requestAnimationFrame(() => {
      try {
        // Ensure field is still focused
        if (document.activeElement !== targetField) {
          targetField.focus();
        }

        // Execute the command
        const executed = document.execCommand(command, false, value);

        if (!executed) {
          // Retry once if it failed
          setTimeout(() => {
            try {
              targetField.focus();
              document.execCommand(command, false, value);
            } catch (err) {
              console.error('Retry formatting failed:', err);
            }
            // Update state
            if (targetField === descriptionRef.current) {
              handleDescriptionChange();
            } else if (targetField === titleRef.current) {
              handleTitleChange();
            }
          }, 20);
        } else {
          // Update state immediately after successful command
          if (targetField === descriptionRef.current) {
            handleDescriptionChange();
          } else if (targetField === titleRef.current) {
            handleTitleChange();
          }
        }
      } catch (error) {
        console.error('Formatting command failed:', error);
      }
    });
  };

  const handleTitleChange = () => {
    if (titleRef.current) {
      setDraft((prev) => ({
        ...prev,
        title: titleRef.current?.innerText || '',
      }));
    }
  };

  const handleDescriptionChange = () => {
    if (descriptionRef.current) {
      setDraft((prev) => ({
        ...prev,
        description: descriptionRef.current?.innerText || '',
      }));
    }
  };

  const handleImageUpload = (type: 'logo' | 'headerImage', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      updateTheme({ [type]: result });
    };
    reader.readAsDataURL(file);
  };

  const dropZoneMessage = draft.fields.length ? 'Drag new fields here or edit existing ones' : 'Drop fields here to start building';

  const sortedForms = useMemo(
    () =>
      [...forms].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'published' ? -1 : 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [forms],
  );

  const refreshForms = async () => {
    try {
      const data = await db.getAllForms();
      setForms(data);
    } catch (error) {
      console.error('Failed to refresh forms:', error);
    }
  };

  const handleStatusChange = async (formId: string, status: 'published' | 'unpublished') => {
    if (!formId) {
      console.error('handleStatusChange: formId is missing');
      return;
    }
    console.log(`handleStatusChange: Updating form ${formId} to status ${status}`);
    try {
      await db.updateForm(formId, { status });
      console.log(`handleStatusChange: Successfully updated form ${formId} to ${status}`);
      await refreshForms();
    } catch (error) {
      console.error(`handleStatusChange: Failed to update form with id ${formId}`, error);
      alert('Failed to update form status');
    }
  };

  const handleDelete = async (formId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Form',
      message: 'Are you sure you want to delete this form? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await db.deleteForm(formId);
          await refreshForms();
        } catch (error) {
          console.error('Failed to delete form:', error);
          alert('Failed to delete form');
        }
      }
    });
  };

  const handleViewSubmissions = (form: PublishedForm) => {
    setSubmissionsModal({
      form,
      submissions: loadSubmissions(form.id),
    });
  };

  const handleExport = (form: PublishedForm) => {
    const submissions = loadSubmissions(form.id);
    if (!submissions.length) {
      alert('No submissions yet.');
      return;
    }
    const headers = form.fields.map((field) => field.label);
    const rows = submissions.map((submission) =>
      form.fields.map((field) => JSON.stringify(submission.values[field.id] || '')),
    );
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${form.slug}-submissions.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page google-shell">
      <div className="brand-bar">
        <div>
          <p className="brand-chip">globalservicex.in</p>
          <h2 className="workspace-title">Google Forms style intake workspace</h2>
          <p className="muted small">
            Mirroring the familiar Google Forms canvas so GlobalServiceX teams can publish internships faster.
          </p>
        </div>
        <div className="brand-actions">
          <button className="ghost secondary" onClick={() => navigate('/gsxi')} style={{ marginBottom: '0.5rem' }}>
            Dashboard
          </button>
          <button className="ghost secondary" onClick={handleLogout} style={{ marginBottom: '0.5rem' }}>
            Logout
          </button>
          <a href="https://globalservicex.in" target="_blank" rel="noreferrer" className="ghost secondary">
            Visit globalservicex.in
          </a>
          <span className="muted small accent-note">Only reference mandated by GlobalServiceX retained.</span>
        </div>
      </div>
      <header className="hero">
        <div>
          <p className="tag">Internship intake</p>
          <h1>Recreate a Google Form in minutes</h1>
          <p className="muted">
            Drag cards, tweak copy, and publish a polished GlobalServiceX-ready intake form without touching the original Google workspace.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => setThemeModalOpen(true)}>
            Customize Theme
          </button>
          <button className="ghost" onClick={() => setPreviewModalOpen(true)} disabled={!draft.fields.length}>
            Preview
          </button>
          <button className="primary" onClick={() => setPublishModalOpen(true)} disabled={!draft.fields.length}>
            Publish form
          </button>
        </div>
      </header>

      {shareUrl && (
        <div className="share-card">
          <strong>Live form link</strong>
          <div className="share-links">
            <p className="primary-link">{brandPreview}</p>
            <p className="muted small">Local preview: {shareUrl}</p>
          </div>
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
          style={{
            background: draft.theme?.backgroundColor || '#fcfaff',
            fontFamily: draft.theme?.textFont || 'Roboto',
            borderTopColor: draft.theme?.primaryColor || draft.theme?.headerColor || '#7e57c2',
          }}
        >
          {draft.theme?.headerImage && (
            <div style={{ width: '100%', margin: 0, padding: 0, display: 'block' }}>
              <img
                src={draft.theme.headerImage}
                alt="Header"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '200px',
                  objectFit: 'cover',
                  display: 'block',
                  margin: 0,
                  padding: 0,
                  border: 'none'
                }}
              />
            </div>
          )}
          <div className="form-header">
            {(draft.theme?.logo || draft.theme?.logoText) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                {draft.theme.logo && <img src={draft.theme.logo} alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />}
                {draft.theme.logoText && (
                  <h2 style={{ margin: 0, fontFamily: draft.theme.headerFont || 'Roboto', color: draft.theme.textColor || '#0f172a', fontSize: '1.3rem', fontWeight: 600 }}>
                    {draft.theme.logoText}
                  </h2>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div
                  ref={titleRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleTitleChange}
                  onBlur={handleTitleChange}
                  data-placeholder="Untitled form"
                  style={{
                    fontFamily: draft.theme?.headerFont || 'Roboto',
                    color: draft.theme?.textColor || '#0f172a',
                    fontSize: '1.75rem',
                    fontWeight: 600,
                    border: 'none',
                    padding: '0.5rem 0',
                    background: 'transparent',
                    outline: 'none',
                    flex: 1,
                    lineHeight: '1.4',
                    minHeight: '1.5rem',
                    WebkitUserSelect: 'text',
                    userSelect: 'text'
                  }}
                ></div>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', paddingTop: '0.5rem' }}>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '4px',
                      color: '#64748b',
                      fontSize: '0.9rem'
                    }}
                    title="Move section"
                  >
                    ↕
                  </button>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '4px',
                      color: '#64748b',
                      fontSize: '1rem'
                    }}
                    title="More options"
                  >
                    ⋮
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem 0', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    applyFormatting('bold');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Bold"
                >
                  B
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    applyFormatting('italic');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Italic"
                >
                  I
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    applyFormatting('underline');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    textDecoration: 'underline',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Underline"
                >
                  U
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const url = prompt('Enter URL:');
                    if (url) {
                      applyFormatting('createLink', url);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Link"
                >
                  🔗
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    applyFormatting('insertOrderedList');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    lineHeight: '1.1',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Numbered list"
                >
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
                    <span>1.</span>
                    <span>2.</span>
                    <span>3.</span>
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    applyFormatting('insertUnorderedList');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    lineHeight: '1.1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Bulleted list"
                >
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
                    <span>• —</span>
                    <span>• —</span>
                    <span>• —</span>
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    applyFormatting('strikeThrough');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    textDecoration: 'line-through',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '32px'
                  }}
                  title="Strikethrough"
                >
                  T
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  ref={descriptionRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleDescriptionChange}
                  data-placeholder="Form description"
                  style={{
                    fontFamily: draft.theme?.textFont || 'Roboto',
                    color: draft.theme?.textColor || '#64748b',
                    fontSize: '0.95rem',
                    border: 'none',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '0.5rem 0',
                    background: 'transparent',
                    outline: 'none',
                    width: '100%',
                    minHeight: '1.5rem',
                    WebkitUserSelect: 'text',
                    userSelect: 'text'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottomColor = draft.theme?.primaryColor || draft.theme?.headerColor || '#7e57c2';
                    e.currentTarget.style.borderBottomWidth = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottomColor = '#e2e8f0';
                    e.currentTarget.style.borderBottomWidth = '1px';
                    handleDescriptionChange();
                  }}
                ></div>
              </div>
            </div>
          </div>

          {!draft.fields.length && <p className="empty-state">{dropZoneMessage}</p>}

          <div className="field-stack">
            {draft.fields.map((field, index) => (
              <div key={field.id} className="field-card">
                <div className="field-meta">
                  <div className="field-headline">
                    <span className="field-chip">{field.type.replace(/([A-Z])/g, ' $1')}</span>
                    <input
                      value={field.label}
                      onChange={(event) => updateField(field.id, { label: event.target.value })}
                      style={{
                        fontFamily: draft.theme?.questionFont || 'Roboto',
                        color: draft.theme?.textColor || '#0f172a',
                      }}
                    />
                  </div>
                  <textarea
                    className="helper-text"
                    placeholder="Helper / description (optional)"
                    value={field.helperText || ''}
                    onChange={(event) => updateField(field.id, { helperText: event.target.value })}
                    style={{
                      fontFamily: draft.theme?.textFont || 'Roboto',
                      color: draft.theme?.textColor || '#64748b',
                    }}
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

                {choiceTypes.includes(field.type) && (
                  <div className="options">
                    <p className="muted small">Options</p>
                    {(field.options || []).map((option, optionIndex) => (
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
                          onClick={() =>
                            updateField(field.id, {
                              options: (field.options || []).filter((_, idx) => idx !== optionIndex),
                            })
                          }
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

                {gridTypes.includes(field.type) && (
                  <div className="grid-editor">
                    <div>
                      <p className="muted small">Rows</p>
                      {(field.rows || []).map((row, rowIndex) => (
                        <div key={rowIndex} className="option-row">
                          <input
                            value={row}
                            onChange={(event) => {
                              const nextRows = [...(field.rows || [])];
                              nextRows[rowIndex] = event.target.value;
                              updateField(field.id, { rows: nextRows });
                            }}
                          />
                          <button onClick={() => updateField(field.id, { rows: (field.rows || []).filter((_, idx) => idx !== rowIndex) })}>
                            ✕
                          </button>
                        </div>
                      ))}
                      <button className="ghost" onClick={() => updateField(field.id, { rows: [...(field.rows || []), `Row ${(field.rows || []).length + 1}`] })}>
                        Add row
                      </button>
                    </div>
                    <div>
                      <p className="muted small">Columns</p>
                      {(field.columns || []).map((column, columnIndex) => (
                        <div key={columnIndex} className="option-row">
                          <input
                            value={column}
                            onChange={(event) => {
                              const nextColumns = [...(field.columns || [])];
                              nextColumns[columnIndex] = event.target.value;
                              updateField(field.id, { columns: nextColumns });
                            }}
                          />
                          <button
                            onClick={() =>
                              updateField(field.id, { columns: (field.columns || []).filter((_, idx) => idx !== columnIndex) })
                            }
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        className="ghost"
                        onClick={() =>
                          updateField(field.id, { columns: [...(field.columns || []), `Column ${(field.columns || []).length + 1}`] })
                        }
                      >
                        Add column
                      </button>
                    </div>
                  </div>
                )}

                {field.type === 'linearScale' && (
                  <div className="scale-config">
                    <label>
                      Min
                      <input
                        type="number"
                        min={0}
                        max={(field.scale?.max ?? 5) - 1}
                        value={field.scale?.min ?? 1}
                        onChange={(event) =>
                          updateField(field.id, {
                            scale: {
                              ...field.scale,
                              min: Number(event.target.value),
                              max: field.scale?.max ?? 5,
                              minLabel: field.scale?.minLabel,
                              maxLabel: field.scale?.maxLabel,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Max
                      <input
                        type="number"
                        min={(field.scale?.min ?? 1) + 1}
                        max={10}
                        value={field.scale?.max ?? 5}
                        onChange={(event) =>
                          updateField(field.id, {
                            scale: {
                              ...field.scale,
                              min: field.scale?.min ?? 1,
                              max: Number(event.target.value),
                              minLabel: field.scale?.minLabel,
                              maxLabel: field.scale?.maxLabel,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Min label
                      <input
                        value={field.scale?.minLabel || ''}
                        onChange={(event) =>
                          updateField(field.id, {
                            scale: {
                              ...field.scale,
                              min: field.scale?.min ?? 1,
                              max: field.scale?.max ?? 5,
                              minLabel: event.target.value,
                              maxLabel: field.scale?.maxLabel,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Max label
                      <input
                        value={field.scale?.maxLabel || ''}
                        onChange={(event) =>
                          updateField(field.id, {
                            scale: {
                              ...field.scale,
                              min: field.scale?.min ?? 1,
                              max: field.scale?.max ?? 5,
                              minLabel: field.scale?.minLabel,
                              maxLabel: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                )}

                {field.type === 'rating' && (
                  <div className="rating-config">
                    <label>
                      Max stars
                      <input
                        type="number"
                        min={3}
                        max={10}
                        value={field.maxRating ?? 5}
                        onChange={(event) => updateField(field.id, { maxRating: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="history">
        <div className="history-header">
          <div>
            <h3>Form management</h3>
            <p className="muted small">Publish, unpublish, delete, or review submissions.</p>
          </div>
          <button className="ghost" onClick={() => window.open('/', '_blank')}>
            View candidate portal
          </button>
        </div>
        {!sortedForms.length && <p className="muted small">No forms created yet.</p>}
        <div className="history-list">
          {sortedForms.map((form, index) => {
            const currentFormId = form.id; // Capture form ID to ensure correct closure
            const currentStatus = form.status; // Capture current status
            return (
              <article key={currentFormId} className="history-card">
                <div className="history-meta">
                  <div>
                    <h4>{form.name}</h4>
                    <p className="muted small">
                      Live window: {formatDateTime(form.openAt)} → {formatDateTime(form.closeAt)}
                    </p>
                    <p className="muted small">{form.fields.length} fields</p>
                  </div>
                  <span className={`status-pill ${currentStatus}`}>{currentStatus}</span>
                </div>
                <div className="history-actions">
                  <button className="ghost" onClick={() => handleViewSubmissions(form)}>
                    View submissions
                  </button>
                  {currentStatus === 'published' ? (
                    <button
                      className="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Unpublish clicked for form: ${currentFormId}, name: ${form.name}, index: ${index}`);
                        handleStatusChange(currentFormId, 'unpublished');
                      }}
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      className="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Publish clicked for form: ${currentFormId}, name: ${form.name}, index: ${index}`);
                        handleStatusChange(currentFormId, 'published');
                      }}
                    >
                      Publish
                    </button>
                  )}
                  <button className="ghost" onClick={() => handleExport(form)}>
                    Export CSV
                  </button>
                  <button className="ghost danger" onClick={() => handleDelete(currentFormId)}>
                    Delete
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      setShareForm(form);
                      setShareModalOpen(true);
                    }}
                  >
                    Share link
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {publishModalOpen && (
        <PublishModal
          onClose={() => setPublishModalOpen(false)}
          onSubmit={handlePublish}
          disabled={!draft.fields.length}
        />
      )}
      {shareModalOpen && shareForm && (
        <ShareModal
          form={shareForm}
          onClose={() => {
            setShareModalOpen(false);
            setShareForm(null);
          }}
        />
      )}
      {submissionsModal.form && (
        <SubmissionsModal
          form={submissionsModal.form}
          submissions={submissionsModal.submissions}
          onClose={() => setSubmissionsModal({ form: null, submissions: [] })}
        />
      )}
      {themeModalOpen && (
        <ThemeModal
          theme={draft.theme}
          onUpdate={updateTheme}
          onImageUpload={handleImageUpload}
          onClose={() => setThemeModalOpen(false)}
        />
      )}
      {previewModalOpen && (
        <PreviewModal
          draft={draft}
          onUpdate={updateTheme}
          onImageUpload={handleImageUpload}
          onClose={() => setPreviewModalOpen(false)}
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
  onSubmit: (payload: { name: string; openAt: string; closeAt: string }) => void;
  disabled: boolean;
}) => {
  const [name, setName] = useState('');

  // Default: open now, close in 7 days
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [openAt, setOpenAt] = useState(formatDateTimeLocal(now));
  const [closeAt, setCloseAt] = useState(formatDateTimeLocal(sevenDaysLater));
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const openDate = new Date(openAt);
    const closeDate = new Date(closeAt);

    if (closeDate <= openDate) {
      setError('Close time must be after open time');
      return;
    }

    setError('');
    onSubmit({
      name,
      openAt: openDate.toISOString(),
      closeAt: closeDate.toISOString()
    });
  };

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
          Form opens at
          <input
            type="datetime-local"
            value={openAt}
            onChange={(event) => {
              setOpenAt(event.target.value);
              setError('');
            }}
          />
        </label>
        <label>
          Form closes at
          <input
            type="datetime-local"
            value={closeAt}
            onChange={(event) => {
              setCloseAt(event.target.value);
              setError('');
            }}
          />
        </label>
        {error && <p className="error" style={{ color: '#ef4444', fontSize: '0.9rem', margin: '0.5rem 0' }}>{error}</p>}
        <p className="muted small">A unique public link will be generated automatically.</p>
        <footer>
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={disabled || !name || !openAt || !closeAt}
            onClick={handleSubmit}
          >
            Publish now
          </button>
        </footer>
      </div>
    </div>
  );
};

const ShareModal = ({
  form,
  onClose,
}: {
  form: PublishedForm;
  onClose: () => void;
}) => {
  // Generate the public form page URL where the form is published
  const publicUrl = `${window.location.origin}/form/${form.slug}`;
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = publicUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleWhatsAppShare = () => {
    const message = `Check out this internship application form: ${form.name}\n${publicUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEmailShare = () => {
    const subject = `Internship Application: ${form.name}`;
    const body = `Check out this internship application form:\n\n${form.name}\n${publicUrl}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const handleSMSShare = () => {
    const message = `Check out this internship application form: ${form.name} - ${publicUrl}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.location.href = smsUrl;
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <header>
          <h3>Share Form Link</h3>
          <button onClick={onClose}>✕</button>
        </header>
        <div style={{ padding: '1.5rem 0' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, marginBottom: '1rem' }}>
            Form Link
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={publicUrl}
                readOnly
                onClick={(e) => {
                  (e.target as HTMLInputElement).select();
                  handleCopyLink();
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  minWidth: '200px',
                }}
              />
              <button
                className={copied ? 'primary' : 'ghost'}
                onClick={handleCopyLink}
                style={{ minWidth: '100px' }}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ghost"
                style={{ textDecoration: 'none', minWidth: '100px', textAlign: 'center' }}
              >
                Open link
              </a>
            </div>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#64748b' }}>Share via:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="ghost"
                onClick={handleWhatsAppShare}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  justifyContent: 'flex-start',
                  padding: '0.75rem 1rem',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>📱</span>
                <span>WhatsApp</span>
              </button>
              <button
                className="ghost"
                onClick={handleEmailShare}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  justifyContent: 'flex-start',
                  padding: '0.75rem 1rem',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>✉️</span>
                <span>Email</span>
              </button>
              <button
                className="ghost"
                onClick={handleSMSShare}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  justifyContent: 'flex-start',
                  padding: '0.75rem 1rem',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>💬</span>
                <span>SMS/Message</span>
              </button>
            </div>
          </div>
        </div>
        <footer>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

const ThemeModal = ({
  theme,
  onUpdate,
  onImageUpload,
  onClose,
}: {
  theme?: FormTheme;
  onUpdate: (updates: Partial<FormTheme>) => void;
  onImageUpload: (type: 'logo' | 'headerImage', file: File) => void;
  onClose: () => void;
}) => {
  const fonts = ['Roboto', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];

  // Use theme prop directly, with defaults
  const currentTheme: FormTheme = {
    headerColor: '#facc15',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    primaryColor: '#673ab7',
    headerFont: 'Roboto',
    questionFont: 'Roboto',
    textFont: 'Roboto',
    ...theme,
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Customize Theme</h3>
          <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>Header Image</h4>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageUpload('headerImage', file);
              }}
              style={{ marginBottom: '0.5rem', width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            />
            {currentTheme.headerImage && (
              <div style={{ position: 'relative', display: 'inline-block', marginTop: '0.5rem' }}>
                <img src={currentTheme.headerImage} alt="Header" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '150px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                <button
                  onClick={() => onUpdate({ headerImage: undefined })}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600 }}>Logo</h4>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageUpload('logo', file);
              }}
              style={{ marginBottom: '0.5rem', width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            />
            {currentTheme.logo && (
              <div style={{ position: 'relative', display: 'inline-block', marginTop: '0.5rem' }}>
                <img src={currentTheme.logo} alt="Logo" style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <button
                  onClick={() => onUpdate({ logo: undefined })}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                  title="Remove logo"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Logo Text
            <input
              type="text"
              value={currentTheme.logoText || ''}
              onChange={(e) => onUpdate({ logoText: e.target.value })}
              placeholder="e.g., ZERO'S SCHOOL"
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '1rem' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Header Color
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="color"
                value={currentTheme.headerColor || '#facc15'}
                onChange={(e) => onUpdate({ headerColor: e.target.value })}
                style={{ width: '70px', height: '45px', cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2px' }}
              />
              <input
                type="text"
                value={currentTheme.headerColor || '#facc15'}
                onChange={(e) => onUpdate({ headerColor: e.target.value })}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Background Color
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="color"
                value={currentTheme.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                style={{ width: '70px', height: '45px', cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2px' }}
              />
              <input
                type="text"
                value={currentTheme.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Primary Color
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="color"
                value={currentTheme.primaryColor || '#673ab7'}
                onChange={(e) => onUpdate({ primaryColor: e.target.value })}
                style={{ width: '70px', height: '45px', cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2px' }}
              />
              <input
                type="text"
                value={currentTheme.primaryColor || '#673ab7'}
                onChange={(e) => onUpdate({ primaryColor: e.target.value })}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Text Color
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="color"
                value={currentTheme.textColor || '#0f172a'}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                style={{ width: '70px', height: '45px', cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2px' }}
              />
              <input
                type="text"
                value={currentTheme.textColor || '#0f172a'}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Header Font
            <select
              value={currentTheme.headerFont || 'Roboto'}
              onChange={(e) => onUpdate({ headerFont: e.target.value })}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', fontSize: '1rem', background: 'white', cursor: 'pointer' }}
            >
              {fonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Question Font
            <select
              value={currentTheme.questionFont || 'Roboto'}
              onChange={(e) => onUpdate({ questionFont: e.target.value })}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', fontSize: '1rem', background: 'white', cursor: 'pointer' }}
            >
              {fonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
            Text Font
            <select
              value={currentTheme.textFont || 'Roboto'}
              onChange={(e) => onUpdate({ textFont: e.target.value })}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', fontSize: '1rem', background: 'white', cursor: 'pointer' }}
            >
              {fonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>
        </div>
        <footer style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="ghost" onClick={onClose} style={{ padding: '0.6rem 1.2rem' }}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => {
              // Changes are already saved via onUpdate, but we ensure state is synced
              onClose();
            }}
            style={{ padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg, #14b8a6, #06b6d4, #3b82f6)', color: 'white', boxShadow: '0 10px 30px rgba(20, 184, 166, 0.4)' }}
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
};

const PreviewModal = ({
  draft,
  onUpdate,
  onImageUpload,
  onClose,
}: {
  draft: DraftFormState;
  onUpdate: (updates: Partial<FormTheme>) => void;
  onImageUpload: (type: 'logo' | 'headerImage', file: File) => void;
  onClose: () => void;
}) => {
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const theme = draft.theme || {};
  const themeStyles = {
    '--header-color': theme.headerColor || '#673ab7',
    '--bg-color': theme.backgroundColor || '#ffffff',
    '--text-color': theme.textColor || '#0f172a',
    '--primary-color': theme.primaryColor || '#673ab7',
    '--header-font': theme.headerFont || 'Roboto',
    '--question-font': theme.questionFont || 'Roboto',
    '--text-font': theme.textFont || 'Roboto',
  } as React.CSSProperties;

  const fonts = ['Roboto', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];

  const currentTheme: FormTheme = {
    headerColor: '#facc15',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    primaryColor: '#673ab7',
    headerFont: 'Roboto',
    questionFont: 'Roboto',
    textFont: 'Roboto',
    ...theme,
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()} style={{ ...themeStyles, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh', borderRadius: '8px' }}>
        <header style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'white', position: 'relative', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Form Preview</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowThemeEditor(!showThemeEditor)}
              style={{
                background: showThemeEditor ? '#14b8a6' : 'transparent',
                border: '1px solid #14b8a6',
                color: showThemeEditor ? 'white' : '#14b8a6',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              {showThemeEditor ? 'Hide Theme' : 'Customize Theme'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b', padding: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </header>
        {showThemeEditor && (
          <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', overflowY: 'auto', maxHeight: '40vh', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Header Color
                  <input
                    type="color"
                    value={currentTheme.headerColor || '#facc15'}
                    onChange={(e) => onUpdate({ headerColor: e.target.value })}
                    style={{ width: '100%', height: '40px', cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '6px' }}
                  />
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Background Color
                  <input
                    type="color"
                    value={currentTheme.backgroundColor || '#ffffff'}
                    onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                    style={{ width: '100%', height: '40px', cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '6px' }}
                  />
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Primary Color
                  <input
                    type="color"
                    value={currentTheme.primaryColor || '#673ab7'}
                    onChange={(e) => onUpdate({ primaryColor: e.target.value })}
                    style={{ width: '100%', height: '40px', cursor: 'pointer', border: '2px solid #e2e8f0', borderRadius: '6px' }}
                  />
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Header Font
                  <select
                    value={currentTheme.headerFont || 'Roboto'}
                    onChange={(e) => onUpdate({ headerFont: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem', background: 'white', cursor: 'pointer' }}
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Question Font
                  <select
                    value={currentTheme.questionFont || 'Roboto'}
                    onChange={(e) => onUpdate({ questionFont: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem', background: 'white', cursor: 'pointer' }}
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Text Font
                  <select
                    value={currentTheme.textFont || 'Roboto'}
                    onChange={(e) => onUpdate({ textFont: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem', background: 'white', cursor: 'pointer' }}
                  >
                    {fonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                Logo Text
                <input
                  type="text"
                  value={currentTheme.logoText || ''}
                  onChange={(e) => onUpdate({ logoText: e.target.value })}
                  placeholder="e.g., GLOBALSERVICEX"
                  style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Header Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImageUpload('headerImage', file);
                    }}
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
                  Logo Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImageUpload('logo', file);
                    }}
                    style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                  />
                </label>
              </div>
            </div>
          </div >
        )}
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, paddingRight: '0.5rem', background: theme.backgroundColor || '#ffffff' }}>
          {theme.headerImage && (
            <div style={{ width: '100%', lineHeight: 0 }}>
              <img
                src={theme.headerImage}
                alt="Header"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '250px',
                  minHeight: '150px',
                  objectFit: 'cover',
                  display: 'block',
                  margin: 0,
                  padding: 0,
                  border: 'none'
                }}
              />
            </div>
          )}
          <div style={{ padding: '1.5rem 2rem', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
            {(theme.logo || theme.logoText) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                {theme.logo && <img src={theme.logo} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />}
                {theme.logoText && (
                  <h2 style={{ margin: 0, fontFamily: theme.headerFont || 'Roboto', color: theme.textColor || '#0f172a', fontSize: '1.5rem', fontWeight: 600 }}>
                    {theme.logoText}
                  </h2>
                )}
              </div>
            )}
            <h1 style={{ fontFamily: theme.headerFont || 'Roboto', color: theme.textColor || '#0f172a', fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              {draft.title}
            </h1>
            <p style={{ fontFamily: theme.textFont || 'Roboto', color: theme.textColor || '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              {draft.description}
            </p>
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '1.5rem 0' }} />
            {draft.fields.map((field) => (
              <div key={field.id} style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                <label style={{ fontFamily: theme.questionFont || 'Roboto', fontWeight: 600, color: theme.textColor || '#0f172a', fontSize: '0.95rem', display: 'block', marginBottom: '0.75rem' }}>
                  {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                {field.type === 'shortText' && (
                  <input
                    type="text"
                    placeholder="Your answer"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      marginTop: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '0.95rem',
                      fontFamily: theme.textFont || 'Roboto'
                    }}
                    disabled
                  />
                )}
                {field.type === 'longText' && (
                  <textarea
                    placeholder="Your answer"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      marginTop: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '0.95rem',
                      fontFamily: theme.textFont || 'Roboto',
                      resize: 'vertical'
                    }}
                    disabled
                  />
                )}
                {field.type === 'email' && (
                  <input
                    type="email"
                    placeholder="Your answer"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      marginTop: '0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '0.95rem',
                      fontFamily: theme.textFont || 'Roboto'
                    }}
                    disabled
                  />
                )}
                {field.type === 'multipleChoice' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    {(field.options || []).map((opt) => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontFamily: theme.textFont || 'Roboto', fontSize: '0.95rem' }}>
                        <input type="radio" name={field.id} disabled /> {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <footer style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose} style={{ padding: '0.6rem 1.2rem' }}>
            Close
          </button>
        </footer>
      </div >
    </div >
  );
};

const SubmissionsModal = ({
  form,
  submissions,
  onClose,
}: {
  form: PublishedForm;
  submissions: FormSubmission[];
  onClose: () => void;
}) => {
  const [localSubmissions, setLocalSubmissions] = useState(submissions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);
  const [detailEditValues, setDetailEditValues] = useState<Record<string, string>>({});

  const handleExportToExcel = () => {
    if (!localSubmissions.length) {
      alert('No submissions yet.');
      return;
    }

    const headers = ['Timestamp', ...form.fields.map((field) => field.label)];
    const rows = localSubmissions.map((submission) => [
      formatDateTime(submission.submittedAt),
      ...form.fields.map((field) => {
        const value = submission.values[field.id] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${form.slug}-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (submissionId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Submission',
      message: 'Are you sure you want to delete this submission? The user will be able to apply again.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await db.deleteSubmission(submissionId);
          setLocalSubmissions(localSubmissions.filter(s => s.id !== submissionId));
          alert('Submission deleted successfully. User can now apply again.');
        } catch (error) {
          console.error('Failed to delete submission:', error);
          alert('Failed to delete submission. Please try again.');
        }
      }
    });
  };

  const handleEdit = (submission: FormSubmission) => {
    setEditingId(submission.id);
    setEditValues(submission.values);
  };

  const handleSaveEdit = async (submissionId: string) => {
    try {
      await db.updateSubmission(submissionId, editValues);
      setLocalSubmissions(localSubmissions.map(s =>
        s.id === submissionId ? { ...s, values: editValues } : s
      ));
      setEditingId(null);
      setEditValues({});
      alert('Submission updated successfully.');
    } catch (error) {
      console.error('Failed to update submission:', error);
      alert('Failed to update submission. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  return (
    <>
      <div className="modal-backdrop" role="dialog" aria-modal="true">
        <div className="modal large" style={{ maxWidth: '1100px' }}>
          <header>
            <div>
              <h3>{form.name} submissions</h3>
              <p className="muted small">{localSubmissions.length} response(s)</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="ghost" onClick={handleExportToExcel} style={{ fontSize: '0.9rem' }}>
                View in Sheets
              </button>
              <button onClick={onClose}>✕</button>
            </div>
          </header>
          {!localSubmissions.length && <p className="muted small">No one has applied yet.</p>}
          {!!localSubmissions.length && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ marginBottom: '1rem' }}>Individual Responses</h4>
                <div className="submissions-table" style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#facc15', zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #673ab7', fontWeight: 600, color: '#0f172a' }}>Timestamp</th>
                        {form.fields.map((field) => (
                          <th key={field.id} style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #673ab7', fontWeight: 600, color: '#0f172a' }}>{field.label}</th>
                        ))}
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #673ab7', fontWeight: 600, color: '#0f172a', minWidth: '120px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localSubmissions.map((submission, idx) => (
                        <tr key={submission.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>{formatDateTime(submission.submittedAt)}</td>
                          {form.fields.map((field) => (
                            <td key={field.id} style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                              {editingId === submission.id ? (
                                <input
                                  type="text"
                                  value={editValues[field.id] || ''}
                                  onChange={(e) => setEditValues({ ...editValues, [field.id]: e.target.value })}
                                  style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                />
                              ) : (
                                field.label.toLowerCase().includes('name') ? (
                                  <button
                                    onClick={() => {
                                      setViewingSubmission(submission);
                                      setDetailEditValues(submission.values);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#673ab7',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      padding: 0,
                                      textDecoration: 'underline',
                                      textAlign: 'left',
                                      fontSize: 'inherit'
                                    }}
                                  >
                                    {submission.values[field.id] || '—'}
                                  </button>
                                ) : (
                                  submission.values[field.id] || '—'
                                )
                              )}
                            </td>
                          ))}
                          <td style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                            {editingId === submission.id ? (
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button
                                  className="ghost"
                                  onClick={() => handleSaveEdit(submission.id)}
                                  style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                                >
                                  Save
                                </button>
                                <button
                                  className="ghost"
                                  onClick={handleCancelEdit}
                                  style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                  className="ghost"
                                  onClick={() => {
                                    setViewingSubmission(submission);
                                    setDetailEditValues(submission.values);
                                  }}
                                  style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                                >
                                  View
                                </button>
                                <button
                                  className="ghost"
                                  onClick={() => handleEdit(submission)}
                                  style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="ghost danger"
                                  onClick={() => handleDelete(submission.id)}
                                  style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed View Modal */}
      {
        viewingSubmission && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ zIndex: 1100 }}>
            <div className="modal" style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <header style={{ borderBottom: '1px solid #e2e8f0', padding: '1.5rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Submission Details</h3>
                    <p className="muted small" style={{ margin: 0 }}>
                      Submitted: {formatDateTime(viewingSubmission.submittedAt)}
                    </p>
                  </div>
                  <button onClick={() => setViewingSubmission(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
                    ✕
                  </button>
                </div>
              </header>

              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                {form.fields.map((field) => (
                  <div key={field.id} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <label style={{ fontWeight: 600, color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>
                      {field.label}
                      {field.required && <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>}
                    </label>
                    <input
                      type="text"
                      value={detailEditValues[field.id] || ''}
                      onChange={(e) => setDetailEditValues({ ...detailEditValues, [field.id]: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                ))}
              </div>

              <footer style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexShrink: 0 }}>
                <button
                  className="ghost danger"
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this submission? The user will be able to apply again.')) {
                      try {
                        await db.deleteSubmission(viewingSubmission.id);
                        setLocalSubmissions(localSubmissions.filter(s => s.id !== viewingSubmission.id));
                        setViewingSubmission(null);
                        alert('Submission deleted successfully.');
                      } catch (error) {
                        console.error('Failed to delete:', error);
                        alert('Failed to delete submission.');
                      }
                    }
                  }}
                  style={{ padding: '0.6rem 1.2rem' }}
                >
                  Delete Submission
                </button>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="ghost"
                    onClick={() => setViewingSubmission(null)}
                    style={{ padding: '0.6rem 1.2rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary"
                    onClick={async () => {
                      try {
                        await db.updateSubmission(viewingSubmission.id, detailEditValues);
                        setLocalSubmissions(localSubmissions.map(s =>
                          s.id === viewingSubmission.id ? { ...s, values: detailEditValues } : s
                        ));
                        setViewingSubmission(null);
                        alert('Submission updated successfully.');
                      } catch (error) {
                        console.error('Failed to update:', error);
                        alert('Failed to update submission.');
                      }
                    }}
                    style={{ padding: '0.6rem 1.5rem' }}
                  >
                    Save Changes
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )
      }

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};


export default BuilderPage;
