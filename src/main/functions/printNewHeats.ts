import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import LatestHeats from './LastestHeats';
import iocToFlagCodeMap from '../../renderer/constants/iocToFlagCodeMap';
import iocCountries from '../../renderer/constants/iocCountries.json'; // new import
import NotoSansBlack from '../../renderer/constants/NotoSansBlack.json';
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

export default async function printNewHeats(
  event: { event_name: any },
  heats: string | any[],
  format: string,
  finalSeriesStarted: boolean,
) {
  console.log('Heats to print (before filtering):', heats);
  if (!Array.isArray(heats) || heats.length === 0) {
    alert('No heats available to print. Try to reload page with CTRL+R.');
    return;
  }

  const eventName = event.event_name;
  const heatsFiltered = finalSeriesStarted
    ? heats.filter((heat) => heat.heat_type === 'Final')
    : heats;
  const latestHeats = LatestHeats(heatsFiltered);
  console.log('Latest heats to print:', latestHeats);
  const heatsToPrint = latestHeats;

  await Promise.all(
    heatsToPrint.map(async (heat) => {
      if (!Array.isArray(heat.boats) || heat.boats.length === 0) {
        try {
          heat.boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
            heat.heat_id,
          );
        } catch (error) {
          console.error(
            `Error fetching boats for heat ${heat.heat_name}:`,
            error,
          );
          heat.boats = [];
        }
      }
    }),
  );

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('New Heats');

    // Insert event header row before listing heats
    worksheet.insertRow(1, [eventName]);
    worksheet.insertRow(2, []);

    worksheet.columns = [
      { key: 'col1', width: 30 },
      { key: 'col2', width: 20 },
      { key: 'col3', width: 20 },
    ];

    heatsToPrint.forEach((heat) => {
      const headerRow = worksheet.addRow([`Heat: ${heat.heat_name}`]);
      headerRow.font = { bold: true };
      worksheet.mergeCells(`A${headerRow.number}:C${headerRow.number}`);
      const subHeaderRow = worksheet.addRow([
        'Sailor Name',
        'Country',
        'Sail Number',
      ]);
      subHeaderRow.font = { bold: true };
      heat.boats.forEach(
        (boat: { name: any; surname: any; country: any; sail_number: any }) => {
          worksheet.addRow([
            `${boat.name} ${boat.surname}`,
            boat.country,
            boat.sail_number,
          ]);
        },
      );
      worksheet.addRow([]);
    });

    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      let filename: string;
      if (finalSeriesStarted) {
        filename = `${eventName}_final_series_heats.xlsx`;
      } else {
        const raceMatch =
          heatsToPrint.length > 0
            ? heatsToPrint[0].heat_name.match(/(?:Q|F)Race\s+(\d+),/)
            : null;
        const raceNumber = raceMatch ? raceMatch[1] : 'unknown';
        filename = `${eventName}_heat_${raceNumber}.xlsx`;
      }
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error exporting Excel file:', error);
    }
  } else if (format === 'pdf') {
    const doc = new JsPDF();

    // Embed custom NotosansBlack font
    const notosansBlackBase64 = NotoSansBlack.fontBase64;
    doc.addFileToVFS('NotosansBlack.ttf', notosansBlackBase64);
    doc.addFont('NotosansBlack.ttf', 'NotosansBlack', 'normal');
    doc.setFont('NotosansBlack', 'normal');

    // Removed "New Heats" text; only showing event name as header.
    doc.setFontSize(16);
    doc.text(eventName, 14, 10);
    let finalY = 16;

    heatsToPrint.forEach((heat) => {
      doc.setFontSize(14);
      doc.text(`Heat: ${heat.heat_name}`, 14, finalY);
      const header = ['Sailor Name', 'Country', 'Sail Number'];
      const body = heat.boats.map(
        (boat: { name: any; surname: any; country: any; sail_number: any }) => [
          `${boat.name} ${boat.surname}`,
          boat.country,
          boat.sail_number,
        ],
      );
      autoTable(doc, {
        head: [header],
        body,
        theme: 'grid',
        styles: {
          cellWidth: 'wrap',
          font: 'NotosansBlack',
          fontStyle: 'normal',
        },
        headStyles: { font: 'NotosansBlack', fontStyle: 'normal' },
        startY: finalY + 10,
        didDrawPage: (data) => {
          finalY = data.cursor ? data.cursor.y + 10 : finalY + 10;
        },
      });
    });

    let pdfFilename: string;
    if (finalSeriesStarted) {
      pdfFilename = `${eventName}_final_series_heats.pdf`;
    } else {
      const raceMatch =
        heatsToPrint.length > 0
          ? heatsToPrint[0].heat_name.match(/(?:Q|F)Race\s+(\d+),/)
          : null;
      const raceNumber = raceMatch ? raceMatch[1] : 'unknown';
      pdfFilename = `${eventName}_heat_${raceNumber}.pdf`;
    }
    doc.save(pdfFilename);
  } else if (format === 'html') {
    let html = `<html><head><title>${eventName} New Heats</title>
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    </style>
    </head><body>`;
    // Removed "New Heats" text; only showing event name.
    html += `<h2>${eventName}</h2>`;
    heatsToPrint.forEach((heat) => {
      html += `<h2>Heat: ${heat.heat_name}</h2>`;
      html += `<table><thead><tr>
        <th>Sailor Name </th>
        <th>Country</th>
        <th>Sail Number</th>
        </tr></thead><tbody>`;
      heat.boats.forEach(
        (boat: { name: any; surname: any; country: any; sail_number: any }) => {
          html += `<tr>
        <td>${boat.name} ${boat.surname}</td>
                <td>${getFlag(boat.country || 'N/A')} ${boat.country || 'N/A'}</td>

        <td>${boat.sail_number}</td>
        </tr>`;
        },
      );
      html += `</tbody></table>`;
    });
    html += `</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    let htmlFilename: string;
    if (finalSeriesStarted) {
      htmlFilename = `${eventName}_final_series_heats.html`;
    } else {
      const raceMatch =
        heatsToPrint.length > 0
          ? heatsToPrint[0].heat_name.match(/(?:Q|F)Race\s+(\d+),/)
          : null;
      const raceNumber = raceMatch ? raceMatch[1] : 'unknown';
      htmlFilename = `${eventName}_heat_${raceNumber}.html`;
    }
    saveAs(blob, htmlFilename);
  }
}
