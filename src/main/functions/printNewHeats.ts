import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const getLatestHeats = (heats: any[]) => {
  // Reduce heats to the latest (highest numeric suffix) for each base letter
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
  // Return an array of latest heats from each base group
  return Object.values(latestHeatsMap).map(
    (entry) => (entry as { suffix: number; heat: any }).heat,
  );
};

export default async function printNewHeats(
  event: any,
  heats: string | any[],
  format: 'excel' | 'pdf' | 'html',
) {
  console.log('Heats to print (before filtering):', heats);
  if (!Array.isArray(heats) || heats.length === 0) {
    alert('No heats available to print.');
    return;
  }

  // Retrieve event name from the event object
  const eventName = event.event_name;
  // Filter for only the latest heats
  const latestHeats = getLatestHeats(heats);
  console.log('Latest heats to print:', latestHeats);

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('New Heats');

    // Define column widths (adjust as needed)
    worksheet.columns = [
      { key: 'col1', width: 30 },
      { key: 'col2', width: 20 },
      { key: 'col3', width: 20 },
    ];

    // Use a for-of loop to allow async/await
    await Promise.all(
      latestHeats.map(async (heat) => {
        // If heat.boats is empty, fetch them from the DB
        if (!Array.isArray(heat.boats) || heat.boats.length === 0) {
          try {
            const boats =
              await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
                heat.heat_id,
              );
            heat.boats = boats;
          } catch (error) {
            console.error(
              `Error fetching boats for heat ${heat.heat_name}:`,
              error,
            );
            heat.boats = [];
          }
        }

        // Write the heat name as a header row and merge cells
        const headerRow = worksheet.addRow([`Heat: ${heat.heat_name}`]);
        headerRow.font = { bold: true };
        worksheet.mergeCells(`A${headerRow.number}:C${headerRow.number}`);

        // Write sub-header for boat details
        const subHeaderRow = worksheet.addRow([
          'Sailor Name',
          'Country',
          'Boat Number',
        ]);
        subHeaderRow.font = { bold: true };

        // Write a row for each boat in the current heat
        if (Array.isArray(heat.boats) && heat.boats.length > 0) {
          heat.boats.forEach(
            (boat: {
              name: any;
              surname: any;
              country: any;
              sail_number: any;
            }) => {
              const sailorName = `${boat.name} ${boat.surname}`;
              worksheet.addRow([sailorName, boat.country, boat.sail_number]);
            },
          );
        } else {
          // If still no boats are available, show notice
          worksheet.addRow(['No boats available', '', '']);
        }

        // Add an empty row for spacing
        worksheet.addRow([]);

        console.log(
          `Worksheet row count for ${heat.heat_name}:`,
          worksheet.rowCount,
        );
      }),
    );

    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      // Build the filename as "nameOfTheEvent_heat_x" where x is the heat number
      // For example, if heat.heat_name is "Heat A1", we remove "Heat " to get "A1"

      const heatNumber =
        latestHeats.length > 0
          ? (latestHeats[0].heat_name.match(/Heat [A-Z]*(\d+)$/) || [
              null,
              'unknown',
            ])[1]
          : 'unknown';
      saveAs(blob, `${eventName}_heat_${heatNumber}.xlsx`);
    } catch (error) {
      console.error(`Error exporting Excel file for heat :`, error);
    }
  } else if (format === 'pdf') {
    const doc = new JsPDF();
    doc.setFontSize(16);
    doc.text('New Heats', 14, 10);

    let finalY = 20;
    latestHeats.forEach((heat) => {
      doc.setFontSize(14);
      doc.text(`Heat: ${heat.heat_name}`, 14, finalY);

      const header = ['Sailor Name', 'Country', 'Boat Number'];
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
          if (data.cursor) {
            finalY = data.cursor.y + 10;
          }
        },
      });
    });

    doc.save(`${eventName}_new_heats.pdf`);
  } else if (format === 'html') {
    let html = `<html><head><title>${eventName} New Heats</title>
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    </style>
    </head><body>`;
    html += `<h1>New Heats</h1>`;

    latestHeats.forEach((heat) => {
      html += `<h2>Heat: ${heat.heat_name}</h2>`;
      html += `<table><thead><tr>
        <th>Sailor Name</th>
        <th>Country</th>
        <th>Boat Number</th>
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
    saveAs(blob, `${eventName}_new_heats.html`);
  }
}
