import React from 'react';
import PropTypes from 'prop-types';

function CSVUpload({ eventId, onImportComplete }) {
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
    <button type="button" onClick={handleUpload}>
      Upload CSV
    </button>
  );
}

CSVUpload.propTypes = {
  eventId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onImportComplete: PropTypes.func, // optional callback to refresh
};

CSVUpload.defaultProps = {
  onImportComplete: () => {},
};

export default CSVUpload;
