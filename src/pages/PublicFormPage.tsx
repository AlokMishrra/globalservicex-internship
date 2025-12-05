import { useEffect, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FormField, PublishedForm } from '../types';
import { formatDateTime, isFormClosed, isFormLive } from '../utils/form';
import { db } from '../services/db';
import { hasApplicantSubmitted } from '../utils/storage';

type FieldValue = string | string[] | Record<string, string> | Record<string, string[]>;

const getLocalSubmissionKey = (formId: string) => `internship_submission_${formId}`;

const PublicFormPage = () => {
  const params = useParams<{ slug: string }>();
  const [status, setStatus] = useState<'idle' | 'success' | 'duplicate'>('idle');
  const [form, setForm] = useState<PublishedForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const fetchForm = async () => {
      if (!params.slug) return;
      try {
        const data = await db.getFormBySlug(params.slug);
        setForm(data);
        setLocked(localStorage.getItem(getLocalSubmissionKey(data.id)) === 'yes');
      } catch (error) {
        console.error('Failed to load form:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="page public-shell">
        <div className="public-hero">
          <p>Loading form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="page public-shell">
        <div className="public-hero">
          <p className="brand-chip subtle">globalservicex.in</p>
          <h2>Form not found</h2>
          <p className="muted small">This link may be incorrect or expired.</p>
          <Link to="/" className="ghost secondary">
            Back to opportunities
          </Link>
        </div>
      </div>
    );
  }

  const live = isFormLive(form);
  const closed = isFormClosed(form);
  const emailField = form.fields.find((field) => field.type === 'email');
  const localSubmissionKey = getLocalSubmissionKey(form.id);

  const deriveApplicantKey = () => {
    if (!emailField) return undefined;
    const value = values[emailField.id];
    return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked) return;
    const nextErrors: Record<string, string> = {};
    form.fields.forEach((field) => {
      if (field.required && isEmpty(field, values[field.id])) {
        nextErrors[field.id] = 'Required';
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const applicantKey = deriveApplicantKey();
    if (applicantKey && hasApplicantSubmitted(form.id, applicantKey)) {
      setStatus('duplicate');
      setErrors((prev) => ({
        ...prev,
        ...(emailField ? { [emailField.id]: 'You already applied with this email.' } : {}),
      }));
      return;
    }

    try {
      await db.createSubmission({
        formId: form.id,
        values: serializeValues(form.fields, values),
        applicantKey,
      });
      localStorage.setItem(localSubmissionKey, 'yes');
      setLocked(true);
      setStatus('success');
      setValues({});
      event.currentTarget.reset();
    } catch (error) {
      console.error('Failed to submit form:', error);
      alert('Failed to submit form. Please try again.');
    }
  };

  if (closed) {
    return (
      <div className="page public-shell">
        <div className="public-hero">
          <p className="brand-chip subtle">globalservicex.in</p>
          <h2>{form.name}</h2>
          <p className="muted">This form is closed. Window ended {formatDateTime(form.closeAt)}.</p>
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="page public-shell">
        <div className="public-hero">
          <p className="brand-chip subtle">globalservicex.in</p>
          <h2>{form.name}</h2>
          <p className="muted">Form is scheduled to open at {formatDateTime(form.openAt)}.</p>
        </div>
      </div>
    );
  }

  if (locked && status !== 'success') {
    return (
      <div className="page public-shell">
        <div className="public-hero">
          <p className="brand-chip subtle">globalservicex.in</p>
          <h2>{form.name}</h2>
          <p className="muted small">
            You have already submitted this form. Contact the admin team if you need to update your application.
          </p>
          <Link to="/" className="ghost secondary">
            Back to opportunities
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="page public-shell">
        <div className="public-hero">
          <p className="brand-chip subtle">globalservicex.in</p>
          <h2>{form.name}</h2>
          <p className="success-banner">Thanks! Your response was recorded.</p>
          <Link to="/" className="ghost secondary">
            Explore more opportunities
          </Link>
        </div>
      </div>
    );
  }

  const theme = form.theme || {};

  return (
    <div className="page public-shell" style={{ background: theme.backgroundColor || '#f5f6fb', padding: 0 }}>
      {theme.headerImage && (
        <div style={{ width: '100%', margin: 0, padding: 0, display: 'block', overflow: 'hidden' }}>
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
      <div className="public-hero" style={{ background: theme.backgroundColor || '#ffffff', marginTop: theme.headerImage ? '1.5rem' : '0' }}>
        {(theme.logo || theme.logoText) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            {theme.logo && <img src={theme.logo} alt="Logo" style={{ width: '60px', height: '60px', borderRadius: '8px' }} />}
            {theme.logoText && (
              <h2 style={{ margin: 0, fontFamily: theme.headerFont || 'Roboto', color: theme.textColor || '#0f172a' }}>
                {theme.logoText}
              </h2>
            )}
          </div>
        )}
        <h2 style={{ fontFamily: theme.headerFont || 'Roboto', color: theme.textColor || '#0f172a' }}>{form.name}</h2>
        {form.description && (
          <p className="muted small" style={{ fontFamily: theme.textFont || 'Roboto' }}>
            {form.description}
          </p>
        )}
        <p className="muted small" style={{ fontFamily: theme.textFont || 'Roboto' }}>
          Open window: {formatDateTime(form.openAt)} → {formatDateTime(form.closeAt)}
        </p>
        <p className="muted small" style={{ fontFamily: theme.textFont || 'Roboto', color: '#ef4444' }}>
          * Indicates required question
        </p>
      </div>
      <form className="public-card" onSubmit={handleSubmit} style={{ background: theme.backgroundColor || '#ffffff' }}>
        <p className="muted" style={{ fontFamily: theme.textFont || 'Roboto' }}>{form.fields.length} questions</p>
        <hr />
        {form.fields.map((field) => (
          <FormFieldControl
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.id]: value }))}
            error={errors[field.id]}
            theme={theme}
          />
        ))}
        {status === 'duplicate' && <p className="error">You have already applied with these details.</p>}
        <button
          className="primary"
          type="submit"
          style={{
            background: theme.primaryColor || '#673ab7',
            fontFamily: theme.questionFont || 'Roboto',
          }}
        >
          Submit form
        </button>
        <p className="muted small" style={{ fontFamily: theme.textFont || 'Roboto' }}>
          The name, email, and photo associated with your account will be recorded when you upload files and submit this form.
        </p>
      </form>
    </div>
  );
};

