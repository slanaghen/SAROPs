import React from 'react';

const VehicleColumn = ({
  vehicles,
  filter,
  onFilterChange,
  onNew,
  onEdit,
  onCheckOut,
  isVehicleHighlighted,
  draggedItem,
  dndHandlers,
}) => {
  return (
    <div className="section vehicles-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Staged Vehicles ({vehicles.length})</h2>
        <div>
          <button className="btn btn-primary" onClick={onNew} style={{ fontSize: '14px' }}>
            New Vehicle
          </button>
        </div>
      </div>

      <div className="responder-filters" style={{ padding: '0 16px 12px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Search designation or type..."
          value={filter}
          data-lpignore="true"
          onChange={(e) => onFilterChange(e.target.value)}
          style={{ flex: 1, padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
        />
        {filter && (
          <button className="btn btn-secondary btn-sm" onClick={() => onFilterChange('')} style={{ fontSize: '10px' }}>
            Clear
          </button>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="empty-state">
          <p>No available vehicles in staging</p>
        </div>
      ) : (
        <div className="vehicle-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {vehicles.map(vehicle => (
            <div
              key={vehicle.vehicle_id}
              className={`responder-card ${isVehicleHighlighted(vehicle.vehicle_id) ? 'selected' : ''} ${draggedItem?.id === vehicle.vehicle_id ? 'dragging' : ''} ${vehicle.status?.toLowerCase() === 'staged' ? 'staged-resource' : ''}`}
              draggable="true"
              onClick={() => onEdit(vehicle)}
              onDragStart={(e) => dndHandlers.handleDragStart(e, vehicle.vehicle_id, 'vehicle')}
              onDragEnd={dndHandlers.handleDragEnd}
              onDragOver={(e) => dndHandlers.handleDragOver(e, 'vehicle')}
              onDragEnter={(e) => dndHandlers.handleDragEnter(e, vehicle.vehicle_id, 'vehicle')}
              onDragLeave={dndHandlers.handleDragLeave}
              onDrop={(e) => dndHandlers.handleDrop(e, vehicle.vehicle_id, 'vehicle')}
              role="option"
              tabIndex={0}
            >
              <div className="responder-header">
                <div className="responder-name clickable-name">{vehicle.designation}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                  <span className={`status-indicator ${vehicle.status?.toLowerCase() || ''}`}>
                    {vehicle.status}
                  </span>
                </div>
              </div>
              <div className="responder-agency-meta">
                {vehicle.type}
              </div>

              <div className="team-actions" style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => { e.stopPropagation(); onCheckOut(vehicle); }}
                  disabled={vehicle.status?.toLowerCase() !== 'staged'}
                  style={{ color: '#dc2626' }}
                >
                  Check Out
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VehicleColumn;