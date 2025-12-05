import type { DraftFormState, FormField, FormSubmission, PublishedForm } from '../types';

const DRAFT_KEY = 'internship_form_draft';
const PUBLISHED_KEY = 'internship_published_forms';
const SUBMISSION_PREFIX = 'internship_submissions_';
const DEFAULT_TITLE_KEY = 'internship_default_title';
const DEFAULT_DESCRIPTION_KEY = 'internship_default_description';

const getDefaultTitle = (): string => {
  return localStorage.getItem(DEFAULT_TITLE_KEY) || 'Untitled internship form';
};

const getDefaultDescription = (): string => {
  return localStorage.getItem(DEFAULT_DESCRIPTION_KEY) || 'Collect candidate details for your internship program.';
};

export const setDefaultTitle = (title: string) => {
  localStorage.setItem(DEFAULT_TITLE_KEY, title);
};

export const setDefaultDescription = (description: string) => {
  localStorage.setItem(DEFAULT_DESCRIPTION_KEY, description);
};

const defaultDraft: DraftFormState = {
  title: 'Untitled internship form',
  description: 'Outline your internship intake requirements.',
  fields: [],
};

const parseJSON = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const loadDraft = (): DraftFormState => {
  const saved = parseJSON(localStorage.getItem(DRAFT_KEY), null);
  if (saved) {
    return saved;
  }
  // If no saved draft, use defaults from localStorage or fallback
  return {
    ...defaultDraft,
    title: getDefaultTitle(),
    description: getDefaultDescription(),
  };
};

export const saveDraft = (draft: DraftFormState) => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};

export const resetDraft = () => {
  localStorage.removeItem(DRAFT_KEY);
};

export const loadPublishedForms = (): PublishedForm[] => {
  const stored = parseJSON(localStorage.getItem(PUBLISHED_KEY), [] as PublishedForm[]);
  return stored.map((form) => ({
    ...form,
    status: form.status ?? 'published',
  }));
};

export const savePublishedForm = (form: PublishedForm) => {
  const existing = loadPublishedForms();
  existing.unshift(form);
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(existing));
};

export const updatePublishedForm = (formId: string, updates: Partial<PublishedForm>) => {
  const forms = loadPublishedForms();
  console.log(`updatePublishedForm: Looking for formId ${formId} in ${forms.length} forms`);
  forms.forEach((f, i) => {
    console.log(`  Form ${i}: id=${f.id}, name=${f.name}, status=${f.status}`);
  });
  const formIndex = forms.findIndex((form) => form.id === formId);
  if (formIndex === -1) {
    console.error(`updatePublishedForm: Form with id ${formId} not found`);
    return undefined;
  }
  console.log(`updatePublishedForm: Found form at index ${formIndex}, updating status to ${updates.status}`);
  const updatedForm = { ...forms[formIndex], ...updates };
  const next = [...forms];
  next[formIndex] = updatedForm;
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(next));
  console.log(`updatePublishedForm: Updated form ${formId} successfully, new status: ${updatedForm.status}`);
  return updatedForm;
};

export const deletePublishedForm = (formId: string) => {
  const next = loadPublishedForms().filter((form) => form.id !== formId);
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(next));
  localStorage.removeItem(`${SUBMISSION_PREFIX}${formId}`);
};

export const findPublishedForm = (slug: string): PublishedForm | undefined => {
  return loadPublishedForms().find((form) => form.slug === slug);
};

export const loadRecentFields = (): FormField[] => {
  return loadDraft().fields;
};

export const loadSubmissions = (formId: string): FormSubmission[] => {
  return parseJSON(localStorage.getItem(`${SUBMISSION_PREFIX}${formId}`), []);
};

export const saveSubmission = (formId: string, submission: FormSubmission) => {
  const existing = loadSubmissions(formId);
  existing.unshift(submission);
  localStorage.setItem(`${SUBMISSION_PREFIX}${formId}`, JSON.stringify(existing));
};

export const hasApplicantSubmitted = (formId: string, applicantKey: string) => {
  if (!applicantKey) return false;
  return loadSubmissions(formId).some((submission) => submission.applicantKey === applicantKey);
};


