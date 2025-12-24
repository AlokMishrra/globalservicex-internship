import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { db } from '../services/db';
import type { PublishedForm, FormSubmission, FormField } from '../types';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import '../pages/AdminDashboard.css';

type TabType = 'dashboard' | 'forms' | 'submissions';

const AdminHomePage = () => {
    const navigate = useNavigate();
    const { toasts, removeToast, success, error: showError } = useToast();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');

    // Data state
    const [forms, setForms] = useState<PublishedForm[]>([]);
    const [allSubmissions, setAllSubmissions] = useState<FormSubmission[]>([]);

    // Forms tab state
    const [editingForm, setEditingForm] = useState<PublishedForm | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // Submissions tab state
    const [selectedFormId, setSelectedFormId] = useState<string>('');
    const [filteredSubmissions, setFilteredSubmissions] = useState<FormSubmission[]>([]);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [viewingSubmission, setViewingSubmission] = useState<FormSubmission | null>(null);
    const [editValues, setEditValues] = useState<Record<string, string>>({});

    // Statistics
    const [stats, setStats] = useState({
        totalForms: 0,
        publishedForms: 0,
        totalSubmissions: 0,
        recentSubmissions: 0,
    });

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

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedFormId) {
            const filtered = allSubmissions.filter(s => s.formId === selectedFormId);
            setFilteredSubmissions(filtered);
        } else {
            setFilteredSubmissions([]);
        }
    }, [selectedFormId, allSubmissions]);

    const loadData = async () => {
        try {
            const loadedForms = await db.getAllForms();
            const loadedSubmissions = await db.getSubmissions();

            setForms(loadedForms);
            setAllSubmissions(loadedSubmissions);

            // Calculate statistics
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const recentCount = loadedSubmissions.filter(
                s => new Date(s.submittedAt) > oneDayAgo
            ).length;

            setStats({
                totalForms: loadedForms.length,
                publishedForms: loadedForms.filter(f => f.status === 'published').length,
                totalSubmissions: loadedSubmissions.length,
                recentSubmissions: recentCount,
            });
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    // Form Management Functions
    const handleEditForm = (form: PublishedForm) => {
        setEditingForm(form);
        setShowEditModal(true);
    };

    const handleSaveForm = async () => {
        if (!editingForm) return;

        try {
            await db.updateForm(editingForm.id, editingForm);
            await loadData();
            setShowEditModal(false);
            setEditingForm(null);
            success('Form updated successfully!');
        } catch (error) {
            console.error('Failed to save form:', error);
            showError('Failed to save form. Please try again.');
        }
    };

    const handleToggleStatus = async (form: PublishedForm) => {
        const newStatus = form.status === 'published' ? 'unpublished' : 'published';
        try {
            await db.updateForm(form.id, { status: newStatus });
            await loadData();
            success(`Form ${newStatus} successfully!`);
        } catch (error) {
            console.error('Failed to update status:', error);
            showError('Failed to update form status. Please try again.');
        }
    };

    const handleDeleteForm = async (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Form',
            message: 'Are you sure you want to delete this form? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    await db.deleteForm(id);
                    await loadData();
                    success('Form deleted successfully!');
                } catch (error) {
                    console.error('Failed to delete form:', error);
                    showError('Failed to delete form. Please try again.');
                }
            }
        });
    };

    // Submission Functions
    const handleViewSubmission = (submission: FormSubmission) => {
        setViewingSubmission(submission);
        setEditValues(submission.values);
    };

    const handleSaveSubmission = async () => {
        if (!viewingSubmission) return;

        try {
            await db.updateSubmission(viewingSubmission.id, editValues);
            await loadData();
            setViewingSubmission(null);
            success('Submission updated successfully!');
        } catch (error) {
            console.error('Failed to update submission:', error);
            showError('Failed to update submission. Please try again.');
        }
    };

    const handleDeleteSubmission = async (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Submission',
            message: 'Are you sure you want to delete this submission?',
            type: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    await db.deleteSubmission(id);
                    await loadData();
                    success('Submission deleted successfully!');
                } catch (error) {
                    console.error('Failed to delete submission:', error);
                    showError('Failed to delete submission. Please try again.');
                }
            }
        });
    };

    // Export Functions
    const getSelectedForm = () => forms.find(f => f.id === selectedFormId);

    const handleExportCSV = () => {
        const form = getSelectedForm();
        if (!form || filteredSubmissions.length === 0) return;

        const headers = form.fields.map(field => field.label);
        const rows = filteredSubmissions.map(submission =>
            form.fields.map(field => JSON.stringify(submission.values[field.id] || ''))
        );
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${form.slug}-submissions.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setExportMenuOpen(false);
    };

    const handleExportExcel = () => {
        const form = getSelectedForm();
        if (!form || filteredSubmissions.length === 0) return;

        const data = filteredSubmissions.map(submission => {
            const row: Record<string, string> = { Date: new Date(submission.submittedAt).toLocaleString() };
            form.fields.forEach(field => {
                row[field.label] = typeof submission.values[field.id] === 'object'
                    ? JSON.stringify(submission.values[field.id])
                    : String(submission.values[field.id] || '');
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Submissions");
        XLSX.writeFile(wb, `${form.slug}-submissions.xlsx`);
        setExportMenuOpen(false);
    };

    const handleExportPDF = () => {
        const form = getSelectedForm();
        if (!form || filteredSubmissions.length === 0) return;

        const doc = new jsPDF();
        const headers = [['Date', ...form.fields.map(field => field.label)]];
        const data = filteredSubmissions.map(submission => [
            new Date(submission.submittedAt).toLocaleString(),
            ...form.fields.map(field =>
                typeof submission.values[field.id] === 'object'
                    ? JSON.stringify(submission.values[field.id])
                    : String(submission.values[field.id] || '')
            )
        ]);

        (doc as any).autoTable({
            head: headers,
            body: data,
        });

        doc.save(`${form.slug}-submissions.pdf`);
        setExportMenuOpen(false);
    };

    // Render Dashboard Tab
    const renderDashboard = () => (
        <div className="dashboard-content">
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div>
                            <div className="stat-card-label">Total Forms</div>
                            <div className="stat-card-value">{stats.totalForms}</div>
                        </div>
                        <div className="stat-card-icon primary">📋</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <div>
                            <div className="stat-card-label">Published Forms</div>
                            <div className="stat-card-value">{stats.publishedForms}</div>
                        </div>
                        <div className="stat-card-icon success">✓</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <div>
                            <div className="stat-card-label">Total Submissions</div>
                            <div className="stat-card-value">{stats.totalSubmissions}</div>
                        </div>
                        <div className="stat-card-icon warning">📊</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <div>
                            <div className="stat-card-label">Last 24 Hours</div>
                            <div className="stat-card-value">{stats.recentSubmissions}</div>
                        </div>
                        <div className="stat-card-icon danger">🔥</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>All Job Openings</h2>
                <button className="btn btn-primary" onClick={() => navigate('/gsxi/create')}>
                    ➕ Create New Form
                </button>
            </div>

            {forms.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <h3 className="empty-state-title">No forms yet</h3>
                    <p className="empty-state-description">Create your first job opening form to get started</p>
                    <button className="btn btn-primary" onClick={() => navigate('/gsxi/create')}>
                        Create Form
                    </button>
                </div>
            ) : (
                <div className="admin-job-cards">
                    {forms.map(form => (
                        <div key={form.id} className="admin-job-card">
                            <div className="admin-job-main">
                                <div className="admin-job-header">
                                    <h3 className="admin-job-title">{form.name}</h3>
                                    <div className="admin-job-badges">
                                        {form.jobType && (
                                            <span className={`job-type-badge ${form.jobType.toLowerCase().replace(' ', '-')}`}>
                                                {form.jobType}
                                            </span>
                                        )}
                                        {form.department && (
                                            <span className="dept-badge">
                                                {form.department}
                                            </span>
                                        )}
                                        <span className={`badge ${form.status === 'published' ? 'badge-published' : 'badge-unpublished'}`}>
                                            {form.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="admin-job-meta">
                                    <div className="admin-meta-item">
                                        <span>📍</span>
                                        <span>{form.location || 'Remote'}</span>
                                    </div>
                                    <div className="admin-meta-item">
                                        <span>💼</span>
                                        <span>{form.experience || 'Entry Level'}</span>
                                    </div>
                                    <div className="admin-meta-item">
                                        <span>📅</span>
                                        <span>Posted {new Date(form.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="admin-meta-item">
                                        <span>📊</span>
                                        <span>{allSubmissions.filter(s => s.formId === form.id).length} submissions</span>
                                    </div>
                                </div>

                                {form.description && (
                                    <p className="admin-job-description">
                                        {form.description}
                                    </p>
                                )}

                                {form.skills && form.skills.length > 0 && (
                                    <div className="admin-skills-list">
                                        {form.skills.map((skill, index) => (
                                            <span key={index} className="admin-skill-tag">{skill}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="admin-job-actions">
                                <button className="btn btn-sm btn-secondary" onClick={() => handleEditForm(form)}>
                                    ✏️ Edit Details
                                </button>
                                <button className="btn btn-sm btn-secondary" onClick={() => window.open(`/form/${form.slug}`, '_blank')}>
                                    👁️ View Live
                                </button>
                                <button
                                    className={`btn btn-sm ${form.status === 'published' ? 'btn-secondary' : 'btn-success'}`}
                                    onClick={() => handleToggleStatus(form)}
                                >
                                    {form.status === 'published' ? '📴 Unpublish' : '✅ Publish'}
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteForm(form.id)}>
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // Render Forms Tab
    const renderForms = () => (
        <div className="dashboard-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>All Forms</h2>
                <button className="btn btn-primary" onClick={() => navigate('/gsxi/create')}>
                    ➕ Create New Form
                </button>
            </div>

            {forms.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <h3 className="empty-state-title">No forms yet</h3>
                    <p className="empty-state-description">Create your first form to get started</p>
                    <button className="btn btn-primary" onClick={() => navigate('/gsxi/create')}>
                        Create Form
                    </button>
                </div>
            ) : (
                <div className="forms-grid">
                    {forms.map(form => (
                        <div key={form.id} className="form-card">
                            <div className="form-card-header">
                                <div>
                                    <h3 className="form-card-title">{form.name}</h3>
                                    <div className="form-card-meta">
                                        <span className={`badge ${form.status === 'published' ? 'badge-published' : 'badge-unpublished'}`}>
                                            {form.status}
                                        </span>
                                        <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {form.description && (
                                <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
                                    {form.description.substring(0, 100)}{form.description.length > 100 ? '...' : ''}
                                </p>
                            )}

                            <div className="form-card-actions">
                                <button className="btn btn-sm btn-secondary" onClick={() => handleEditForm(form)}>
                                    ✏️ Edit
                                </button>
                                <button className="btn btn-sm btn-secondary" onClick={() => window.open(`/form/${form.slug}`, '_blank')}>
                                    👁️ View
                                </button>
                                <button
                                    className={`btn btn-sm ${form.status === 'published' ? 'btn-secondary' : 'btn-success'}`}
                                    onClick={() => handleToggleStatus(form)}
                                >
                                    {form.status === 'published' ? '📴 Unpublish' : '✅ Publish'}
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteForm(form.id)}>
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // Render Submissions Tab
    const renderSubmissions = () => {
        const selectedForm = getSelectedForm();

        // Helper function to get field value by label pattern
        const getFieldValue = (submission: FormSubmission, labelPattern: string) => {
            const field = selectedForm?.fields.find(f =>
                f.label.toLowerCase().includes(labelPattern.toLowerCase())
            );
            return field ? String(submission.values[field.id] || 'N/A') : 'N/A';
        };

        return (
            <div className="dashboard-content">
                <div className="table-container">
                    <div className="table-header">
                        <h3 className="table-title">Form Submissions</h3>
                        <div className="table-controls">
                            <select
                                className="form-select"
                                value={selectedFormId}
                                onChange={(e) => setSelectedFormId(e.target.value)}
                                style={{ minWidth: '250px' }}
                            >
                                <option value="">Select a form...</option>
                                {forms.map(form => (
                                    <option key={form.id} value={form.id}>
                                        {form.name} ({allSubmissions.filter(s => s.formId === form.id).length})
                                    </option>
                                ))}
                            </select>

                            {selectedFormId && filteredSubmissions.length > 0 && (
                                <div className="dropdown">
                                    <button
                                        className="btn btn-success"
                                        onClick={() => setExportMenuOpen(!exportMenuOpen)}
                                    >
                                        📥 Export
                                    </button>
                                    {exportMenuOpen && (
                                        <div className="dropdown-menu">
                                            <button className="dropdown-item" onClick={handleExportCSV}>CSV</button>
                                            <button className="dropdown-item" onClick={handleExportExcel}>Excel</button>
                                            <button className="dropdown-item" onClick={handleExportPDF}>PDF</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {!selectedFormId ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📊</div>
                            <h3 className="empty-state-title">Select a form</h3>
                            <p className="empty-state-description">Choose a form from the dropdown to view its submissions</p>
                        </div>
                    ) : filteredSubmissions.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📭</div>
                            <h3 className="empty-state-title">No submissions yet</h3>
                            <p className="empty-state-description">This form hasn't received any submissions</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Submission Date</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th style={{ textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubmissions.map(submission => {
                                        const name = getFieldValue(submission, 'name');
                                        const email = getFieldValue(submission, 'email');

                                        return (
                                            <tr
                                                key={submission.id}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleViewSubmission(submission)}
                                            >
                                                <td>{new Date(submission.submittedAt).toLocaleString()}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{name}</td>
                                                <td>{email}</td>
                                                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => handleViewSubmission(submission)}
                                                        >
                                                            👁️ View
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => handleDeleteSubmission(submission.id)}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <div className="dashboard-title">
                    <div className="dashboard-title-icon">🎯</div>
                    Global ServiceX Admin Panel
                </div>
                <div className="dashboard-actions">
                    <button className="btn btn-secondary" onClick={() => navigate('/gsxi/create')}>
                        ➕ Create Form
                    </button>
                </div>
            </div>

            <div className="dashboard-tabs">
                <button
                    className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    📊 Dashboard
                </button>
                <button
                    className={`tab-button ${activeTab === 'forms' ? 'active' : ''}`}
                    onClick={() => setActiveTab('forms')}
                >
                    📋 Forms
                </button>
                <button
                    className={`tab-button ${activeTab === 'submissions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('submissions')}
                >
                    📥 Submissions
                </button>
            </div>

            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'forms' && renderForms()}
            {activeTab === 'submissions' && renderSubmissions()}

            {/* Edit Form Modal */}
            {showEditModal && editingForm && (
                <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Form Details</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Basic Information */}
                            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>Basic Information</h4>
                                <div className="form-group">
                                    <label className="form-label">Form Name *</label>
                                    <input
                                        className="form-input"
                                        value={editingForm.name}
                                        onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        value={editingForm.description || ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Job Details */}
                            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>Job Details</h4>
                                <div className="form-group">
                                    <label className="form-label">Job Type</label>
                                    <select
                                        className="form-select"
                                        value={editingForm.jobType || ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, jobType: e.target.value })}
                                    >
                                        <option value="">Select Type</option>
                                        <option value="FULL TIME">Full Time</option>
                                        <option value="PART TIME">Part Time</option>
                                        <option value="INTERNSHIP">Internship</option>
                                        <option value="CONTRACT">Contract</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g., Engineering, Marketing"
                                        value={editingForm.department || ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, department: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g., Remote, New York, Hybrid"
                                        value={editingForm.location || ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, location: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Experience Required</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g., 0-1 years, Entry Level, 2-5 years"
                                        value={editingForm.experience || ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, experience: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Required Skills (comma-separated)</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g., React, TypeScript, Node.js"
                                        value={editingForm.skills?.join(', ') || ''}
                                        onChange={(e) => setEditingForm({
                                            ...editingForm,
                                            skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                        })}
                                    />
                                </div>
                            </div>

                            {/* Form Schedule */}
                            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>Form Schedule</h4>
                                <div className="form-group">
                                    <label className="form-label">Opening Date & Time</label>
                                    <input
                                        className="form-input"
                                        type="datetime-local"
                                        value={editingForm.openAt ? new Date(editingForm.openAt).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, openAt: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Closing Date & Time</label>
                                    <input
                                        className="form-input"
                                        type="datetime-local"
                                        value={editingForm.closeAt ? new Date(editingForm.closeAt).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, closeAt: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* SEO Metadata */}
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>SEO Metadata</h4>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => {
                                            const title = `${editingForm.name} at Global ServiceX | Apply Now`;
                                            const description = `Join Global ServiceX as ${editingForm.name}. ${editingForm.description || 'Apply now for this exciting opportunity.'} ${editingForm.location ? `Location: ${editingForm.location}.` : ''} ${editingForm.experience ? `Experience: ${editingForm.experience}.` : ''}`.slice(0, 160);
                                            const keywords = [
                                                'Global ServiceX',
                                                'careers',
                                                editingForm.jobType?.toLowerCase() || 'job',
                                                editingForm.department?.toLowerCase(),
                                                ...(editingForm.skills || [])
                                            ].filter((k): k is string => Boolean(k));

                                            setEditingForm({
                                                ...editingForm,
                                                seoTitle: title,
                                                seoDescription: description,
                                                seoKeywords: keywords
                                            });
                                        }}
                                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                                    >
                                        ✨ Auto-Generate SEO
                                    </button>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SEO Title (60 chars max)</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g., Software Engineer at Global ServiceX | Apply Now"
                                        maxLength={60}
                                        value={editingForm.seoTitle || ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, seoTitle: e.target.value })}
                                    />
                                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                        {(editingForm.seoTitle || '').length}/60 characters
                                    </small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SEO Description (160 chars max)</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        placeholder="Brief description for search engines..."
                                        maxLength={160}
                                        value={editingForm.seoDescription || ''}
                                        onChange={(e) => setEditingForm({ ...editingForm, seoDescription: e.target.value })}
                                    />
                                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                        {(editingForm.seoDescription || '').length}/160 characters
                                    </small>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">SEO Keywords (comma-separated)</label>
                                    <input
                                        className="form-input"
                                        placeholder="e.g., global servicex, careers, software engineer"
                                        value={editingForm.seoKeywords?.join(', ') || ''}
                                        onChange={(e) => setEditingForm({
                                            ...editingForm,
                                            seoKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                        })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveForm}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Submission Modal */}
            {viewingSubmission && (() => {
                const selectedForm = forms.find(f => f.id === selectedFormId);
                if (!selectedForm) return null;

                // Find resume field
                const resumeField = selectedForm.fields.find((f: FormField) =>
                    f.label.toLowerCase().includes('resume') ||
                    f.label.toLowerCase().includes('cv') ||
                    f.type === 'fileUpload'
                );
                const resumeUrl = resumeField ? editValues[resumeField.id] : null;

                return (
                    <div className="modal-backdrop" onClick={() => setViewingSubmission(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Submission Details</h3>
                                <button className="modal-close" onClick={() => setViewingSubmission(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div style={{
                                    background: 'var(--gray-50)',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    marginBottom: '1.5rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                                            Submitted: {new Date(viewingSubmission.submittedAt).toLocaleString()}
                                        </p>
                                    </div>
                                    {resumeUrl && (
                                        <a
                                            href={resumeUrl}
                                            download
                                            className="btn btn-sm btn-primary"
                                            style={{ textDecoration: 'none' }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            📄 Download Resume
                                        </a>
                                    )}
                                </div>
                                {selectedForm.fields.map((field: FormField) => {
                                    const isFileField = field.type === 'fileUpload' ||
                                        field.label.toLowerCase().includes('resume') ||
                                        field.label.toLowerCase().includes('cv');

                                    return (
                                        <div key={field.id} className="form-group">
                                            <label className="form-label">
                                                {field.label}
                                                {field.required && <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>*</span>}
                                            </label>
                                            {isFileField ? (
                                                <div style={{
                                                    padding: '0.75rem',
                                                    background: 'var(--gray-50)',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}>
                                                    {editValues[field.id] ? (
                                                        <>
                                                            <span style={{ flex: 1, fontSize: '0.875rem' }}>📎 File uploaded</span>
                                                            <a
                                                                href={editValues[field.id]}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-sm btn-secondary"
                                                                style={{ textDecoration: 'none' }}
                                                            >
                                                                View File
                                                            </a>
                                                        </>
                                                    ) : (
                                                        <span style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>No file uploaded</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <input
                                                    className="form-input"
                                                    value={editValues[field.id] || ''}
                                                    onChange={(e) => setEditValues({ ...editValues, [field.id]: e.target.value })}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn btn-danger"
                                    onClick={() => {
                                        handleDeleteSubmission(viewingSubmission.id);
                                        setViewingSubmission(null);
                                    }}
                                >
                                    🗑️ Delete
                                </button>
                                <div style={{ flex: 1 }}></div>
                                <button className="btn btn-secondary" onClick={() => setViewingSubmission(null)}>
                                    Close
                                </button>
                                <button className="btn btn-primary" onClick={handleSaveSubmission}>
                                    💾 Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Toast Container */}
            <ToastContainer toasts={toasts} onRemove={removeToast} />

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
        </div>
    );
};

export default AdminHomePage;
