import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import NotoSansBlack from '../../renderer/constants/NotoSansBlack.json';
import iocToFlagCodeMap from '../../renderer/constants/iocToFlagCodeMap';
import iocCountries from '../../renderer/constants/iocCountries.json';

function countryCodeToEmoji(code: string): string {
  const codePoints = Array.from(code.toUpperCase()).map(
    (char) => 127397 + char.charCodeAt(0),
  );
  return String.fromCodePoint(...codePoints);
}

function getFlag(country: string): string {
  const iocCode = iocToFlagCodeMap[country];
  if (iocCode) return countryCodeToEmoji(iocCode);
  const key = Object.keys(iocCountries).find(
    (k) => iocCountries[k].toLowerCase() === country.toLowerCase(),
  );
  return key ? countryCodeToEmoji(iocToFlagCodeMap[key] || country) : country;
}

export default async function printLeaderboard(
  leaderboard: string | any[],
  finalSeriesStarted: boolean,
  sortedGroups: any[],
  groupedLeaderboard: { [x: string]: any },
  eventId: string,
  format: string,
) {
  const eventName = await window.electron.sqlite.eventDB.getEventName(eventId);

  // Leaderboard header title.
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
  const groupsToProcess = [];
  if (groupedLeaderboard.OverallScores) {
    groupsToProcess.push({
      header: leaderboardHeader,
      key: 'OverallScores',
      data: groupedLeaderboard.OverallScores,
    });
  }
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

    // Postavite A4 format (u ExcelJS, paperSize 9 označava A4)
    worksheet.pageSetup = { paperSize: 9 };

    groupsToProcess.forEach((groupObj) => {
      // Add a row with the group header.
      worksheet.addRow([groupObj.header]);

      // Determine maximum counts for qualifying points and races.
      const maxQualifyingCount = Math.max(
        ...groupObj.data.map((entry: any) =>
          entry.qualifyingPoints && Array.isArray(entry.qualifyingPoints)
            ? entry.qualifyingPoints.length
            : 0,
        ),
        0,
      );
      const maxRaceCount = Math.max(
        ...groupObj.data.map((entry: any) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      // Updated header row order: Rank, Name, Flag, Category, Sail Number, Country, Boat Type, Total Points, Total Points Adjusted, ...
      const headerRow = [
        'Rank',
        'Name',
        'Flag',
        'Category',
        'Sail Number',
        'Country',
        'Boat Type',
        'Total',
        'Nett',
        ...Array.from({ length: maxQualifyingCount }, (_, i) => `Q${i + 1}`),
        ...Array.from({ length: maxRaceCount }, (_, i) =>
          finalSeriesStarted ? `F ${i + 1}` : `Q ${i + 1}`,
        ),
      ];
      worksheet.addRow(headerRow);

      // Add each competitor row.
      groupObj.data.forEach(
        (
          entry: {
            name: any;
            surname: any;
            country: any;
            boat_number: any;
            boat_type: any;
            category?: any;
            races: any;
            qualifyingPoints?: any[];
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
            getFlag(entry.country),
            entry.category || 'N/A',
            entry.boat_number,
            entry.country,
            entry.boat_type,
            finalSeriesStarted
              ? entry.total_raw_points_combined
              : entry.total_raw_points,
            finalSeriesStarted
              ? entry.total_points_combined
              : entry.total_points_event,
          ];

          // Process qualifying points.
          const qualifyingPoints =
            entry.qualifyingPoints && Array.isArray(entry.qualifyingPoints)
              ? entry.qualifyingPoints.map((q) => q.formatted)
              : [];
          while (qualifyingPoints.length < maxQualifyingCount) {
            qualifyingPoints.push('');
          }

          // Process race values.
          const races =
            entry.races && Array.isArray(entry.races) ? [...entry.races] : [];
          while (races.length < maxRaceCount) {
            races.push('');
          }

          row.push(...qualifyingPoints, ...races);
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
    const doc = new JsPDF({ orientation: 'landscape' });

    // Embed custom Notosans-Black font from JSON.
    const notosansBlackBase64 = NotoSansBlack.fontBase64;
    doc.addFileToVFS('NotosansBlack.ttf', notosansBlackBase64);
    doc.addFont('NotosansBlack.ttf', 'NotosansBlack', 'normal');
    doc.setFont('NotosansBlack', 'normal');

    let startY = 20;
    doc.setFontSize(16);
    doc.text(leaderboardHeader, 14, 10);
    startY = 16;

    groupsToProcess.forEach((groupObj) => {
      doc.setFontSize(14);
      doc.text(groupObj.header, 14, startY);
      startY += 6;

      const maxQualifyingCount = Math.max(
        ...groupObj.data.map((entry: any) =>
          entry.qualifyingPoints && Array.isArray(entry.qualifyingPoints)
            ? entry.qualifyingPoints.length
            : 0,
        ),
        0,
      );
      const maxRaceCount = Math.max(
        ...groupObj.data.map((entry: any) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      // Updated header row order for PDF export.
      const headerRow = [
        'Rank',
        'Name',
        'Category',
        'Sail Number',
        'Country',
        'Boat Type',
        'Total',
        'Nett',
        ...Array.from({ length: maxQualifyingCount }, (_, i) => `Q${i + 1}`),
        ...Array.from({ length: maxRaceCount }, (_, i) =>
          finalSeriesStarted ? `F ${i + 1}` : `Q ${i + 1}`,
        ),
      ];

      const bodyData = groupObj.data.map(
        (
          entry: {
            name: any;
            surname: any;
            country: any;
            boat_number: { toString: () => any };
            boat_type: any;
            category?: any;
            races: any[];
            qualifyingPoints?: any[];
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
          row.push(entry.category || 'N/A');
          row.push(entry.boat_number.toString());
          row.push(entry.country);
          row.push(entry.boat_type);
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

          const qualifyingPoints =
            entry.qualifyingPoints && Array.isArray(entry.qualifyingPoints)
              ? entry.qualifyingPoints.map((q) => q.formatted)
              : [];
          while (qualifyingPoints.length < maxQualifyingCount) {
            qualifyingPoints.push('');
          }

          const races =
            entry.races && Array.isArray(entry.races) ? [...entry.races] : [];
          while (races.length < maxRaceCount) {
            races.push('');
          }
          row.push(...qualifyingPoints, ...races);
          return row;
        },
      );

      autoTable(doc, {
        startY,
        head: [headerRow],
        body: bodyData,
        theme: 'grid',
        styles: {
          cellWidth: 'wrap',
          font: 'NotosansBlack',
          fontStyle: 'normal',
        },
        headStyles: { font: 'NotosansBlack', fontStyle: 'normal' },
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
      const maxQualifyingCount = Math.max(
        ...groupObj.data.map((entry: any) =>
          entry.qualifyingPoints && Array.isArray(entry.qualifyingPoints)
            ? entry.qualifyingPoints.length
            : 0,
        ),
        0,
      );
      const maxRaceCount = Math.max(
        ...groupObj.data.map((entry: any) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      // Updated header row for HTML export.
      html += `<table><thead><tr>
        <th>Rank</th>
        <th>Name</th>
        <th>Flag</th>
        <th>Category</th>
        <th>Sail Number</th>
        <th>Country</th>
        <th>Boat Type</th>
        <th>Total </th>
        <th>Nett</th>`;
      for (let i = 0; i < maxQualifyingCount; i += 1) {
        html += `<th>Q${i + 1}</th>`;
      }
      for (let i = 0; i < maxRaceCount; i += 1) {
        html += `<th>${finalSeriesStarted ? `F ${i + 1}` : `Q ${i + 1}`}</th>`;
      }
      html += `</tr></thead><tbody>`;

      groupObj.data.forEach(
        (
          entry: {
            name: any;
            surname: any;
            country: any;
            boat_number: any;
            boat_type: any;
            category?: any;
            races: any[];
            qualifyingPoints?: any[];
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
            <td>${getFlag(entry.country)}</td>
            <td>${entry.category || 'N/A'}</td>
            <td>${entry.boat_number}</td>
            <td>${entry.country}</td>
            <td>${entry.boat_type}</td>
            <td>${
              finalSeriesStarted
                ? entry.total_raw_points_combined
                : entry.total_raw_points
            }</td>
            <td>${
              finalSeriesStarted
                ? entry.total_points_combined
                : entry.total_points_event
            }</td>`;
          const qualifyingPoints =
            entry.qualifyingPoints && Array.isArray(entry.qualifyingPoints)
              ? entry.qualifyingPoints.map((q) => q.formatted)
              : [];
          while (qualifyingPoints.length < maxQualifyingCount) {
            qualifyingPoints.push('');
          }
          qualifyingPoints.forEach((qp: string) => {
            html += `<td>${qp}</td>`;
          });
          const races =
            entry.races && Array.isArray(entry.races) ? [...entry.races] : [];
          while (races.length < maxRaceCount) {
            races.push('');
          }
          races.forEach((race: any) => {
            html += `<td>${race}</td>`;
          });
          html += `</tr>`;
        },
      );
      html += `</tbody></table>`;
    });

    html += `</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    saveAs(blob, `${eventName}_${raceType}_race_${raceNumber}.html`);
  }
}
