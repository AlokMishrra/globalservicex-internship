import { supabase } from '../lib/supabase';
import type { PublishedForm, FormSubmission, DraftFormState } from '../types';

const mapForm = (data: any): PublishedForm => ({
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    status: data.status,
    fields: data.fields,
    theme: data.theme,
    openAt: data.open_at,
    closeAt: data.close_at,
    createdAt: data.created_at,
    jobType: data.job_type,
    department: data.department,
    location: data.location,
    experience: data.experience,
    skills: data.skills,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    seoKeywords: data.seo_keywords,
});

export const db = {
    // Forms
    async getPublishedForms() {
        const { data, error } = await supabase
            .from('forms')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(mapForm);
    },

    async getAllForms() {
        const { data, error } = await supabase
            .from('forms')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(mapForm);
    },

    async getFormBySlug(slug: string) {
        const { data, error } = await supabase
            .from('forms')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) throw error;
        return mapForm(data);
    },

    async createForm(form: DraftFormState & { slug: string; status: 'published' | 'unpublished'; name?: string; openAt?: string; closeAt?: string }) {
        const { data, error } = await supabase
            .from('forms')
            .insert([
                {
                    slug: form.slug,
                    name: form.name || form.title,
                    description: form.description,
                    status: form.status,
                    fields: form.fields,
                    theme: form.theme,
                    open_at: form.openAt,
                    close_at: form.closeAt,
                },
            ])
            .select()
            .single();

        if (error) throw error;
        return mapForm(data);
    },

    async updateForm(id: string, updates: Partial<PublishedForm>) {
        // Need to map camelCase updates to snake_case for DB
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.description) dbUpdates.description = updates.description;
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.fields) dbUpdates.fields = updates.fields;
        if (updates.theme) dbUpdates.theme = updates.theme;
        if (updates.openAt) dbUpdates.open_at = updates.openAt;
        if (updates.closeAt) dbUpdates.close_at = updates.closeAt;
        if (updates.jobType) dbUpdates.job_type = updates.jobType;
        if (updates.department) dbUpdates.department = updates.department;
        if (updates.location) dbUpdates.location = updates.location;
        if (updates.experience) dbUpdates.experience = updates.experience;
        if (updates.skills) dbUpdates.skills = updates.skills;
        if (updates.seoTitle) dbUpdates.seo_title = updates.seoTitle;
        if (updates.seoDescription) dbUpdates.seo_description = updates.seoDescription;
        if (updates.seoKeywords) dbUpdates.seo_keywords = updates.seoKeywords;

        const { data, error } = await supabase
            .from('forms')
            .update({
                ...dbUpdates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapForm(data);
    },

    async deleteForm(id: string) {
        const { error } = await supabase
            .from('forms')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Submissions
    async createSubmission(submission: Omit<FormSubmission, 'id' | 'submittedAt'>) {
        const { data, error } = await supabase
            .from('submissions')
            .insert([
                {
                    form_id: submission.formId,
                    values: submission.values,
                    applicant_key: submission.applicantKey,
                    submitted_at: new Date().toISOString(),
                },
            ])
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            formId: data.form_id,
            submittedAt: data.submitted_at,
            values: data.values,
            applicantKey: data.applicant_key,
        };
    },

    async getSubmissions(formId?: string) {
        let query = supabase
            .from('submissions')
            .select('*, forms(name)')
            .order('submitted_at', { ascending: false });

        if (formId) {
            query = query.eq('form_id', formId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data.map((item: any) => ({
            id: item.id,
            formId: item.form_id,
            formName: item.forms?.name,
            submittedAt: item.submitted_at,
            values: item.values,
            applicantKey: item.applicant_key,
        }));
    },

    async updateSubmission(id: string, values: Record<string, string>) {
        const { data, error } = await supabase
            .from('submissions')
            .update({
                values: values,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return {
            id: data.id,
            formId: data.form_id,
            submittedAt: data.submitted_at,
            values: data.values,
            applicantKey: data.applicant_key,
        };
    },

    async deleteSubmission(id: string) {
        const { error } = await supabase
            .from('submissions')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
