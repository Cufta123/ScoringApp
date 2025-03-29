import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default async function printLeaderboard(
  leaderboard: string | any[],
  finalSeriesStarted: boolean,
  sortedGroups: any[],
  groupedLeaderboard: { [x: string]: any },
  eventId: string,
  format: string,
) {
  const eventName = await window.electron.sqlite.eventDB.getEventName(eventId);

  // If finalSeriesStarted is false, we'll label the leaderboard "Qualifying Leaderboard".
  // If finalSeriesStarted is true, we'll label it "Final Leaderboard".
  const leaderboardHeader = finalSeriesStarted
    ? 'Final Leaderboard'
    : 'Qualifying Leaderboard';

  // Determine race type (for filename).
  const raceType = finalSeriesStarted ? 'final' : 'qualify';

  // Determine race number (for filename).
  const raceNumber =
    leaderboard.length > 0 && leaderboard[0].races
      ? leaderboard[0].races.length
      : 'unknown';

  // Build an array of groups to process.
  // If "OverallScores" exists, we include it but label it with our new header
  // instead of printing "Overall Scores".
  const groupsToProcess = [];

  if (groupedLeaderboard.OverallScores) {
    groupsToProcess.push({
      header: leaderboardHeader,
      key: 'OverallScores',
      data: groupedLeaderboard.OverallScores,
    });
  }

  // Add other groups (excluding "OverallScores") if needed.
  sortedGroups.forEach((group: string) => {
    if (group !== 'OverallScores') {
      groupsToProcess.push({
        header: group,
        key: group,
        data: groupedLeaderboard[group] || [],
      });
    }
  });

  if (format === 'excel') {
    // ----- EXCEL EXPORT -----
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leaderboard');

    groupsToProcess.forEach((groupObj) => {
      // Add a row with the group header.
      worksheet.addRow([groupObj.header]);

      // Determine the maximum number of races in this group.
      const maxRaceCount = Math.max(
        ...groupObj.data.map((entry: { races: string | any[] }) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      // Build the header row: add two columns for Total Points and Total Points Adjustet.
      const groupHeader = [
        'Rank',
        'Name',
        'Country',
        'Sail Number',
        'Boat Type',
        ...Array.from({ length: maxRaceCount }, (_, i) => `Race ${i + 1}`),
        'Total Points',
        'Total Points Adjustet',
      ];
      worksheet.addRow(groupHeader);

      // Fill rows for each competitor.
      groupObj.data.forEach(
        (
          entry: {
            name: any;
            surname: any;
            country: any;
            boat_number: any;
            boat_type: any;
            races: any;
            total_points_combined: any;
            total_points_event: any;
            total_raw_points_combined: any;
            total_raw_points: any;
          },
          index: number,
        ) => {
          const row = [
            index + 1,
            `${entry.name} ${entry.surname}`,
            entry.country,
            entry.boat_number,
            entry.boat_type,
            ...entry.races,
            finalSeriesStarted
              ? entry.total_raw_points_combined
              : entry.total_raw_points,
            finalSeriesStarted
              ? entry.total_points_combined
              : entry.total_points_event,
          ];
          worksheet.addRow(row);
        },
      );
    });

    // Generate Excel file and prompt download.
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `${eventName}_${raceType}_race_${raceNumber}.xlsx`);
  } else if (format === 'pdf') {
    // ----- PDF EXPORT -----
    const doc = new JsPDF();
    let startY = 20;

    doc.setFontSize(16);
    doc.text(leaderboardHeader, 14, 10);
    startY = 16;

    groupsToProcess.forEach((groupObj) => {
      doc.setFontSize(14);
      doc.text(groupObj.header, 14, startY);
      startY += 6;

      const maxRaceCount = Math.max(
        ...groupObj.data.map((entry: { races: string | any[] }) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      const headerRow = [
        'Rank',
        'Name',
        'Country',
        'Sail Number',
        'Boat Type',
        ...Array.from({ length: maxRaceCount }, (_, i) => `Race ${i + 1}`),
        'Total Points',
        'Total Points Adjustet',
      ];

      const bodyData = groupObj.data.map(
        (
          entry: {
            name: any;
            surname: any;
            country: any;
            boat_number: { toString: () => any };
            boat_type: any;
            races: { toString: () => any }[];
            total_points_combined: any;
            total_points_event: any;
            total_raw_points_combined: any;
            total_raw_points: any;
          },
          idx: number,
        ) => {
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
              ? entry.total_raw_points_combined
              : entry.total_raw_points,
          );
          row.push(
            finalSeriesStarted
              ? entry.total_points_combined
              : entry.total_points_event,
          );
          return row;
        },
      );

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
    // ----- HTML EXPORT -----
    let html = `<html><head><title>${leaderboardHeader}</title>
    <style>
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    </style>
    </head><body>`;

    html += `<h1>${leaderboardHeader}</h1>`;

    groupsToProcess.forEach((groupObj) => {
      html += `<h2>${groupObj.header}</h2>`;
      html += `<table><thead><tr>
      <th>Rank</th>
      <th>Name</th>
      <th>Country</th>
      <th>Sail Number</th>
      <th>Boat Type</th>`;

      const maxRaceCount = Math.max(
        ...groupObj.data.map((entry: { races: string | any[] }) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      for (let i = 0; i < maxRaceCount; i += 1) {
        html += `<th>Race ${i + 1}</th>`;
      }

      html += `<th>Total Points</th><th>Total Points Adjustet</th></tr></thead><tbody>`;

      groupObj.data.forEach(
        (
          entry: {
            name: any;
            surname: any;
            country: any;
            boat_number: any;
            boat_type: any;
            races: any[];
            total_points_combined: any;
            total_points_event: any;
            total_raw_points_combined: any;
            total_raw_points: any;
          },
          index: number,
        ) => {
          html += `<tr>
          <td>${index + 1}</td>
          <td>${entry.name} ${entry.surname}</td>
          <td>${entry.country}</td>
          <td>${entry.boat_number}</td>
          <td>${entry.boat_type}</td>`;

          for (let i = 0; i < maxRaceCount; i += 1) {
            html += `<td>${
              entry.races && entry.races[i] !== undefined ? entry.races[i] : ''
            }</td>`;
          }

          html += `<td>${
            finalSeriesStarted
              ? entry.total_raw_points_combined
              : entry.total_raw_points
          }</td>
          <td>${
            finalSeriesStarted
              ? entry.total_points_combined
              : entry.total_points_event
          }</td>
          </tr>`;
        },
      );

      html += `</tbody></table>`;
    });

    html += `</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, `${eventName}_${raceType}_race_${raceNumber}.html`);
  }
}
