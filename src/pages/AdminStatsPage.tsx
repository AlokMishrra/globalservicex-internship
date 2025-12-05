import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { loadDraft } from '../utils/storage';
import type { PublishedForm, DraftFormState } from '../types';

import './AdminHomePage.css'; // Reuse basic styles

type ModalType = 'live' | 'draft' | 'responses' | 'total' | null;

const AdminStatsPage = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalForms: 0,
        publishedForms: 0,
        draftForms: 1,
        totalResponses: 0,
    });
    const [allForms, setAllForms] = useState<PublishedForm[]>([]);
    const [draft, setDraft] = useState<DraftFormState | null>(null);
    const [activeModal, setActiveModal] = useState<ModalType>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const forms = await db.getAllForms();
                setAllForms(forms);
                setDraft(loadDraft());

                setStats({
                    totalForms: forms.length,
                    publishedForms: forms.filter(f => f.status === 'published').length,
                    draftForms: 1,
                    totalResponses: 0, // Placeholder
                });
            } catch (error) {
                console.error('Failed to load stats:', error);
            }
        };
        fetchData();
    }, []);

    const getModalTitle = () => {
        switch (activeModal) {
            case 'live': return 'Live Published Forms';
            case 'draft': return 'Current Draft';
            case 'responses': return 'Form Responses Overview';
            case 'total': return 'All Created Forms';
            default: return '';
        }
    };

    const renderModalContent = () => {
        if (activeModal === 'draft') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{
                        padding: '1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: '#f8fafc'
                    }}>
                        <h3 style={{ margin: '0 0 0.5rem 0' }}>{draft?.title || 'Untitled Draft'}</h3>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                            {draft?.fields.length || 0} fields configured
                        </p>
                        <button
                            onClick={() => navigate('/gsxi/create')}
                            style={{
                                marginTop: '1rem',
                                padding: '0.5rem 1rem',
                                background: '#7e57c2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Continue Editing
                        </button>
                    </div>
                </div>
            );
        }

        let displayedForms = allForms;
        if (activeModal === 'live') {
            displayedForms = allForms.filter(f => f.status === 'published');
        }

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
                                {activeModal === 'responses' && (
                                    <button
                                        onClick={() => navigate('/gsxi/submissions')}
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
    };

    return (
        <div className="admin-home-page">
            <div style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button onClick={() => navigate('/gsxi')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>← Back</button>
                <h1 className="admin-title" style={{ margin: 0 }}>Dashboard Stats</h1>
                <div style={{ width: '60px' }}></div>
            </div>

            <div className="admin-grid">
                <div className="admin-card" onClick={() => setActiveModal('live')}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{stats.publishedForms}</h2>
                        <p style={{ margin: 0, fontWeight: 600 }}>Live Forms</p>
                    </div>
                </div>

                <div className="admin-card" onClick={() => setActiveModal('draft')}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{stats.draftForms}</h2>
                        <p style={{ margin: 0, fontWeight: 600 }}>Drafts</p>
                    </div>
                </div>

                <div className="admin-card" onClick={() => setActiveModal('responses')}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>-</h2>
                        <p style={{ margin: 0, fontWeight: 600 }}>Total Responses</p>
                    </div>
                </div>

                <div className="admin-card" onClick={() => setActiveModal('total')}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{stats.totalForms}</h2>
                        <p style={{ margin: 0, fontWeight: 600 }}>Total Created</p>
                    </div>
                </div>
            </div>

            {activeModal && (
                <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
                    <div className="modal large" onClick={e => e.stopPropagation()}>
                        <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                            <h2 style={{ margin: 0 }}>{getModalTitle()}</h2>
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
        </div>
    );
};

export default AdminStatsPage;
