import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import iocToFlagCodeMap from '../../renderer/constants/iocToFlagCodeMap';
import iocCountries from '../../renderer/constants/iocCountries.json'; // new import
import NotoSansBlack from '../../renderer/constants/NotoSansBlack.json'; // <-- add this import

// Helper to return the flag based on the provided country value.
function countryCodeToEmoji(code: string): string {
  const codePoints = Array.from(code.toUpperCase()).map(
    (char) => 127397 + char.charCodeAt(0),
  );
  return String.fromCodePoint(...codePoints);
}

// Helper to return the flag icon (emoji) based on the provided country value.
function getFlag(country: string): string {
  // If the value is already an IOC code, return the mapped flag emoji.
  const iocCode = iocToFlagCodeMap[country];
  if (iocCode) return countryCodeToEmoji(iocCode);
  // Otherwise, search for a matching country name (case-insensitive)
  const key = Object.keys(iocCountries).find(
    (k) => iocCountries[k].toLowerCase() === country.toLowerCase(),
  );
  return key ? countryCodeToEmoji(iocToFlagCodeMap[key] || country) : country;
}

export default async function printStartingList(
  event: any,
  sailors: any[],
  format: 'excel' | 'pdf' | 'html',
) {
  if (!Array.isArray(sailors) || sailors.length === 0) {
    alert('No sailors available to print.');
    return;
  }

  const eventName = event.event_name;

  // Sort sailors by Country, then by Club, then by Sail Number.
  const sortedSailors = sailors.sort((a, b) => {
    const countryA = (a.country || a.boat_country || '').toLowerCase();
    const countryB = (b.country || b.boat_country || '').toLowerCase();
    if (countryA < countryB) return -1;
    if (countryA > countryB) return 1;

    const clubA = (a.club || a.club_name || '').toLowerCase();
    const clubB = (b.club || b.club_name || '').toLowerCase();
    if (clubA < clubB) return -1;
    if (clubA > clubB) return 1;

    const boatNumA = a.sail_number ? a.sail_number.toString() : '';
    const boatNumB = b.sail_number ? b.sail_number.toString() : '';
    return boatNumA.localeCompare(boatNumB, undefined, { numeric: true });
  });

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Competitor List');
    // Postavite A4 format (u ExcelJS, paperSize 9 označava A4)
    worksheet.pageSetup = { paperSize: 9 };

    // Updated column order: Name, Surname, Flag, Category, Sail Number, Country, Model, Club
    worksheet.columns = [
      { key: 'name', header: 'Name', width: 20 },
      { key: 'surname', header: 'Surname', width: 20 },
      { key: 'category', header: 'Category', width: 15 },
      { key: 'sail_number', header: 'Sail Number', width: 15 },
      { key: 'country', header: 'Country', width: 20 },
      { key: 'model', header: 'Model', width: 15 },
      { key: 'club', header: 'Club', width: 20 },
    ];

    worksheet.insertRow(1, [eventName]);
    worksheet.insertRow(2, []);
    sortedSailors.forEach((sailor) => {
      worksheet.addRow({
        name: sailor.name || 'N/A',
        surname: sailor.surname || 'N/A',
        category: sailor.category || 'N/A',
        sail_number: sailor.sail_number || 'N/A',
        country: sailor.country || 'N/A',
        model: sailor.model || 'N/A',
        club: sailor.club || sailor.club_name || 'N/A',
      });
    });

    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `${eventName}_starting_list.xlsx`);
    } catch (error) {
      console.error('Error exporting Excel file for starting list:', error);
    }
  } else if (format === 'pdf') {
    const doc = new JsPDF();

    // Embed custom NotosansBlack font
    const notosansBlackBase64 = NotoSansBlack.fontBase64;
    doc.addFileToVFS('NotosansBlack.ttf', notosansBlackBase64);
    doc.addFont('NotosansBlack.ttf', 'NotosansBlack', 'normal');
    doc.setFont('NotosansBlack', 'normal');

    doc.setFontSize(16);
    doc.text('Starting List', 14, 10);
    doc.setFontSize(12);
    doc.text(`Event: ${eventName}`, 14, 16);
    const startY = 22;

    // Updated header row order
    const header = [
      'Name',
      'Surname',
      'Category',
      'Sail Number',
      'Country',
      'Model',
      'Club',
    ];
    const body = sortedSailors.map((sailor) => [
      sailor.name || 'N/A',
      sailor.surname || 'N/A',
      sailor.category || 'N/A',
      sailor.sail_number || 'N/A',
      sailor.country || 'N/A',
      sailor.model || 'N/A',
      sailor.club || sailor.club_name || 'N/A',
    ]);

    autoTable(doc, {
      startY,
      head: [header],
      body,
      theme: 'grid',
      styles: {
        cellWidth: 'wrap',
        font: 'NotosansBlack',
        fontStyle: 'normal',
      },
      headStyles: { font: 'NotosansBlack', fontStyle: 'normal' },
    });

    doc.save(`${eventName}_starting_list.pdf`);
  } else if (format === 'html') {
    // Build HTML table with updated column order
    let html = `<html><head><title>${eventName} Starting List</title>
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    </style>
    </head><body>`;
    html += `<h1>Starting List</h1>`;
    html += `<h2>Event: ${eventName}</h2>`;
    html += `<table><thead><tr>
      <th>Name</th>
      <th>Surname</th>
      <th>Flag</th>
      <th>Category</th>
      <th>Sail Number</th>
      <th>Country</th>
      <th>Model</th>
      <th>Club</th>
      </tr></thead><tbody>`;
    sortedSailors.forEach((sailor) => {
      html += `<tr>
        <td>${sailor.name || 'N/A'}</td>
        <td>${sailor.surname || 'N/A'}</td>
        <td>${getFlag(sailor.country || 'N/A')}</td>
        <td>${sailor.category || 'N/A'}</td>
        <td>${sailor.sail_number || 'N/A'}</td>
        <td>${sailor.country || 'N/A'}</td>
        <td>${sailor.model || 'N/A'}</td>
        <td>${sailor.club || sailor.club_name || 'N/A'}</td>
        </tr>`;
    });
    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, `${eventName}_starting_list.html`);
  }
}
