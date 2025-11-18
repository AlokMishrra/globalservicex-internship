export type FieldType = 'shortText' | 'longText' | 'email' | 'number' | 'date' | 'dropdown';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface DraftFormState {
  title: string;
  description: string;
  fields: FormField[];
}

export interface PublishedForm {
  id: string;
  slug: string;
  name: string;
  openAt: string; // ISO string
  closeAt: string; // ISO string
  fields: FormField[];
  createdAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  submittedAt: string;
  values: Record<string, string>;
}


