import React, { useState, useEffect } from 'react';
import Flag from 'react-world-flags';

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import iocToFlagCodeMap from '../../constants/iocToFlagCodeMap';

function LandingSailorPage() {
  const [sailors, setSailors] = useState([]);
  const [editingSailorId, setEditingSailorId] = useState(null);
  const [editedSailor, setEditedSailor] = useState({});
  const [sortCriteria, setSortCriteria] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);

  const displayAlert = (message) => {
    setAlertMessage(message);
    setAlertVisible(true);
  };
  const loadSailors = async () => {
    try {
      const data = await window.electron.sqlite.sailorDB.readAllSailors();
      setSailors(data);
    } catch (error) {
      console.error('Error loading sailors:', error);
    }
  };

  useEffect(() => {
    loadSailors();
  }, []);

  // CSV export using semicolon as a delimiter (removed header row)
  const handleExportCSV = () => {
    if (!sailors.length) return;

    // Desired columns for export
    const columns = [
      'name',
      'surname',
      'birthday',
      'sail_number',
      'country',
      'model',
      'gender',
      'club_name',
      'club_country',
    ];
    const csvRows = [];
    // Removed header row
    // csvRows.push(columns.join(';'));

    sailors.forEach((row) => {
      // extract desired field values in defined order
      const values = columns.map((col) => row[col] || '');
      csvRows.push(values.join(';'));
    });
    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.setAttribute('href', url);
    a.setAttribute('download', 'sailors_export.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // XLSX export using ExcelJS and file-saver from static import
  const handleExportXLSX = async () => {
    if (!sailors.length) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sailors');
    worksheet.columns = [
      { header: 'Name', key: 'Name', width: 20 },
      { header: 'Surname', key: 'Surname', width: 20 },
      { header: 'Birthday', key: 'Birthday', width: 20 },
      { header: 'Sail Number', key: 'Sail Number', width: 15 },
      { header: 'Country', key: 'Country', width: 20 },
      { header: 'Model', key: 'Model', width: 20 },
      { header: 'Gender', key: 'Gender', width: 15 },
      { header: 'Club', key: 'Club', width: 20 },
      { header: 'Club Country', key: 'Club Country', width: 20 },
    ];

    sailors.forEach((row) => {
      worksheet.addRow({
        Name: row.name || '',
        Surname: row.surname || '',
        Birthday: row.birthday || '',
        'Sail Number': row.sail_number || '',
        Country: row.country || '',
        Model: row.model || '',
        Gender: row.gender || '',
        Club: row.club_name || '',
        'Club Country': row.club_country || '',
      });
    });

    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, 'sailors_export.xlsx'); // Use statically imported saveAs
    } catch (error) {
      console.error('Error exporting XLSX file for sailors:', error);
    }
  };

  const handleEditClick = (sailor) => {
    const rowId = `${sailor.boat_id}-${sailor.sail_number}`;
    setEditingSailorId(rowId);
    setEditedSailor({
      ...sailor,
      originalClubName: sailor.club_name,
      club: sailor.club_name,
      club_country: sailor.club_country,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedSailor((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const sailorData = {
        originalClubName: editedSailor.club,
        name: editedSailor.name,
        surname: editedSailor.surname,
        birthday: editedSailor.birthday,
        gender: editedSailor.gender,
        club_name: editedSailor.club,
        club_country: editedSailor.club_country,
        boat_id: editedSailor.boat_id,
        sail_number: editedSailor.sail_number,
        country: editedSailor.country,
        model: editedSailor.model,
      };
      const result =
        await window.electron.sqlite.sailorDB.updateSailor(sailorData);
      console.log('Update result:', result);
      setEditingSailorId(null);
      loadSailors();
    } catch (error) {
      console.error('Error updating sailor:', error);
      displayAlert(`Error updating sailor: ${error.message || error}`);
    }
  };

  const handleCancel = () => {
    setEditingSailorId(null);
    setEditedSailor({});
  };

  const handleSort = (criteria) => {
    if (sortCriteria === criteria) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCriteria(criteria);
      setSortDirection('asc');
    }
  };

  const sortedSailors = [...sailors].sort((a, b) => {
    let aValue = a[sortCriteria];
    let bValue = b[sortCriteria];
    if (sortCriteria === 'sail_number') {
      aValue = parseInt(aValue, 10);
      bValue = parseInt(bValue, 10);
    }
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIndicator = (criteria) => {
    if (sortCriteria === criteria) {
      return sortDirection === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  const getFlagCode = (iocCode) => {
    return iocToFlagCodeMap[iocCode] || iocCode;
  };

  return (
    <div style={{ padding: '20px' }}>
      <button
        type="button"
        onClick={() => window.history.back()}
        style={{ marginBottom: '10px' }}
      >
        Back
      </button>
      <h2>Sailors & Boats</h2>
      <button
        type="button"
        onClick={handleExportCSV}
        style={{ marginBottom: '10px', marginRight: '10px' }}
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={handleExportXLSX}
        style={{ marginBottom: '10px' }}
      >
        Export XLSX
      </button>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{ cursor: 'pointer' }}
              onClick={() => handleSort('country')}
            >
              Country{renderSortIndicator('country')}
            </th>
            <th
              style={{ cursor: 'pointer' }}
              onClick={() => handleSort('sail_number')}
            >
              Sail Number{renderSortIndicator('sail_number')}
            </th>
            <th
              style={{ cursor: 'pointer' }}
              onClick={() => handleSort('model')}
            >
              Model{renderSortIndicator('model')}
            </th>
            <th
              style={{ cursor: 'pointer' }}
              onClick={() => handleSort('name')}
            >
              Skipper{renderSortIndicator('name')}
            </th>
            <th
              style={{ cursor: 'pointer' }}
              onClick={() => handleSort('gender')}
            >
              Gender{renderSortIndicator('gender')}
            </th>
            <th
              style={{ cursor: 'pointer' }}
              onClick={() => handleSort('club')}
            >
              Club{renderSortIndicator('club')}
            </th>
            <th>Club Country</th>
            <th
              style={{ cursor: 'pointer' }}
              onClick={() => handleSort('birthday')}
            >
              Date of Birth{renderSortIndicator('birthday')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedSailors.map((sailor) => {
            const rowId = `${sailor.boat_id}-${sailor.sail_number}`;
            return (
              <tr key={rowId} style={{ borderBottom: '1px solid #ccc' }}>
                <td>
                  {editingSailorId === rowId ? (
                    <input
                      type="text"
                      name="country"
                      value={editedSailor.country}
                      onChange={handleInputChange}
                      style={{ width: '50px' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Flag
                        code={getFlagCode(sailor.country)}
                        style={{ width: '30px', marginRight: '5px' }}
                      />
                      {sailor.country}
                    </div>
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <input
                      type="text"
                      name="sail_number"
                      value={editedSailor.sail_number}
                      onChange={handleInputChange}
                      style={{ width: '70px' }}
                    />
                  ) : (
                    sailor.sail_number
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <input
                      type="text"
                      name="model"
                      value={editedSailor.model}
                      onChange={handleInputChange}
                      style={{ width: '70px' }}
                    />
                  ) : (
                    sailor.model
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <>
                      <input
                        key="firstName"
                        type="text"
                        name="name"
                        value={editedSailor.name}
                        onChange={handleInputChange}
                        placeholder="First name"
                        style={{ width: '100px' }}
                      />
                      <input
                        key="surname"
                        type="text"
                        name="surname"
                        value={editedSailor.surname}
                        onChange={handleInputChange}
                        placeholder="Surname"
                        style={{ width: '100px', marginLeft: '5px' }}
                      />
                    </>
                  ) : (
                    `${sailor.name} ${sailor.surname}`
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <select
                      name="gender"
                      value={editedSailor.gender}
                      onChange={handleInputChange}
                      style={{ width: '70px' }}
                    >
                      <option value="" disabled>
                        Select Gender
                      </option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    sailor.gender
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <input
                      type="text"
                      name="club"
                      value={editedSailor.club}
                      onChange={handleInputChange}
                      style={{ width: '100px' }}
                    />
                  ) : (
                    sailor.club_name
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <input
                      type="text"
                      name="club_country"
                      value={editedSailor.club_country}
                      onChange={handleInputChange}
                      style={{ width: '100px', padding: '5px' }}
                    />
                  ) : (
                    sailor.club_country
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <input
                      type="date"
                      name="birthday"
                      value={editedSailor.birthday}
                      onChange={handleInputChange}
                      style={{ width: '70px' }}
                    />
                  ) : (
                    new Date(sailor.birthday).toLocaleDateString()
                  )}
                </td>
                <td>
                  {editingSailorId === rowId ? (
                    <>
                      <button type="button" onClick={handleSave}>
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        style={{ marginLeft: '5px' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEditClick(sailor)}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {alertVisible && (
            <div
              className="custom-alert-overlay"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
              }}
            >
              <div
                className="custom-alert-window"
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '5px',
                  textAlign: 'center',
                }}
              >
                <p>{alertMessage}</p>
                <button type="button" onClick={() => setAlertVisible(false)}>
                  OK
                </button>
              </div>
            </div>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default LandingSailorPage;
