import React, { useState } from 'react';
import PropTypes from 'prop-types';

function ConfirmDeleteDialog({ onConfirm, onCancel }) {
  const [confirmationText, setConfirmationText] = useState('');

  const handleInputChange = (e) => {
    setConfirmationText(e.target.value);
  };

  const isConfirmEnabled = confirmationText === 'delete databse';

  return (
    <div className="custom-alert-overlay">
      <div className="custom-alert-window">
        <p>Type &quot;delete databse&quot; to confirm.</p>
        <input
          type="text"
          value={confirmationText}
          onChange={handleInputChange}
          placeholder='Type "delete databse"'
          style={{ width: '100%', padding: '5px', marginTop: '10px' }}
        />
        <div style={{ marginTop: '10px' }}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isConfirmEnabled}
            style={{
              marginLeft: '10px',
              backgroundColor: 'red',
              color: 'white',
            }}
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

ConfirmDeleteDialog.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmDeleteDialog;