const FormFieldControl = ({
  field,
  value,
  onChange,
  error,
  theme,
}: {
  field: FormField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  error?: string;
  theme?: any;
}) => {
  const baseProps = {
    required: field.required,
    placeholder: field.placeholder,
  };

  let control: JSX.Element;
  switch (field.type) {
    case 'email':
      control = (
        <input
          {...baseProps}
          type="email"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case 'number':
      control = (
        <input
          {...baseProps}
          type="number"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case 'longText':
      control = (
        <textarea
          {...baseProps}
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case 'dropdown':
      control = (
        <select
          {...baseProps}
          value={(value as string) || ''}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select...</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    case 'multipleChoice':
      control = (
        <div className="choice-stack">
          {(field.options || []).map((option) => (
            <label key={option} className="choice-row">
              <input
                type="radio"
                name={field.id}
                checked={value === option}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
        </div>
      );
      break;
    case 'checkboxes':
      control = (
        <div className="choice-stack">
          {(field.options || []).map((option) => {
            const list = Array.isArray(value) ? value : [];
            const checked = list.includes(option);
            return (
              <label key={option} className="choice-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...(list || []), option]);
                    } else {
                      onChange((list || []).filter((item) => item !== option));
                    }
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      );
      break;
    case 'fileUpload':
      control = (
        <input
          {...baseProps}
          type="file"
          onChange={(event) => onChange(event.target.files?.[0]?.name || '')}
        />
      );
      break;
    case 'linearScale':
      control = (
        <div className="scale-stack">
          <span>{field.scale?.minLabel}</span>
          <input
            type="range"
            min={field.scale?.min ?? 1}
            max={field.scale?.max ?? 5}
            value={typeof value === 'string' ? value : field.scale?.min ?? 1}
            onChange={(event) => onChange(event.target.value)}
          />
          <span>{field.scale?.maxLabel}</span>
        </div>
      );
      break;
    case 'rating':
      control = (
        <div className="rating-stack">
          {Array.from({ length: field.maxRating ?? 5 }).map((_, index) => {
            const ratingValue = String(index + 1);
            const active = value === ratingValue;
            return (
              <button
                type="button"
                key={ratingValue}
                className={`star ${active ? 'active' : ''}`}
                onClick={() => onChange(ratingValue)}
              >
                ★
              </button>
            );
          })}
        </div>
      );
      break;
    case 'multipleChoiceGrid':
      control = (
        <div className="grid-table">
          <table>
            <thead>
              <tr>
                <th />
                {(field.columns || []).map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(field.rows || []).map((row) => {
                const rowValue = (value as Record<string, string>) || {};
                return (
                  <tr key={row}>
                    <td>{row}</td>
                    {(field.columns || []).map((column) => (
                      <td key={column}>
                        <input
                          type="radio"
                          name={`${field.id}-${row}`}
                          checked={rowValue[row] === column}
                          onChange={() => onChange({ ...rowValue, [row]: column })}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      break;
    case 'checkboxGrid':
      control = (
        <div className="grid-table">
          <table>
            <thead>
              <tr>
                <th />
                {(field.columns || []).map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(field.rows || []).map((row) => {
                const rowValue = ((value as Record<string, string[]>) || {})[row] || [];
                return (
                  <tr key={row}>
                    <td>{row}</td>
                    {(field.columns || []).map((column) => {
                      const checked = rowValue.includes(column);
                      return (
                        <td key={column}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const nextRow = event.target.checked
                                ? [...rowValue, column]
                                : rowValue.filter((item) => item !== column);
                              const nextValue = { ...(value as Record<string, string[]>) };
                              nextValue[row] = nextRow;
                              onChange(nextValue);
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      break;
    case 'date':
      control = (
        <input
          {...baseProps}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case 'time':
      control = (
        <input
          {...baseProps}
          type="time"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    default:
      control = (
        <input
          {...baseProps}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }

  return (
    <label className="public-field">
      <div className="label-row">
        <div>
          <span style={{ fontFamily: theme?.questionFont || 'Roboto' }}>{field.label}</span>
          {field.required && <span className="required">*</span>}
        </div>
        {field.helperText && <span className="helper" style={{ fontFamily: theme?.textFont || 'Roboto' }}>{field.helperText}</span>}
      </div>
      {control}
      {error && <span className="error">{error}</span>}
    </label>
  );
};

const isEmpty = (field: FormField, value: FieldValue | undefined) => {
  if (value === undefined) return true;
  switch (field.type) {
    case 'checkboxes':
      return !Array.isArray(value) || value.length === 0;
    case 'multipleChoiceGrid':
      if (!value || typeof value !== 'object') return true;
      const rowValue = value as Record<string, string>;
      return (field.rows || []).some((row) => !rowValue[row]);
    case 'checkboxGrid':
      if (!value || typeof value !== 'object') return true;
      const map = value as Record<string, string[]>;
      return (field.rows || []).some((row) => !map[row]?.length);
    default:
      return value === '' || (Array.isArray(value) && !value.length);
  }
};

const serializeValues = (fields: FormField[], values: Record<string, FieldValue>): Record<string, string> => {
  const result: Record<string, string> = {};
  fields.forEach((field) => {
    const value = values[field.id];
    if (Array.isArray(value)) {
      result[field.id] = value.join(', ');
    } else if (value && typeof value === 'object') {
      result[field.id] = JSON.stringify(value);
    } else {
      result[field.id] = (value as string) || '';
    }
  });
  return result;
};

export default PublicFormPage;

