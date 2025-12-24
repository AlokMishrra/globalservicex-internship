import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import type { PublishedForm } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './AdminHomePage.css';

const AdminFormsPage = () => {
    const navigate = useNavigate();
    const [forms, setForms] = useState<PublishedForm[]>([]);
    const [loading, setLoading] = useState(true);

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

    const fetchForms = async () => {
        try {
            const data = await db.getAllForms();
            setForms(data);
        } catch (error) {
            console.error('Error fetching forms:', error);
            alert('Failed to fetch forms');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchForms();
    }, []);

    const handleStatusToggle = async (form: PublishedForm) => {
        try {
            const newStatus = form.status === 'published' ? 'unpublished' : 'published';
            await db.updateForm(form.id, { status: newStatus });
            await fetchForms();
        } catch (error) {
            console.error('Error updating form status:', error);
            alert('Failed to update form status');
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Form',
            message: 'Are you sure you want to delete this form? This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    await db.deleteForm(id);
                    await fetchForms();
                } catch (error) {
                    console.error('Error deleting form:', error);
                    alert('Failed to delete form');
                }
            }
        });
    };

    return (
        <div className="admin-home-page" style={{ justifyContent: 'flex-start' }}>
            <div style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button onClick={() => navigate('/gsxi')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>← Back</button>
                <h1 className="admin-title" style={{ margin: 0 }}>Published Forms</h1>
                <div style={{ width: '60px' }}></div>
            </div>

            <div style={{ width: '90%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading ? (
                    <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#666' }}>Loading forms...</p>
                ) : forms.length === 0 ? (
                    <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#666' }}>No forms created yet.</p>
                ) : (
                    forms.map(form => (
                        <div key={form.id} style={{
                            background: '#fff',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: '0 0 0.5rem 0' }}>{form.name}</h3>
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
                    ))
                )}
            </div>

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

export default AdminFormsPage;
