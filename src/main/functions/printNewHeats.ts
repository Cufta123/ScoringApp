import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const getLatestHeats = (heats: any[]) => {
  const latestHeatsMap = heats.reduce(
    (
      acc: { [x: string]: { suffix: number; heat: any } },
      heat: { heat_name: string },
    ) => {
      const match = heat.heat_name.match(/Heat ([A-Z]+)(\d*)/);
      if (match) {
        const [, base, suffix] = match;
        const numericSuffix = suffix ? parseInt(suffix, 10) : 0;
        if (!acc[base] || numericSuffix > acc[base].suffix) {
          acc[base] = { suffix: numericSuffix, heat };
        }
      }
      return acc;
    },
    {},
  );
  return (Object.values(latestHeatsMap) as { suffix: number; heat: any }[]).map(
    (entry) => entry.heat,
  );
};

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
  const latestHeats = getLatestHeats(heatsFiltered);
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
        const heatNumber =
          heatsToPrint.length > 0
            ? (heatsToPrint[0].heat_name.match(/Heat [A-Z]*(\d+)$/) || [
                null,
                'unknown',
              ])[1]
            : 'unknown';
        filename = `${eventName}_heat_${heatNumber}.xlsx`;
      }
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error exporting Excel file:', error);
    }
  } else if (format === 'pdf') {
    const doc = new JsPDF();
    doc.setFontSize(16);
    doc.text('New Heats', 14, 10);
    let finalY = 20;

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
        startY: finalY + 10,
        didDrawPage: (data) => {
          finalY = data.cursor ? data.cursor.y + 10 : finalY + 10;
        },
      });
    });

    const pdfFilename = finalSeriesStarted
      ? `${eventName}_final_series_heats.pdf`
      : `${eventName}_new_heats.pdf`;
    doc.save(pdfFilename);
  } else if (format === 'html') {
    let html = `<html><head><title>${eventName} New Heats</title>
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    </style>
    </head><body>`;
    html += `<h1>New Heats</h1>`;

    heatsToPrint.forEach((heat) => {
      html += `<h2>Heat: ${heat.heat_name}</h2>`;
      html += `<table><thead><tr>
        <th>Sailor Name</th>
        <th>Country</th>
        <th>Sail Number</th>
        </tr></thead><tbody>`;
      heat.boats.forEach(
        (boat: { name: any; surname: any; country: any; sail_number: any }) => {
          html += `<tr>
        <td>${boat.name} ${boat.surname}</td>
        <td>${boat.country}</td>
        <td>${boat.sail_number}</td>
        </tr>`;
        },
      );
      html += `</tbody></table>`;
    });

    html += `</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const htmlFilename = finalSeriesStarted
      ? `${eventName}_final_series_heats.html`
      : `${eventName}_new_heats.html`;
    saveAs(blob, htmlFilename);
  }
}
