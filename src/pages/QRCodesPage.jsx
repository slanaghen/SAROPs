import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';

const QRCodesPage = () => {
  const { incidentId, incidentData, isActive } = useIncident();
  const [sartopoId, setSartopoId] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUrl = window.location.origin;
  const checkinUrl = `${currentUrl}/checkin`;

  // Helper to ensure we have a valid SARTopo URL regardless of whether an ID or URL was provided
  const getSartopoUrl = (id) => {
    if (!id) return null;
    if (id.startsWith('http')) return id;
    return `https://sartopo.com/m/${id}`;
  };

  const sartopoUrl = getSartopoUrl(sartopoId);

  useEffect(() => {
    if (!isActive || !incidentId) {
      // Give context a moment to hydrate before showing the "No Incident" state
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }

    const fetchIncident = async () => {
      setLoading(true);
      const { data } = await supabase.from('incidents').select('sartopo_id').eq('incident_id', incidentId).maybeSingle();
      if (data) setSartopoId(data.sartopo_id);
      setLoading(false);
    };

    fetchIncident();

    // Subscribe to real-time changes in case the map ID is updated in settings
    const channel = supabase
      .channel(`incident-qr-sync-${incidentId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'incidents', filter: `incident_id=eq.${incidentId}` 
      }, payload => {
        setSartopoId(payload.new.sartopo_id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [incidentId, isActive]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p className="operations-message">Loading QR data...</p>
      </div>
    );
  }

  const downloadQR = (url, fileName) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(url)}`;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `${fileName}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="qr-codes-page" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Incident QR Codes</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            {isActive ? `${incidentData?.name} — OP #${incidentData?.opNumber}` : 'General Incident Access'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()} style={{ width: 'auto', minWidth: '0', flex: 'none' }}>Print / Save as PDF</button>
      </div>

      <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div className="qr-card">
          <h2 style={{ marginBottom: '20px' }}>Check-In Portal</h2>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkinUrl)}`} 
              alt="Check-in QR" 
              style={{ display: 'block', width: '250px', height: '250px' }}
            />
          </div>
          <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Scan to Check-In</p>
          <p style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all', maxWidth: '250px' }}>{checkinUrl}</p>
          <button className="btn btn-secondary btn-sm no-print" style={{ marginTop: '12px' }} onClick={() => downloadQR(checkinUrl, 'SAROps-CheckIn-QR')}>
            Download PNG
          </button>
        </div>

        <div className="qr-card">
          <h2 style={{ marginBottom: '20px' }}>SARTopo Map</h2>
          {sartopoId ? (
            <>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(sartopoUrl)}`} 
                  alt="Map QR" 
                  style={{ display: 'block', width: '250px', height: '250px' }}
                />
              </div>
              <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Operational Map ID: {sartopoId}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all', maxWidth: '250px' }}>{sartopoUrl}</p>
              <button className="btn btn-secondary btn-sm no-print" style={{ marginTop: '12px' }} onClick={() => downloadQR(sartopoUrl, 'SAROps-Map-QR')}>
                Download PNG
              </button>
            </>
          ) : (
            <div style={{ width: '290px', height: '290px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#64748b' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>
                  {!isActive ? 'No Incident Active' : 'Map Not Configured'}
                </p>
                <p style={{ fontSize: '13px' }}>
                  {!isActive 
                    ? 'Select or start an incident to generate a map QR code.' 
                    : 'Set a SARTopo ID in the Incident settings to generate this QR code.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="no-print" style={{ marginTop: '48px', padding: '20px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', color: '#854d0e', fontSize: '14px' }}>
        <strong>Pro-tip:</strong> Print this page and post it at the Command Post or Staging Area to allow field teams to check themselves in via their own mobile devices.
      </div>

      <style>{`
        .qr-card {
          background: white;
          padding: 30px;
          border: 1px solid #eee;
          border-radius: 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .qr-card { border: none !important; padding: 10px !important; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default QRCodesPage;