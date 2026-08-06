import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useIncident } from '../context/IncidentContext';
import '../styles/ActionButtons.css';

const QRCodesPage = () => {
  const { incidentId, incidentData, isActive, user } = useIncident();
  const [sartopoId, setSartopoId] = useState(null);
  const [operationalPeriod, setOperationalPeriod] = useState(null);
  const [loading, setLoading] = useState(true);

  const [displayDensity, setDisplayDensity] = useState('compact');

  useEffect(() => {
    const fetchDensity = async () => {
      const userEmail = user?.email || localStorage.getItem('sarops_user_email');
      if (!userEmail) return;
      const { data } = await supabase.from('users').select('display_density').eq('email', userEmail).maybeSingle();
      if (data?.display_density) setDisplayDensity(data.display_density);
    };
    fetchDensity();
  }, [user]);

  const checkinUrl = useMemo(() => {
    const currentOrigin = window.location.origin;
    const currentHostname = window.location.hostname;

    // In development, if we are on localhost, use the machine's network IP
    // so other devices on the LAN can scan the QR code and connect.
    // __LOCAL_IP__ is injected by vite.config.js.
    if (import.meta.env.DEV && currentHostname === 'localhost' && typeof __LOCAL_IP__ !== 'undefined' && __LOCAL_IP__) {
      return `http://${__LOCAL_IP__}:${window.location.port}/checkin`;
    }
    return `${currentOrigin}/checkin`;
  }, []);

  // Helper to ensure we have a valid SARTopo URL regardless of whether an ID or URL was provided
  const getSartopoUrl = (id) => {
    if (!id) return null;
    if (id.startsWith('http')) return id;
    return `https://sartopo.com/m/${id}`;
  };

  const sartopoUrl = getSartopoUrl(sartopoId);

  const showLiveFeed = operationalPeriod?.sarstream_enabled && (operationalPeriod?.sarstream_data?.url || operationalPeriod?.sarstream_data?.view_url);
  const liveFeedUrl = operationalPeriod?.sarstream_data?.url || operationalPeriod?.sarstream_data?.view_url;

  useEffect(() => {
    if (!isActive || !incidentId) {
      setLoading(false);
      return;
    }

    const fetchIncidentData = async () => {
      setLoading(true);
      const { data: incData } = await supabase.from('incidents').select('sartopo_id').eq('incident_id', incidentId).maybeSingle();
      if (incData) setSartopoId(incData.sartopo_id);

      if (incidentData?.opPeriodId) {
        const { data: opData } = await supabase
          .from('operational_periods')
          .select('sarstream_enabled, sarstream_data')
          .eq('op_period_id', incidentData.opPeriodId)
          .maybeSingle();
        if (opData) setOperationalPeriod(opData);
      }
      setLoading(false);
    };

    fetchIncidentData();

    // Subscribe to real-time changes in case the map ID is updated in settings
    const incidentChannel = supabase
      .channel(`incident-qr-sync-${incidentId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'incidents', filter: `incident_id=eq.${incidentId}` 
      }, payload => {
        setSartopoId(payload.new.sartopo_id);
      })
      .subscribe();

    let opChannel;
    if (incidentData?.opPeriodId) {
      opChannel = supabase.channel(`op-period-qr-sync-${incidentData.opPeriodId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'operational_periods', filter: `op_period_id=eq.${incidentData.opPeriodId}` }, 
          (payload) => setOperationalPeriod(payload.new)
        ).subscribe();
    }

    return () => { 
      supabase.removeChannel(incidentChannel); 
      if (opChannel) supabase.removeChannel(opChannel);
    };
  }, [incidentId, isActive, incidentData?.opPeriodId]);

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
    <div className={`qr-codes-page density-${displayDensity}`} style={{ padding: 'var(--space-lg)', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', borderBottom: '1px solid #e2e8f0', paddingBottom: 'var(--space-md)' }}>
        <div>
          <h1 style={{ margin: 0 }}>Incident QR Codes</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>
            {isActive ? `${incidentData?.name} — OP #${incidentData?.opNumber}` : 'General Incident Access'}
          </p>
        </div>
        <button className="action-btn action-btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div className="qr-card" style={{ padding: 'var(--space-lg)' }}>
          <h2 style={{ marginBottom: '20px' }}>
            <a href={checkinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Check-In Portal</a>
          </h2>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkinUrl)}`} 
              alt="Check-in QR" 
              style={{ display: 'block', width: '250px', height: '250px' }}
            />
          </div>
          <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Scan to Check-In</p>
          <p style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all', maxWidth: '250px' }}>{checkinUrl}</p>
          <button className="action-btn action-btn-primary action-btn-header no-print" style={{ marginTop: '12px', width: '150px' }} onClick={() => downloadQR(checkinUrl, 'SAROps-CheckIn-QR')}>
            Download PNG
          </button>
        </div>

        <div className="qr-card" style={{ padding: 'var(--space-lg)' }}>
          <h2 style={{ marginBottom: '20px' }}>
            <a href={sartopoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>SARTopo Map</a>
          </h2>
          {sartopoId ? (
            <>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(sartopoUrl)}`} 
                  alt="Map QR" 
                  style={{ display: 'block', width: '250px', height: '250px' }}
                />
              </div>
              <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Operational Map ID: {sartopoId}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all', maxWidth: '250px' }}>{sartopoUrl}</p>
              <button className="action-btn action-btn-primary no-print" style={{ marginTop: '12px', width: '150px' }} onClick={() => downloadQR(sartopoUrl, 'SAROps-Map-QR')}>
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

        <div className="qr-card" style={{ padding: 'var(--space-lg)' }}>
          <h2 style={{ marginBottom: '20px' }}>
            {showLiveFeed ? (
              <a href={liveFeedUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Live Video Feed</a>
            ) : (
              'Live Video Feed'
            )}
          </h2>
          {showLiveFeed ? (
            <>
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(liveFeedUrl)}`} 
                  alt="SARStream QR" 
                  style={{ display: 'block', width: '250px', height: '250px' }}
                />
              </div>
              <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Scan for Live Stream</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all', maxWidth: '250px' }}>{liveFeedUrl}</p>
              <button className="action-btn action-btn-primary no-print" style={{ marginTop: '12px', width: '150px' }} onClick={() => downloadQR(liveFeedUrl, 'SAROps-Stream-QR')}>
                Download PNG
              </button>
            </>
          ) : (
            <div style={{ width: '290px', height: '290px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#64748b' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>
                  {!isActive ? 'No Incident Active' : 'Live Feed Not Enabled'}
                </p>
                <p style={{ fontSize: '13px' }}>
                  {!isActive ? 'Select or start an incident to generate a stream QR code.' : 'Enable SARStream in the Incident settings to generate this QR code.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', color: '#854d0e', fontSize: '14px' }}>
        <strong>Pro-tip:</strong> Print this page and post it at the Command Post or Staging Area to allow field teams to check themselves in via their own mobile devices.
      </div>

      <style>{`
        .qr-card {
          background: white;
          padding: 30px;
          border: 1px solid #eee;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          width: 350px;
        }
        @media print {
          .no-print { display: none !important; }
          .qr-codes-page { padding: 0 !important; margin: 0 !important; maxWidth: none !important; }
          .qr-card { border: none !important; box-shadow: none !important; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default QRCodesPage;