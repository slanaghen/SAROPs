import React from 'react';

const OpPeriodFormSection = ({
  operationalPeriod,
  handleOperationalPeriodChange,
  isStreamEnabled,
  isStreamLoading,
  handleToggleSarStream,
  existingId,
  targetOpId,
}) => {
  return (
    <div className="section-card">
      <h2>Operational Period</h2>

      <div className="timing-row" style={{ alignItems: 'flex-end', marginBottom: 'var(--space-md)', gap: 'var(--space-md)' }}>
        <div className="form-field" style={{ flex: '0 0 140px' }}>
          <label className="form-label" htmlFor="op_num">OP Number</label>
          <input
            id="op_num"
            type="text"
            className="form-input"
            value={operationalPeriod.op_number}
            onChange={(e) => handleOperationalPeriodChange('op_number', e.target.value)}
            placeholder="OP #"
          />
        </div>

        <div className="par-config-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flex: 1 }}>
          <div className="form-field" style={{ flex: '0 1 140px' }}>
            <label className="form-label" htmlFor="par_int">PAR Interval (minutes)</label>
            <input
              id="par_int"
              type="number"
              className="form-input"
              value={operationalPeriod.par_check_interval}
              onChange={(e) => handleOperationalPeriodChange('par_check_interval', e.target.value)}
              placeholder="e.g. 60"
              disabled={operationalPeriod.par_check_interval === 0}
              min="0"
            />
          </div>
          <button
            type="button"
            className={`action-btn ${operationalPeriod.par_check_interval === 0 ? 'action-btn-primary' : 'action-btn-secondary'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              handleOperationalPeriodChange('par_check_interval', operationalPeriod.par_check_interval === 0 ? 60 : 0);
            }}
          >
            {operationalPeriod.par_check_interval === 0 ? 'Enable PAR' : 'Disable PAR'}
          </button>
          <div>
            {existingId && (
              <button
                type="button"
                className={`action-btn ${isStreamEnabled ? 'action-btn-secondary' : 'action-btn-primary'}`}
                style={{ whiteSpace: 'nowrap' }}
                onClick={handleToggleSarStream}
                disabled={isStreamLoading || !targetOpId}
              >
                {isStreamLoading ? 'Updating...' : (isStreamEnabled ? 'Disable SARStream' : 'Enable SARStream')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="timing-row" style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
        <div className="form-field">
          <label className="form-label" htmlFor="op_start">OP Start Date / Time</label>
          <input
            id="op_start"
            type="datetime-local"
            className="form-input"
            value={operationalPeriod.start_datetime}
            onChange={(e) => handleOperationalPeriodChange('start_datetime', e.target.value)}
          />
        </div>

        {existingId && (
          <>
            <div className="form-field">
              <label className="form-label" htmlFor="op_end">OP End Date / Time</label>
              <input
                id="op_end"
                type="datetime-local"
                className="form-input"
                value={operationalPeriod.end_datetime}
                onChange={(e) => handleOperationalPeriodChange('end_datetime', e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="op_obj">Operational Period Objective</label>
        <textarea
          id="op_obj"
          className="form-textarea"
          value={operationalPeriod.situation_narrative}
          onChange={(e) => handleOperationalPeriodChange('situation_narrative', e.target.value)}
          placeholder="Operational period objective for the current operational period"
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="sa_narr">Situational Awareness Narrative</label>
        <textarea
          id="sa_narr"
          className="form-textarea"
          value={operationalPeriod.situational_awareness_narrative}
          onChange={(e) => handleOperationalPeriodChange('situational_awareness_narrative', e.target.value)}
          placeholder="Situational awareness narrative for the current operational period"
        />
      </div>
    </div>
  );
};

export default OpPeriodFormSection;