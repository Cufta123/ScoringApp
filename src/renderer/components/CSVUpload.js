import React, { useState } from 'react';
import PropTypes from 'prop-types';

function CSVUpload({ eventId, onImportComplete }) {
  const [showPopup, setShowPopup] = useState(false);

  const handleUpload = async () => {
    /* eslint-disable no-console */
    const result = await window.electron.ipcRenderer.invoke('dialog:openFile', {
      title: 'Select CSV file',
      properties: ['openFile'],
      filters: [{ name: 'CSV files', extensions: ['csv'] }],
    });
    if (!result || !result.filePaths || result.filePaths.length === 0) return;
    const filePath = result.filePaths[0];

    try {
      const importResult = await window.electron.ipcRenderer.invoke(
        'importCSV',
        { filePath, eventId },
      );
      console.log(`Imported ${importResult.imported} records.`);
      if (onImportComplete) onImportComplete();
    } catch (error) {
      console.error('CSV import failed:', error);
      alert(`CSV import failed: ${error.message}`);
    }
    /* eslint-enable no-console */
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        marginTop: '50px',
      }}
    >
      {showPopup && (
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            left: '0',
            backgroundColor: '#71c1f0',
            border: '1px 007bff',
            borderRadius: '5px',
            zIndex: 10,
            width: '500px',
            textAlign: 'center',
          }}
        >
          CSV format:
          Name;Surname;Date;SailNumber;Nation;BoatType;Gender;Club;ClubNation
        </div>
      )}
      <button
        type="button"
        onClick={handleUpload}
        onMouseEnter={() => setShowPopup(true)}
        onMouseLeave={() => setShowPopup(false)}
        style={{ padding: '10px 20px' }}
      >
        Upload CSV
      </button>
    </div>
  );
}

CSVUpload.propTypes = {
  eventId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onImportComplete: PropTypes.func,
};
export default CSVUpload;
