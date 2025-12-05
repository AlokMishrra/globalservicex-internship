import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { db } from '../services/db';
import { loadDraft } from '../utils/storage';
import type { PublishedForm, FormSubmission, DraftFormState } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SuccessNotification } from '../components/SuccessNotification';
import './AdminHomePage.css';

type ModalType = 'publish' | 'submissions' | 'dashboard' | 'live' | 'draft' | 'responses' | 'total' | 'edit-details' | null;

const AdminHomePage = () => {
    const navigate = useNavigate();
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [forms, setForms] = useState<PublishedForm[]>([]);
    const [draft, setDraft] = useState<DraftFormState | null>(null);
    const [selectedForm, setSelectedForm] = useState<PublishedForm | null>(null);
    const [editingForm, setEditingForm] = useState<PublishedForm | null>(null);
    const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [stats, setStats] = useState({
        totalForms: 0,
        publishedForms: 0,
        draftForms: 1,
        totalResponses: 0,
    });
    const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);
    const [detailEditValues, setDetailEditValues] = useState<Record<string, string>>({});

    // Dialog states
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });
    const [successNotification, setSuccessNotification] = useState<{
        isOpen: boolean;
        message: string;
    }>({
        isOpen: false,
        message: ''
    });

    const [isPublishing, setIsPublishing] = useState(false);

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = async () => {
        try {
            const loadedForms = await db.getAllForms();
            setForms(loadedForms);
            setDraft(loadDraft());

            setStats({
                totalForms: loadedForms.length,
                publishedForms: loadedForms.filter(f => f.status === 'published').length,
                draftForms: 1,
                totalResponses: 0, // Placeholder
            });
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    };

    const handleStatusToggle = async (form: PublishedForm) => {
        if (form.status === 'unpublished') {
            // If publishing, open edit modal first
            setEditingForm(form);
            setIsPublishing(true);
            setActiveModal('edit-details');
        } else {
            // If unpublishing, do it immediately
            try {
                await db.updateForm(form.id, { status: 'unpublished' });
                refreshData();
            } catch (error) {
                console.error('Failed to unpublish form:', error);
                alert('Failed to unpublish form');
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this form?')) {
            try {
                await db.deleteForm(id);
                refreshData();
            } catch (error) {
                console.error('Failed to delete form:', error);
                alert('Failed to delete form');
            }
        }
    };

    const handleViewSubmissions = async (form: PublishedForm) => {
        setSelectedForm(form);
        try {
            const data = await db.getSubmissions(form.id);
            setSubmissions(data);
        } catch (error) {
            console.error('Failed to load submissions:', error);
        }
    };

    const handleEditDetails = (form: PublishedForm) => {
        setEditingForm(form);
        setIsPublishing(false);
        setActiveModal('edit-details');
    };

    const handleSaveDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingForm) {
            let updatedForm = { ...editingForm };

            // Auto-add "Global ServiceX" to skills if not present
            const currentSkills = updatedForm.skills || [];
            if (!currentSkills.includes('Global ServiceX')) {
                updatedForm.skills = [...currentSkills, 'Global ServiceX'];
            }

            // If we are in the publishing flow, set status to published
            if (isPublishing) {
                updatedForm.status = 'published';
            }

            try {
                await db.updateForm(updatedForm.id, updatedForm);
                refreshData();
                setActiveModal('publish');
                setEditingForm(null);
                setIsPublishing(false);
            } catch (error) {
                console.error('Failed to save form details:', error);
                alert('Failed to save form details');
            }
        }
    };

    const handleExportCSV = () => {
        if (!selectedForm || submissions.length === 0) return;

        const headers = selectedForm.fields.map((field) => field.label);
        const rows = submissions.map((submission) =>
            selectedForm.fields.map((field) => JSON.stringify(submission.values[field.id] || '')),
        );
        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedForm.slug}-submissions.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setExportMenuOpen(false);
    };

    const handleExportExcel = () => {
        if (!selectedForm || submissions.length === 0) return;

        // headers are automatically generated from keys
        const data = submissions.map((submission) => {
            const row: Record<string, string> = { Date: new Date(submission.submittedAt).toLocaleString() };
            selectedForm.fields.forEach((field) => {
                row[field.label] = typeof submission.values[field.id] === 'object'
                    ? JSON.stringify(submission.values[field.id])
                    : String(submission.values[field.id] || '');
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Submissions");
        XLSX.writeFile(wb, `${selectedForm.slug}-submissions.xlsx`);
        setExportMenuOpen(false);
    };

    const handleExportPDF = () => {
        if (!selectedForm || submissions.length === 0) return;

        const doc = new jsPDF();
        const headers = [['Date', ...selectedForm.fields.map((field) => field.label)]];
        const data = submissions.map((submission) => [
            new Date(submission.submittedAt).toLocaleString(),
            ...selectedForm.fields.map((field) =>
                typeof submission.values[field.id] === 'object'
                    ? JSON.stringify(submission.values[field.id])
                    : String(submission.values[field.id] || '')
            )
        ]);

        (doc as any).autoTable({
            head: headers,
            body: data,
        });

        doc.save(`${selectedForm.slug}-submissions.pdf`);
        setExportMenuOpen(false);
    };

    const getModalTitle = () => {
        switch (activeModal) {
            case 'publish': return 'Manage Published Forms';
            case 'submissions': return selectedForm ? `${selectedForm.name} Submissions` : 'Select Form to View Submissions';
            case 'dashboard': return 'Dashboard Stats';
            case 'live': return 'Live Published Forms';
            case 'draft': return 'Current Draft';
            case 'responses': return 'Form Responses Overview';
            case 'total': return 'All Created Forms';
            case 'edit-details': return isPublishing ? 'Finalize & Publish' : 'Edit Form Details';
            default: return '';
        }
    };

    const renderModalContent = () => {
        // ... (publish modal remains same)
        if (activeModal === 'publish') {
            if (forms.length === 0) {
                return <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#666' }}>No forms created yet.</p>;
            }
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
                    {forms.map(form => (
                        <div key={form.id} style={{
                            background: '#fff',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{form.name}</h3>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: '#666' }}>
                                    <span>Created: {new Date(form.createdAt).toLocaleDateString()}</span>
                                    <span style={{
                                        color: form.status === 'published' ? 'green' : 'red',
                                        fontWeight: 600,
                                        textTransform: 'uppercase'
                                    }}>
                                        {form.status}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => handleEditDetails(form)}
                                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '4px' }}
                                >
                                    Edit Details
                                </button>
                                <button
                                    onClick={() => window.open(`/form/${form.slug}`, '_blank')}
                                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
                                >
                                    View Live
                                </button>
                                <button
                                    onClick={() => handleStatusToggle(form)}
                                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
                                >
                                    {form.status === 'published' ? 'Unpublish' : 'Publish'}
                                </button>
                                <button
                                    onClick={() => handleDelete(form.id)}
                                    style={{ padding: '0.5rem 1rem', cursor: 'pointer', background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', borderRadius: '4px' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // --- EDIT DETAILS MODAL ---
        if (activeModal === 'edit-details' && editingForm) {
            const generateSEO = () => {
                const title = `${editingForm.name} - Careers at Global ServiceX`;
                const description = `Join Global ServiceX as a ${editingForm.name}. We are looking for talented individuals in ${editingForm.department || 'our team'}. Apply now for this ${editingForm.jobType || 'position'} opportunity.`;
                const keywords = ['Global ServiceX', editingForm.name, editingForm.department || '', 'Careers', 'Internship', 'Jobs', 'Hiring'].filter(Boolean);

                setEditingForm({
                    ...editingForm,
                    seoTitle: title,
                    seoDescription: description,
                    seoKeywords: keywords,
                    skills: [...(editingForm.skills || []), 'Global ServiceX'].filter((v, i, a) => a.indexOf(v) === i)
                });
            };

            return (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', maxHeight: '65vh' }}>
                        <form id="edit-form" onSubmit={handleSaveDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Basic Details Section */}
                            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Job Details</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Job Title</label>
                                        <input
                                            type="text"
                                            value={editingForm.name}
                                            onChange={e => setEditingForm({ ...editingForm, name: e.target.value })}
                                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                            required
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Job Type</label>
                                            <select
                                                value={editingForm.jobType || ''}
                                                onChange={e => setEditingForm({ ...editingForm, jobType: e.target.value })}
                                                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                            >
                                                <option value="">Select Type</option>
                                                <option value="FULL TIME">Full Time</option>
                                                <option value="PART TIME">Part Time</option>
                                                <option value="INTERNSHIP">Internship</option>
                                                <option value="CONTRACT">Contract</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Department</label>
                                            <input
                                                type="text"
                                                value={editingForm.department || ''}
                                                onChange={e => setEditingForm({ ...editingForm, department: e.target.value })}
                                                placeholder="e.g. Tech"
                                                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Location</label>
                                            <input
                                                type="text"
                                                value={editingForm.location || ''}
                                                onChange={e => setEditingForm({ ...editingForm, location: e.target.value })}
                                                placeholder="e.g. Remote"
                                                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Experience</label>
                                            <input
                                                type="text"
                                                value={editingForm.experience || ''}
                                                onChange={e => setEditingForm({ ...editingForm, experience: e.target.value })}
                                                placeholder="e.g. 0-1 years"
                                                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Timing Section */}
                                <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                    <h4 style={{ margin: '0 0 1rem 0', color: '#1e40af', borderBottom: '1px solid #bfdbfe', paddingBottom: '0.5rem' }}>Form Availability Timing</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                                                Open At
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.5rem' }}>(Form becomes available)</span>
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={editingForm.openAt ? new Date(editingForm.openAt).toISOString().slice(0, 16) : ''}
                                                onChange={e => setEditingForm({ ...editingForm, openAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                                                style={{ width: '100%', padding: '0.6rem', border: '1px solid #93c5fd', borderRadius: '6px' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                                                Close At
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400, marginLeft: '0.5rem' }}>(Form stops accepting submissions)</span>
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={editingForm.closeAt ? new Date(editingForm.closeAt).toISOString().slice(0, 16) : ''}
                                                onChange={e => setEditingForm({ ...editingForm, closeAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                                                style={{ width: '100%', padding: '0.6rem', border: '1px solid #93c5fd', borderRadius: '6px' }}
                                            />
                                        </div>
                                    </div>
                                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: '#475569', fontStyle: 'italic' }}>
                                        💡 Leave empty for no time restrictions. Users can only submit when the form is "live" (between open and close times).
                                    </p>
                                </div>
                            </div>

                            {/* SEO Section */}
                            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #bbf7d0', paddingBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, color: '#166534' }}>SEO & Visibility (Global ServiceX)</h4>
                                    <button
                                        type="button"
                                        onClick={generateSEO}
                                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', background: '#166534', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        ✨ Auto-Generate SEO
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>SEO Title</label>
                                        <input
                                            type="text"
                                            value={editingForm.seoTitle || ''}
                                            onChange={e => setEditingForm({ ...editingForm, seoTitle: e.target.value })}
                                            placeholder="e.g. Senior Developer - Global ServiceX"
                                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #bbf7d0', borderRadius: '6px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>SEO Description</label>
                                        <textarea
                                            value={editingForm.seoDescription || ''}
                                            onChange={e => setEditingForm({ ...editingForm, seoDescription: e.target.value })}
                                            rows={2}
                                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #bbf7d0', borderRadius: '6px', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Keywords</label>
                                        <input
                                            type="text"
                                            value={editingForm.seoKeywords?.join(', ') || ''}
                                            onChange={e => setEditingForm({ ...editingForm, seoKeywords: e.target.value.split(',').map(s => s.trim()) })}
                                            placeholder="Global ServiceX, Internship, etc."
                                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #bbf7d0', borderRadius: '6px' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Content Section */}
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Content & Questions</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Skills (Tags)</label>
                                        <input
                                            type="text"
                                            value={editingForm.skills?.join(', ') || ''}
                                            onChange={e => setEditingForm({ ...editingForm, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Job Description</label>
                                        <textarea
                                            value={editingForm.description || ''}
                                            onChange={e => setEditingForm({ ...editingForm, description: e.target.value })}
                                            rows={6}
                                            style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Form Questions (Labels)</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '6px' }}>
                                            {editingForm.fields.map((field, index) => (
                                                <div key={field.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b', width: '20px' }}>{index + 1}.</span>
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={e => {
                                                            const newFields = [...editingForm.fields];
                                                            newFields[index] = { ...field, label: e.target.value };
                                                            setEditingForm({ ...editingForm, fields: newFields });
                                                        }}
                                                        style={{ flex: 1, padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer Actions */}
                    <div style={{
                        padding: '1rem 0 0 0',
                        marginTop: '1rem',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem',
                        background: 'white'
                    }}>
                        <button
                            type="button"
                            onClick={() => { setActiveModal('publish'); setEditingForm(null); setIsPublishing(false); }}
                            style={{ padding: '0.6rem 1.2rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={async (e) => {
                                e.preventDefault();
                                if (editingForm) {
                                    try {
                                        await db.updateForm(editingForm.id, editingForm);
                                        refreshData();
                                        setActiveModal('publish');
                                        setEditingForm(null);
                                        setIsPublishing(false);
                                    } catch (error) {
                                        console.error('Failed to save changes:', error);
                                        alert('Failed to save changes');
                                    }
                                }
                            }}
                            style={{ padding: '0.6rem 1.2rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Save Changes
                        </button>
                        <button
                            type="button"
                            onClick={async (e) => {
                                e.preventDefault();
                                if (editingForm) {
                                    const updated = { ...editingForm, status: 'published' as const };
                                    // Ensure Global ServiceX is in skills
                                    if (!updated.skills?.includes('Global ServiceX')) {
                                        updated.skills = [...(updated.skills || []), 'Global ServiceX'];
                                    }
                                    try {
                                        await db.updateForm(updated.id, updated);
                                        refreshData();
                                        setActiveModal('publish');
                                        setEditingForm(null);
                                        setIsPublishing(false);
                                    } catch (error) {
                                        console.error('Failed to publish form:', error);
                                        alert('Failed to publish form');
                                    }
                                }
                            }}
                            style={{ padding: '0.6rem 1.2rem', background: '#eab308', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                        >
                            Save & Publish
                        </button>
                    </div>
                </div>
            );
        }

        // --- SUBMISSIONS MODAL ---
        if (activeModal === 'submissions') {
            if (selectedForm) {
                return (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button onClick={() => setSelectedForm(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', color: '#666' }}>← Back to List</button>

                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setExportMenuOpen(!exportMenuOpen)}
                                        disabled={submissions.length === 0}
                                        style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        Export ▼
                                    </button>
                                    {exportMenuOpen && (
                                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 10, minWidth: '150px' }}>
                                            <button onClick={handleExportCSV} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>CSV</button>
                                            <button onClick={handleExportExcel} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>Excel</button>
                                            <button onClick={handleExportPDF} style={{ display: 'block', width: '100%', padding: '0.5rem 1rem', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}>PDF</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto', maxHeight: '50vh' }}>
                                {submissions.length === 0 ? (
                                    <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#666', padding: '2rem' }}>No submissions yet.</p>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9' }}>
                                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                                                {selectedForm.fields.map(field => (
                                                    <th key={field.id} style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', minWidth: '150px' }}>{field.label}</th>
                                                ))}
                                                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '120px' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {submissions.map(submission => (
                                                <tr key={submission.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '1rem' }}>{new Date(submission.submittedAt).toLocaleString()}</td>
                                                    {selectedForm.fields.map(field => (
                                                        <td key={field.id} style={{ padding: '1rem' }}>
                                                            {field.label.toLowerCase().includes('name') ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setViewingSubmission(submission);
                                                                        setDetailEditValues(submission.values);
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.color = '#8b5cf6'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.color = '#673ab7'}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#673ab7',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        padding: 0,
                                                                        textDecoration: 'underline',
                                                                        textAlign: 'left',
                                                                        fontSize: 'inherit',
                                                                        transition: 'color 0.2s'
                                                                    }}
                                                                >
                                                                    {String(submission.values[field.id] || '—')}
                                                                </button>
                                                            ) : (
                                                                typeof submission.values[field.id] === 'object'
                                                                    ? JSON.stringify(submission.values[field.id])
                                                                    : String(submission.values[field.id] || '')
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => {
                                                                    setViewingSubmission(submission);
                                                                    setDetailEditValues(submission.values);
                                                                }}
                                                                style={{
                                                                    padding: '0.4rem 0.8rem',
                                                                    background: '#e0e7ff',
                                                                    color: '#4338ca',
                                                                    border: '1px solid #c7d2fe',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 600,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = '#c7d2fe';
                                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = '#e0e7ff';
                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setConfirmDialog({
                                                                        isOpen: true,
                                                                        title: 'Delete Submission?',
                                                                        message: 'Are you sure you want to delete this submission? The user will be able to resubmit the form.',
                                                                        onConfirm: async () => {
                                                                            try {
                                                                                await db.deleteSubmission(submission.id);
                                                                                setSubmissions(submissions.filter(s => s.id !== submission.id));
                                                                                setConfirmDialog({ ...confirmDialog, isOpen: false });
                                                                                setSuccessNotification({
                                                                                    isOpen: true,
                                                                                    message: 'Submission deleted successfully. The user can now resubmit the form.'
                                                                                });
                                                                            } catch (error) {
                                                                                console.error('Failed to delete:', error);
                                                                                setConfirmDialog({ ...confirmDialog, isOpen: false });
                                                                                alert('Failed to delete submission.');
                                                                            }
                                                                        }
                                                                    });
                                                                }}
                                                                style={{
                                                                    padding: '0.4rem 0.8rem',
                                                                    background: '#fee2e2',
                                                                    color: '#dc2626',
                                                                    border: '1px solid #fecaca',
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 600,
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.background = '#fecaca';
                                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.background = '#fee2e2';
                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Detailed View Modal */}
                        {viewingSubmission && (
                            <div
                                className="modal-backdrop"
                                role="dialog"
                                aria-modal="true"
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 9999,
                                    padding: '1rem'
                                }}
                                onClick={() => setViewingSubmission(null)}
                            >
                                <div
                                    className="modal"
                                    style={{
                                        maxWidth: '700px',
                                        maxHeight: '80vh',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        backgroundColor: 'white',
                                        borderRadius: '8px',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                        width: '100%'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <header style={{ borderBottom: '1px solid #e2e8f0', padding: '1.5rem', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <h3 style={{ margin: 0, marginBottom: '0.5rem' }}>Submission Details</h3>
                                                <p className="muted small" style={{ margin: 0 }}>
                                                    Submitted: {new Date(viewingSubmission.submittedAt).toLocaleString()}
                                                </p>
                                            </div>
                                            <button onClick={() => setViewingSubmission(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
                                                ✕
                                            </button>
                                        </div>
                                    </header>

                                    <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                                        {selectedForm.fields.map((field) => (
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
                                            onClick={() => {
                                                setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Delete Submission?',
                                                    message: 'Are you sure you want to delete this submission? The user will be able to resubmit the form.',
                                                    onConfirm: async () => {
                                                        try {
                                                            await db.deleteSubmission(viewingSubmission.id);
                                                            setSubmissions(submissions.filter(s => s.id !== viewingSubmission.id));
                                                            setViewingSubmission(null);
                                                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                                                            setSuccessNotification({
                                                                isOpen: true,
                                                                message: 'Submission deleted successfully. The user can now resubmit the form.'
                                                            });
                                                        } catch (error) {
                                                            console.error('Failed to delete:', error);
                                                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                                                            alert('Failed to delete submission.');
                                                        }
                                                    }
                                                });
                                            }}
                                            style={{ padding: '0.6rem 1.2rem', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            Delete Submission
                                        </button>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                className="ghost"
                                                onClick={() => setViewingSubmission(null)}
                                                style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="primary"
                                                onClick={async () => {
                                                    try {
                                                        await db.updateSubmission(viewingSubmission.id, detailEditValues);
                                                        setSubmissions(submissions.map(s =>
                                                            s.id === viewingSubmission.id ? { ...s, values: detailEditValues } : s
                                                        ));
                                                        setViewingSubmission(null);
                                                        setSuccessNotification({
                                                            isOpen: true,
                                                            message: 'Submission updated successfully!'
                                                        });
                                                    } catch (error) {
                                                        console.error('Failed to update:', error);
                                                        alert('Failed to update submission. Please try again.');
                                                    }
                                                }}
                                                style={{ padding: '0.6rem 1.5rem', background: '#eab308', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Save Changes
                                            </button>
                                        </div>
                                    </footer>
                                </div>
                            </div>
                        )}
                    </>
                );
            }

            // List of forms to select
            if (forms.length === 0) {
                return <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#666' }}>No forms created yet.</p>;
            }
            return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                    {forms.map(form => (
                        <div
                            key={form.id}
                            onClick={() => handleViewSubmissions(form)}
                            style={{
                                background: '#fff',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{form.name}</h3>
                            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                                View Responses
                            </p>
                        </div>
                    ))}
                </div>
            );
        }

        // --- DASHBOARD MODAL (STATS) ---
        if (activeModal === 'dashboard') {
            return (
                <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
                    <div className="admin-card" onClick={() => setActiveModal('live')} style={{ padding: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{stats.publishedForms}</h2>
                            <p style={{ margin: 0, fontWeight: 600 }}>Live Forms</p>
                        </div>
                    </div>

                    <div className="admin-card" onClick={() => setActiveModal('draft')} style={{ padding: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{stats.draftForms}</h2>
                            <p style={{ margin: 0, fontWeight: 600 }}>Drafts</p>
                        </div>
                    </div>

                    <div className="admin-card" onClick={() => setActiveModal('responses')} style={{ padding: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>-</h2>
                            <p style={{ margin: 0, fontWeight: 600 }}>Total Responses</p>
                        </div>
                    </div>

                    <div className="admin-card" onClick={() => setActiveModal('total')} style={{ padding: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{stats.totalForms}</h2>
                            <p style={{ margin: 0, fontWeight: 600 }}>Total Created</p>
                        </div>
                    </div>
                </div>
            );
        }

        // --- DASHBOARD DRILL-DOWNS ---
        if (activeModal === 'draft') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>{draft?.title || 'Untitled Draft'}</h3>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{draft?.fields.length || 0} fields configured</p>
                        <button
                            onClick={() => navigate('/gsxi/create')}
                            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#7e57c2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Continue Editing
                        </button>
                    </div>
                </div>
            );
        }

        let displayedForms = forms;
        if (activeModal === 'live') {
            displayedForms = forms.filter(f => f.status === 'published');
        }

        if (activeModal === 'live' || activeModal === 'responses' || activeModal === 'total') {
            if (displayedForms.length === 0) {
                return <p style={{ textAlign: 'center', color: '#64748b' }}>No forms found in this category.</p>;
            }
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
                    {displayedForms.map(form => {
                        return (
                            <div key={form.id} style={{
                                padding: '1rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                background: '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h4 style={{ margin: '0 0 0.25rem 0' }}>{form.name}</h4>
                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                                        <span>Status: <strong style={{ color: form.status === 'published' ? '#10b981' : '#ef4444' }}>{form.status}</strong></span>
                                        <span>View Responses</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => window.open(`/form/${form.slug}`, '_blank')}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                    >
                                        View
                                    </button>
                                    <button
                                        onClick={() => handleEditDetails(form)}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '4px' }}
                                    >
                                        Edit
                                    </button>
                                    {activeModal === 'responses' && (
                                        <button
                                            onClick={() => {
                                                setActiveModal('submissions');
                                                handleViewSubmissions(form);
                                            }}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '4px' }}
                                        >
                                            Details
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return null;
    };

    return (
        <div className="admin-home-page">
            <h1 className="admin-title">Global ServiceX Admin Panel</h1>

            <div className="admin-grid">
                <div className="admin-card" onClick={() => navigate('/gsxi/create')}>
                    <h2>Create Form</h2>
                </div>

                <div className="admin-card" onClick={() => setActiveModal('publish')}>
                    <h2>Publish Form</h2>
                </div>

                <div className="admin-card" onClick={() => setActiveModal('submissions')}>
                    <h2>View Submission</h2>
                </div>

                <div className="admin-card" onClick={() => setActiveModal('dashboard')}>
                    <h2>Dashboard</h2>
                </div>
            </div>

            {activeModal && (
                <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
                    <div className="modal large" onClick={e => e.stopPropagation()}>
                        <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {(activeModal === 'live' || activeModal === 'draft' || activeModal === 'responses' || activeModal === 'total' || activeModal === 'edit-details') && (
                                    <button
                                        onClick={() => activeModal === 'edit-details' ? setActiveModal('publish') : setActiveModal('dashboard')}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', color: '#666' }}
                                    >
                                        ← Back
                                    </button>
                                )}
                                <h2 style={{ margin: 0 }}>{getModalTitle()}</h2>
                            </div>
                            <button
                                onClick={() => setActiveModal(null)}
                                style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
                            >
                                ×
                            </button>
                        </header>
                        {renderModalContent()}
                    </div>
                </div>
            )}

            {/* Custom Dialogs */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            />

            <SuccessNotification
                isOpen={successNotification.isOpen}
                message={successNotification.message}
                onClose={() => setSuccessNotification({ isOpen: false, message: '' })}
            />
        </div>
    );
};

export default AdminHomePage;
