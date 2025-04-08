import React from 'react';
import PropTypes from 'prop-types';

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="custom-alert-overlay">
      <div className="custom-alert-window">
        <p>{message}</p>
        <button
          type="button"
          onClick={onConfirm}
          style={{ marginRight: '10px' }}
        >
          Yes
        </button>
        <button type="button" onClick={onCancel}>
          No
        </button>
      </div>
    </div>
  );
}

ConfirmDialog.propTypes = {
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmDialog;
