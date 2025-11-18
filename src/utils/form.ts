import type { FormField, PublishedForm } from '../types';

export const fieldTemplates: Omit<FormField, 'id'>[] = [
  {
    type: 'shortText',
    label: 'Short answer',
    required: false,
    placeholder: 'Type here...',
  },
  {
    type: 'longText',
    label: 'Paragraph',
    required: false,
    placeholder: 'Describe your experience',
  },
  {
    type: 'email',
    label: 'Email address',
    required: true,
    placeholder: 'applicant@example.com',
  },
  {
    type: 'number',
    label: 'Numeric response',
    required: false,
    placeholder: '0',
  },
  {
    type: 'date',
    label: 'Date picker',
    required: false,
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    required: false,
    options: ['Option 1', 'Option 2'],
  },
];

export const createFieldFromTemplate = (template: Omit<FormField, 'id'>): FormField => ({
  ...template,
  id: crypto.randomUUID(),
});

export const buildSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const unique = Math.random().toString(36).slice(2, 7);
  return `${base || 'form'}-${unique}`;
};

export const isFormLive = (form: PublishedForm) => {
  const now = Date.now();
  return new Date(form.openAt).getTime() <= now && now <= new Date(form.closeAt).getTime();
};

export const isFormClosed = (form: PublishedForm) => {
  return Date.now() > new Date(form.closeAt).getTime();
};

export const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString();
};


