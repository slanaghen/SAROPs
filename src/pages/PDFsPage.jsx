import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '../lib/supabase';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';
import { useIncident } from '../context/IncidentContext';
import '../styles.css';

/**
 * PDFsPage
 * 
 * Provides a central location to access and view operational PDF documents.
 * Dynamically scans the src/assets folder for PDF files using Vite's glob import.
 */
const PDFsPage = () => {
  const { incidentData, incidentId, responderId, responderName } = useIncident();

  // Get operational context for the current responder to enable context-aware auto-filling
  // Note: team and assignment will be null for staff/admins who aren't checked in as field responders.
  const { team, assignment } = useResponderTeamAndAssignment(supabase, responderId);

  // Dynamically import all PDFs from src/assets
  // This satisfies the "list all files" requirement without manual updating
  const pdfModules = import.meta.glob('../assets/*.pdf', { eager: true, query: '?url', import: 'default' });

  const pdfDocuments = useMemo(() => {
    return Object.entries(pdfModules).map(([path, url]) => {
      // Extract filename and create a readable title
      // e.g. "../assets/ics_201.pdf" -> "ICS 201"
      const filename = path.split('/').pop();
      const title = filename
        .replace('.pdf', '')
        .replace(/_/g, ' ')
        .toUpperCase();
        
      return { title, url };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [pdfModules]);

  const [selectedPdf, setSelectedPdf] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [fieldNames, setFieldNames] = useState([]);
  const [isParsing, setIsParsing] = useState(false);

  // Mapping of common ICS/SAR form fields to available data points.
  // Uses regex to match varying field naming conventions in standard PDF forms.
  const getAutoFillValue = useCallback((fieldName) => {
    const mapping = [
      { regex: /incident\s*name/i, value: incidentData?.name },
      { regex: /incident\s*number|incident\s*#|incident\s*id/i, value: incidentId },
      { regex: /operational\s*period|op\s*period|period\s*#/i, value: incidentData?.opNumber },
      { regex: /date/i, value: new Date().toLocaleDateString() },
      { regex: /time/i, value: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      { regex: /prepared\s*by|user|responder/i, value: responderName },
      { regex: /assignment|task|objective|division\/group/i, value: assignment?.title },
      { regex: /division|group|segment|area/i, value: assignment?.segment },
      { regex: /radio|tac|frequency|channel/i, value: assignment?.frequency_primary },
      { regex: /instructions|description/i, value: assignment?.description },
      { regex: /team\s*name|resource\s*id/i, value: team?.team_name_number },
      { regex: /team\s*size|personnel/i, value: assignment?.team_size ? String(assignment.team_size) : null },
      { regex: /priority/i, value: assignment?.priority },
      { regex: /hazards/i, value: assignment?.hazards },
      { regex: /pod|probability\s*of\s*detection/i, value: assignment?.probability_of_detection ? `${assignment.probability_of_detection}%` : null }
    ];

    const match = mapping.find(m => m.regex.test(fieldName));
    return match?.value ? String(match.value) : null;
  }, [
    incidentData?.name, 
    incidentId, 
    incidentData?.opNumber, 
    responderName, 
    assignment?.title, 
    assignment?.segment, 
    assignment?.frequency_primary, 
    assignment?.description, 
    team?.team_name_number, 
    assignment?.team_size, 
    assignment?.priority, 
    assignment?.hazards, 
    assignment?.probability_of_detection
  ]);

  // Parse PDF form fields when a document is selected
  useEffect(() => {
    let currentBlobUrl = null;

    const extractFields = async () => {
      if (!selectedPdf) {
        setPdfUrl('');
        setFieldNames([]);
        return;
      }

      setIsParsing(true);
      try {
        const response = await fetch(selectedPdf);
        const arrayBuffer = await response.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const names = fields.map(f => f.getName()).sort((a, b) => a.localeCompare(b));
        setFieldNames(names);

        // Automatically fill detected fields based on keywords and operational context
        names.forEach(fieldName => {
          const fillValue = getAutoFillValue(fieldName);
          if (fillValue) {
            try {
              const textField = form.getTextField(fieldName);
              textField.setText(fillValue);
            } catch (e) {
              // Field type mismatch (e.g. checkbox or button) or field is locked
            }
          }
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        currentBlobUrl = URL.createObjectURL(blob);
        setPdfUrl(currentBlobUrl);
      } catch (err) {
        console.error('Error extracting PDF fields:', err);
        setPdfUrl(selectedPdf); // Fallback to original if processing fails
        setFieldNames([]);
      } finally {
        setIsParsing(false);
      }
    };

    extractFields();

    return () => {
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [selectedPdf, incidentData?.name, getAutoFillValue]);

  return (
    <div className="app-shell" style={{ padding: '24px' }}>
      <div className="page-header">
        <div>
          <h1>Operational Documents</h1>
          <p className="subtitle">Reference PDFs and standard ICS forms for the incident.</p>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <label htmlFor="pdf-selector" style={{ fontWeight: 600 }}>Select Document:</label>
          <select
            id="pdf-selector"
            className="status-update-select"
            style={{ width: 'auto', minWidth: '350px', height: '40px' }}
            value={selectedPdf}
            onChange={(e) => setSelectedPdf(e.target.value)}
          >
            <option value="">-- Select a document --</option>
            {pdfDocuments.map((doc) => (
              <option key={doc.url} value={doc.url}>
                {doc.title}
              </option>
            ))}
          </select>
          {pdfUrl && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a 
                href={pdfUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-secondary"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', height: '40px', padding: '0 16px' }}
              >
                Open in New Tab
              </a>
              <a 
                href={pdfUrl} 
                download
                className="btn btn-secondary"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', height: '40px', padding: '0 16px' }}
              >
                Download
              </a>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 280px)', minHeight: '600px', alignItems: 'stretch' }}>
        <div className="section-card" style={{ flex: 1, margin: 0, height: '100%' }}>
          {pdfUrl ? (
            <iframe
              key={pdfUrl}
              src={pdfUrl}
              title="PDF Viewer"
              width="100%"
              height="100%"
              style={{ border: 'none', borderRadius: '8px', background: '#f1f5f9' }}
            />
          ) : (
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#64748b',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '2px dashed #e2e8f0'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>📄</div>
              <p style={{ fontSize: '18px', fontWeight: 500 }}>No Document Selected</p>
              <p>Select a file from the list above to view it.</p>
            </div>
          )}
        </div>

        {selectedPdf && (
          <div className="section-card" style={{ width: '320px', margin: 0, height: '100%', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '16px', margin: '0 0 12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              Fillable Fields
            </h2>
            {isParsing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px' }}>
                <span style={{ fontSize: '16px' }}>⏳</span>
                Parsing document fields...
              </div>
            ) : fieldNames.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {fieldNames.map((name, idx) => (
                  <div key={idx} style={{ 
                    padding: '6px 10px', 
                    background: '#f1f5f9', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    wordBreak: 'break-all'
                  }}>
                    {name}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                No interactive form fields found in this document.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFsPage;