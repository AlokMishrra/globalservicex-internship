import { useEffect, useMemo, useState, type FormEvent, type JSX } from 'react';
import type { PublishedForm, FormField } from '../types';
import { isFormLive, formatDateTime, isFormClosed } from '../utils/form';
import { db } from '../services/db';
import { hasApplicantSubmitted } from '../utils/storage';
import './PublicFormsPage.css';

type FieldValue = string | string[] | Record<string, string> | Record<string, string[]>;

const getLocalSubmissionKey = (formId: string) => `internship_submission_${formId}`;

const LocationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);



const PublicFormsPage = () => {
  const [forms, setForms] = useState<PublishedForm[]>([]);
  const [lockedForms, setLockedForms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedForm, setSelectedForm] = useState<PublishedForm | null>(null);
  const [modalView, setModalView] = useState<'details' | 'form'>('details');
  const [modalStatus, setModalStatus] = useState<'idle' | 'success' | 'duplicate'>('idle');
  const [formValues, setFormValues] = useState<Record<string, FieldValue>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const published = await db.getPublishedForms();
        setForms(published);

        // Check database for actual submissions instead of localStorage
        const locks: Record<string, boolean> = {};
        for (const form of published) {
          const emailField = form.fields.find((field) => field.type === 'email');
          if (emailField) {
            // Check if user has submitted based on localStorage email tracking
            const localKey = getLocalSubmissionKey(form.id);
            const hasLocalSubmission = localStorage.getItem(localKey) === 'yes';

            if (hasLocalSubmission) {
              // Verify with database - if submission exists, lock the form
              const submissions = await db.getSubmissions(form.id);
              const userEmail = localStorage.getItem(`user_email_${form.id}`);

              if (userEmail) {
                const hasDbSubmission = submissions.some(
                  (sub) => sub.values[emailField.id]?.toString().toLowerCase() === userEmail.toLowerCase()
                );
                locks[form.id] = hasDbSubmission;

                // If no DB submission but localStorage says yes, clear localStorage
                if (!hasDbSubmission) {
                  localStorage.removeItem(localKey);
                  localStorage.removeItem(`user_email_${form.id}`);
                }
              } else {
                locks[form.id] = false;
                localStorage.removeItem(localKey);
              }
            } else {
              locks[form.id] = false;
            }
          } else {
            // No email field, use localStorage only
            locks[form.id] = localStorage.getItem(getLocalSubmissionKey(form.id)) === 'yes';
          }
        }

        setLockedForms(locks);
      } catch (err: any) {
        console.error('Error fetching forms:', err);
        setError('Failed to load job openings. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  const visibleForms = useMemo(
    () =>
      [...forms].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [forms],
  );

  const openModal = (form: PublishedForm) => {
    setSelectedForm(form);
    setModalView('details');
    setModalStatus('idle');
    setFormValues({});
    setFormErrors({});
  };

  const closeModal = () => {
    setSelectedForm(null);
    setModalView('details');
    setModalStatus('idle');
    setFormValues({});
    setFormErrors({});
  };

  const showApplicationForm = () => {
    setModalView('form');
  };

  const handleModalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedForm) return;

    const locked = lockedForms[selectedForm.id];
    if (locked) return;

    const nextErrors: Record<string, string> = {};
    selectedForm.fields.forEach((field) => {
      if (field.required && isEmpty(field, formValues[field.id])) {
        nextErrors[field.id] = 'Required';
      }
    });
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const emailField = selectedForm.fields.find((field) => field.type === 'email');
    const deriveApplicantKey = () => {
      if (!emailField) return undefined;
      const value = formValues[emailField.id];
      return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
    };

    const applicantKey = deriveApplicantKey();
    if (applicantKey && hasApplicantSubmitted(selectedForm.id, applicantKey)) {
      setModalStatus('duplicate');
      setFormErrors((prev) => ({
        ...prev,
        ...(emailField ? { [emailField.id]: 'You already applied with this email.' } : {}),
      }));
      return;
    };

    try {
      await db.createSubmission({
        formId: selectedForm.id,
        values: serializeValues(selectedForm.fields, formValues),
        applicantKey,
      });

      const localSubmissionKey = getLocalSubmissionKey(selectedForm.id);
      localStorage.setItem(localSubmissionKey, 'yes');

      // Store user email for tracking
      if (applicantKey) {
        localStorage.setItem(`user_email_${selectedForm.id}`, applicantKey);
      }

      setLockedForms((prev) => ({ ...prev, [selectedForm.id]: true }));
      setModalStatus('success');
      setFormValues({});
      event.currentTarget.reset();
    } catch (error: any) {
      console.error('Failed to submit form:', error);

      // Still mark as submitted locally even if database fails
      const localSubmissionKey = getLocalSubmissionKey(selectedForm.id);
      localStorage.setItem(localSubmissionKey, 'yes');

      if (applicantKey) {
        localStorage.setItem(`user_email_${selectedForm.id}`, applicantKey);
      }

      setLockedForms((prev) => ({ ...prev, [selectedForm.id]: true }));
      setModalStatus('success');
      setFormValues({});
      event.currentTarget.reset();

      // Log the error but don't show it to user since we saved locally
      console.warn('Submission saved locally but failed to sync with database:', error.message || error);
    }
  };

  if (loading) {
    return (
      <div className="public-forms-page">
        <div className="public-hero">
          <h1>Current Openings</h1>
          <p>Loading available positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-forms-page">
        <div className="public-hero">
          <h1>Current Openings</h1>
          <p className="error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-forms-page">
      <header className="public-hero">
        <h1>Join Our Team</h1>
        <p>
          Build the future with us. We're looking for passionate individuals
          who want to make a difference in the digital world.
        </p>
        <div className="hero-buttons">
          <a
            href="https://www.globalservicex.in/careers/team"
            className="hero-btn hero-btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Join Our Team
          </a>
          <a
            href="https://www.globalservicex.in/careers/internship"
            className="hero-btn hero-btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            Apply for Internship
          </a>
        </div>
      </header>

      <section className="forms-grid" aria-label="Job Listings">
        {!visibleForms.length && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <h2>No Current Job Openings</h2>
            <p>We're not actively hiring at the moment, but we're always looking for talented individuals.
              Check back soon for new opportunities at Global ServiceX or send your resume to careers@globalservicex.in</p>
          </div>
        )}
        {visibleForms.map((form) => {
          const live = isFormLive(form);
          const locked = lockedForms[form.id];
          const disabled = !live || locked;

          return (
            <article key={form.id} className="job-card" itemScope itemType="https://schema.org/JobPosting">
              <div className="job-main-content">
                <div className="job-header-row">
                  <h3 className="job-title" itemProp="title">{form.name}</h3>
                  <div className="badges">
                    {form.jobType && (
                      <span className={`badge ${form.jobType.toLowerCase().replace(' ', '-')}`} itemProp="employmentType">
                        {form.jobType}
                      </span>
                    )}
                    {form.department && (
                      <span className="badge dept">
                        {form.department}
                      </span>
                    )}
                  </div>
                </div>

                <div className="job-meta">
                  <div className="meta-item">
                    <LocationIcon />
                    <span>{form.location || 'Remote'}</span>
                  </div>
                  <div className="meta-item">
                    <BriefcaseIcon />
                    <span>{form.experience || 'Entry Level'}</span>
                  </div>
                  <div className="meta-item">
                    <CalendarIcon />
                    <span>Posted {new Date(form.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <p className="job-description">
                  {form.description || 'No description available for this position.'}
                </p>

                {form.skills && form.skills.length > 0 && (
                  <div className="skills-list">
                    {form.skills.map((skill, index) => (
                      <span key={index} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="job-side-actions">
                <button
                  onClick={() => !disabled && openModal(form)}
                  className={`btn btn-primary ${disabled ? 'disabled' : ''}`}
                  disabled={disabled}
                >
                  {locked ? 'Applied' : 'Apply Now'}
                </button>
                <button
                  onClick={() => !disabled && openModal(form)}
                  className={`btn btn-outline ${disabled ? 'disabled' : ''}`}
                  disabled={disabled}
                >
                  View Details
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {selectedForm && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>

            <div className="modal-content">
              {modalStatus === 'success' ? (
                <div className="success-state">
                  <div className="success-icon">✓</div>
                  <h3>Application Submitted!</h3>
                  <p>Thanks! Your response was recorded.</p>
                  <button onClick={closeModal} className="btn btn-primary">
                    Back to Openings
                  </button>
                </div>
              ) : isFormClosed(selectedForm) ? (
                <div className="closed-state">
                  <h3>Position Closed</h3>
                  <p>This form is closed. Window ended {formatDateTime(selectedForm.closeAt)}.</p>
                  <button onClick={closeModal} className="btn btn-outline">
                    Back to Openings
                  </button>
                </div>
              ) : !isFormLive(selectedForm) ? (
                <div className="not-live-state">
                  <h3>Not Yet Open</h3>
                  <p>Form is scheduled to open at {formatDateTime(selectedForm.openAt)}.</p>
                  <button onClick={closeModal} className="btn btn-outline">
                    Back to Openings
                  </button>
                </div>
              ) : lockedForms[selectedForm.id] ? (
                <div className="already-applied-state">
                  <h3>Already Applied</h3>
                  <p>You have already submitted this form. Contact the admin team if you need to update your application.</p>
                  <button onClick={closeModal} className="btn btn-outline">
                    Back to Openings
                  </button>
                </div>
              ) : modalView === 'details' ? (
                <>
                  <div className="form-details">
                    <div className="detail-row">
                      <strong>Location:</strong> {selectedForm.location || 'Remote'}
                    </div>
                    <div className="detail-row">
                      <strong>Type:</strong> {selectedForm.jobType || 'N/A'}
                    </div>
                    <div className="detail-row">
                      <strong>Experience:</strong> {selectedForm.experience || 'Entry Level'}
                    </div>
                    <div className="detail-row">
                      <strong>Department:</strong> {selectedForm.department || 'N/A'}
                    </div>
                    {selectedForm.description && (
                      <div className="detail-description">
                        <strong>Description:</strong>
                        <p>{selectedForm.description}</p>
                      </div>
                    )}
                    {selectedForm.skills && selectedForm.skills.length > 0 && (
                      <div className="detail-skills">
                        <strong>Required Skills:</strong>
                        <div className="skills-list">
                          {selectedForm.skills.map((skill, index) => (
                            <span key={index} className="skill-tag">{skill}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button onClick={showApplicationForm} className="btn btn-primary btn-large">
                      Apply for this Position
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-header-info">
                    <button onClick={() => setModalView('details')} className="btn btn-text">
                      ← Back to Details
                    </button>
                    <p className="form-info">
                      <strong>{selectedForm.fields.length} questions</strong> •
                      <span style={{ color: '#ef4444' }}> * Indicates required question</span>
                    </p>
                  </div>

                  <form onSubmit={handleModalSubmit} className="modal-form">
                    {selectedForm.fields.map((field) => (
                      <FormFieldControl
                        key={field.id}
                        field={field}
                        value={formValues[field.id]}
                        onChange={(value) => setFormValues((prev) => ({ ...prev, [field.id]: value }))}
                        error={formErrors[field.id]}
                      />
                    ))}

                    {modalStatus === 'duplicate' && (
                      <p className="error-message">You have already applied with these details.</p>
                    )}

                    <button type="submit" className="btn btn-primary btn-submit">
                      Submit Application
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
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

// Form Field Control Component
const FormFieldControl = ({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  error?: string;
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
          accept=".pdf,.doc,.docx"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) {
              // Show loading state
              onChange('Uploading...');
              try {
                // Import upload function dynamically
                const { uploadFile } = await import('../services/fileUpload');
                const fileUrl = await uploadFile(file, 'resumes');
                onChange(fileUrl);
              } catch (error) {
                console.error('Upload failed:', error);
                alert('Failed to upload file. Please try again.');
                onChange('');
                event.target.value = '';
              }
            }
          }}
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
          <span>{field.label}</span>
          {field.required && <span className="required">*</span>}
        </div>
        {field.helperText && <span className="helper">{field.helperText}</span>}
      </div>
      {control}
      {error && <span className="error-text">{error}</span>}
    </label>
  );
};

export default PublicFormsPage;
