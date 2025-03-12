import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default async function printLeaderboard(
  leaderboard: any[],
  finalSeriesStarted: boolean,
  sortedGroups: string[],
  groupedLeaderboard: { [group: string]: any[] },
  eventId: string,
  format: 'excel' | 'pdf' | 'html',
) {
  const eventName = await window.electron.sqlite.eventDB.getEventName(eventId);
  const raceType = finalSeriesStarted ? 'final' : 'qualify';
  const raceNumber =
    leaderboard.length > 0 && leaderboard[0].races
      ? leaderboard[0].races.length
      : 'unknown';

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leaderboard');

    sortedGroups.forEach((group) => {
      worksheet.addRow([`${group} Group`]);

      // Add the header row for each group
      const maxRaceCount = Math.max(
        ...groupedLeaderboard[group].map((entry) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );
      const groupHeader = [
        'Rank',
        'Name',
        'Country',
        'Boat Number',
        'Boat Type',
        ...Array.from({ length: maxRaceCount }, (_, i) => `Race ${i + 1}`),
        'Total Points',
      ];
      worksheet.addRow(groupHeader);

      groupedLeaderboard[group]?.forEach((entry, index) => {
        const row = [
          index + 1,
          `${entry.name} ${entry.surname}`,
          entry.country,
          entry.boat_number,
          entry.boat_type,
          ...entry.races,
          finalSeriesStarted
            ? entry.total_points_combined
            : entry.total_points_event,
        ];
        worksheet.addRow(row);
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    saveAs(blob, `${eventName}_${raceType}_race_${raceNumber}.xlsx`);
  } else if (format === 'pdf') {
    const doc = new JsPDF();
    let startY = 20;

    doc.setFontSize(16);
    doc.text(
      `${finalSeriesStarted ? 'Final Leaderboard' : 'Leaderboard'}`,
      14,
      10,
    );

    sortedGroups.forEach((group) => {
      const groupEntries = groupedLeaderboard[group] || [];
      const maxRaceCount = Math.max(
        ...groupEntries.map((entry) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      const headerRow = [
        'Rank',
        'Name',
        'Country',
        'Boat Number',
        'Boat Type',
        ...Array.from({ length: maxRaceCount }, (_, i) => `Race ${i + 1}`),
        'Total Points',
      ];

      doc.setFontSize(14);
      doc.text(`${group} Group`, 14, startY);
      startY += 6;

      const bodyData = groupEntries.map((entry, idx) => {
        const row = [];
        row.push((idx + 1).toString());
        row.push(`${entry.name} ${entry.surname}`);
        row.push(entry.country);
        row.push(entry.boat_number.toString());
        row.push(entry.boat_type);
        for (let i = 0; i < maxRaceCount; i += 1) {
          row.push(
            entry.races && entry.races[i] !== undefined
              ? entry.races[i].toString()
              : '',
          );
        }
        row.push(
          finalSeriesStarted
            ? entry.total_points_combined
            : entry.total_points_event,
        );
        return row;
      });

      autoTable(doc, {
        startY,
        head: [headerRow],
        body: bodyData,
        theme: 'grid',
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
      if (startY > 270) {
        doc.addPage();
        startY = 20;
      }
    });

    doc.save(`${eventName}_${raceType}_race_${raceNumber}.pdf`);
  } else if (format === 'html') {
    let html = `<html><head><title>${eventName} Leaderboard</title>
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    </style>
    </head><body>`;

    html += `<h1>${finalSeriesStarted ? 'Final Leaderboard' : 'Leaderboard'}</h1>`;

    sortedGroups.forEach((group) => {
      html += `<h2>${group} Group</h2>`;
      html += `<table><thead><tr>
      <th>Rank</th>
      <th>Name</th>
      <th>Country</th>
      <th>Boat Number</th>
      <th>Boat Type</th>`;
      const maxRaceCount = Math.max(
        ...groupedLeaderboard[group].map((entry) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );
      for (let i = 0; i < maxRaceCount; i++) {
        html += `<th>Race ${i + 1}</th>`;
      }
      html += `<th>Total Points</th></tr></thead><tbody>`;
      groupedLeaderboard[group]?.forEach((entry, index) => {
        html += `<tr>
        <td>${index + 1}</td>
        <td>${entry.name} ${entry.surname}</td>
        <td>${entry.country}</td>
        <td>${entry.boat_number}</td>
        <td>${entry.boat_type}</td>`;
        for (let i = 0; i < maxRaceCount; i++) {
          html += `<td>${entry.races[i] !== undefined ? entry.races[i] : ''}</td>`;
        }
        html += `<td>${finalSeriesStarted ? entry.total_points_combined : entry.total_points_event}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    });

    html += `</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, `${eventName}_${raceType}_race_${raceNumber}.html`);
  }
}
