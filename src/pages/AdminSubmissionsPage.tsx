import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { db } from '../services/db';
import type { PublishedForm, FormSubmission } from '../types';
import './AdminHomePage.css';

const AdminSubmissionsPage = () => {
    const navigate = useNavigate();
    const [forms, setForms] = useState<PublishedForm[]>([]);
    const [selectedForm, setSelectedForm] = useState<PublishedForm | null>(null);
    const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);

    useEffect(() => {
        const fetchForms = async () => {
            try {
                const data = await db.getAllForms();
                setForms(data);
            } catch (error) {
                console.error('Failed to load forms:', error);
            }
        };
        fetchForms();
    }, []);

    const handleViewSubmissions = async (form: PublishedForm) => {
        setSelectedForm(form);
        try {
            const data = await db.getSubmissions(form.id);
            setSubmissions(data);
        } catch (error) {
            console.error('Failed to load submissions:', error);
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

    if (selectedForm) {
        return (
            <div className="admin-home-page" style={{ justifyContent: 'flex-start', background: '#f8f9fa' }}>
                <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '0 1rem' }}>
                    <button onClick={() => setSelectedForm(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>← Back to Forms</button>
                    <h1 className="admin-title" style={{ margin: 0, fontSize: '1.5rem' }}>{selectedForm.name} Submissions</h1>

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

                <div style={{ width: '100%', maxWidth: '1200px', overflowX: 'auto', padding: '0 1rem' }}>
                    {submissions.length === 0 ? (
                        <p style={{ textAlign: 'center', fontSize: '1.2rem', color: '#666' }}>No submissions yet.</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                                    {selectedForm.fields.map(field => (
                                        <th key={field.id} style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', minWidth: '150px' }}>{field.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map(submission => (
                                    <tr key={submission.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '1rem' }}>{new Date(submission.submittedAt).toLocaleString()}</td>
                                        {selectedForm.fields.map(field => (
                                            <td key={field.id} style={{ padding: '1rem' }}>
                                                {typeof submission.values[field.id] === 'object'
                                                    ? JSON.stringify(submission.values[field.id])
                                                    : String(submission.values[field.id] || '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="admin-home-page" style={{ justifyContent: 'flex-start' }}>
            <div style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button onClick={() => navigate('/gsxi')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>← Back</button>
                <h1 className="admin-title" style={{ margin: 0 }}>Select Form to View Submissions</h1>
                <div style={{ width: '60px' }}></div>
            </div>

            <div style={{ width: '90%', maxWidth: '900px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                {forms.map(form => (
                    <div
                        key={form.id}
                        onClick={() => handleViewSubmissions(form)}
                        style={{
                            background: '#fff',
                            padding: '2rem',
                            borderRadius: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            border: '1px solid #e0e0e0'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>{form.name}</h3>
                        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                            View Responses
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminSubmissionsPage;
