import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { FormField } from '../types';
import { formatDateTime, isFormClosed, isFormLive } from '../utils/form';
import { findPublishedForm } from '../utils/storage';

const PublicFormPage = () => {
  const params = useParams<{ slug: string }>();
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const form = useMemo(() => findPublishedForm(params.slug || ''), [params.slug]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!form) {
    return (
      <div className="page">
        <div className="public-card">
          <h2>Form not found</h2>
          <p className="muted">This link may be incorrect or expired.</p>
          <Link to="/" className="primary-link">
            Back to builder
          </Link>
        </div>
      </div>
    );
  }

  const live = isFormLive(form);
  const closed = isFormClosed(form);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    form.fields.forEach((field) => {
      if (field.required && !values[field.id]) {
        nextErrors[field.id] = 'Required';
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStatus('success');
    event.currentTarget.reset();
  };

  if (closed) {
    return (
      <div className="page">
        <div className="public-card">
          <h2>{form.name}</h2>
          <p className="muted">This form is closed. Window ended {formatDateTime(form.closeAt)}.</p>
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className="page">
        <div className="public-card">
          <h2>{form.name}</h2>
          <p className="muted">Form is scheduled to open at {formatDateTime(form.openAt)}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="public-card" onSubmit={handleSubmit}>
        <h2>{form.name}</h2>
        <p className="muted">{form.fields.length} required responses</p>
        <hr />
        {form.fields.map((field) => (
          <FormFieldControl
            key={field.id}
            field={field}
            value={values[field.id] || ''}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.id]: value }))}
            error={errors[field.id]}
          />
        ))}
        {status === 'success' && <p className="success-banner">Thanks! Your response was recorded.</p>}
        <button className="primary" type="submit">
          Submit form
        </button>
        <p className="muted small">Open until {formatDateTime(form.closeAt)}</p>
      </form>
    </div>
  );
};

const FormFieldControl = ({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) => {
  const commonProps = {
    required: field.required,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(event.target.value),
    placeholder: field.placeholder,
  };

  let control: JSX.Element;
  switch (field.type) {
    case 'longText':
      control = <textarea {...commonProps} rows={4} />;
      break;
    case 'dropdown':
      control = (
        <select {...commonProps}>
          <option value="">Select...</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    case 'email':
      control = <input {...commonProps} type="email" />;
      break;
    case 'number':
      control = <input {...commonProps} type="number" />;
      break;
    case 'date':
      control = <input {...commonProps} type="date" />;
      break;
    default:
      control = <input {...commonProps} type="text" />;
  }

  return (
    <label className="public-field">
      <div className="label-row">
        <span>{field.label}</span>
        {field.required && <span className="required">*</span>}
      </div>
      {control}
      {error && <span className="error">{error}</span>}
    </label>
  );
};

export default PublicFormPage;

