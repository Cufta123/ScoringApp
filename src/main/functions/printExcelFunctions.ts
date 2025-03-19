/* eslint-disable camelcase */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF as JsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { findLatestHeatsBySuffix } from '../../main/functions/creatingNewHeatsUtls'; // adjust the import path as needed

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

export default async function handlePrintNewHeats(
  event: any,
  heats: string | any[],
) {
  console.log('Heats to print (before filtering):', heats);
  if (!Array.isArray(heats) || heats.length === 0) {
    alert('No heats available to print. Try to reload page with CTRL+R.');
    return;
  }

  // Retrieve event name from the event object
  const eventName = event.event_name;
  // Filter for only the latest heats
  const latestHeats = getLatestHeats(heats);
  console.log('Latest heats to print:', latestHeats);

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
          const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
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
        'Sail Number',
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
}

export async function exportToExcel(
  leaderboard: any[],
  finalSeriesStarted: boolean,
  sortedGroups: string[],
  groupedLeaderboard: { [x: string]: any[] },
  eventId: string, // new parameter to include event name in the file name
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leaderboard');
  const eventName = await window.electron.sqlite.eventDB.getEventName(eventId);
  const header = [
    'Rank',
    'Name',
    'Country',
    'Sail Number',
    'Boat Type',
    ...(leaderboard[0]?.races?.map(
      (_: any, index: number) => `Race ${index + 1}`,
    ) || []),
    'Total Points',
  ];
  worksheet.addRow(header);

  if (finalSeriesStarted) {
    sortedGroups.forEach((group) => {
      // Write a group header row
      worksheet.addRow([`${group} Group`]);
      groupedLeaderboard[group]?.forEach((entry, index) => {
        const row = [
          index + 1,
          `${entry.name} ${entry.surname}`,
          entry.country,
          entry.boat_number,
          entry.boat_type,
          ...entry.races,
          entry.total_points_final,
        ];
        worksheet.addRow(row);
      });
    });
  } else {
    leaderboard.forEach((entry, index) => {
      const row = [
        index + 1,
        `${entry.name} ${entry.surname}`,
        entry.country,
        entry.boat_number,
        entry.boat_type,
        ...entry.races,
        entry.total_points_event,
      ];
      worksheet.addRow(row);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Compute race number using the length of races from the first leaderboard entry
  const raceNumber =
    leaderboard.length > 0 && leaderboard[0].races
      ? leaderboard[0].races.length
      : 'unknown';

  saveAs(blob, `${eventName}_race_${raceNumber}.xlsx`);
}

export async function exportEventSailors(event: any, sailors: any[]) {
  console.log('Sailors to print (before filtering):', sailors);
  if (!Array.isArray(sailors) || sailors.length === 0) {
    alert('No sailors available to print.');
    return;
  }

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

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Event Sailors');

  // Define columns for Name, Surname, Country, Sail Number, Club.
  worksheet.columns = [
    { key: 'name', header: 'Name', width: 20 },
    { key: 'surname', header: 'Surname', width: 20 },
    { key: 'country', header: 'Country', width: 20 },
    { key: 'sail_number', header: 'Sail Number', width: 15 },
    { key: 'club', header: 'Club', width: 20 },
  ];

  sortedSailors.forEach((sailor) => {
    worksheet.addRow({
      name: sailor.name || 'N/A',
      surname: sailor.surname || 'N/A',
      country: sailor.country || sailor.boat_country || 'N/A',
      sail_number: sailor.sail_number || 'N/A',
      club: sailor.club || sailor.club_name || 'N/A',
    });
  });

  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `${event.event_name}_sailors.xlsx`);
  } catch (error) {
    console.error('Error exporting Excel file for event sailors:', error);
  }
}

export async function exportToPDF(
  leaderboard: any[],
  finalSeriesStarted: boolean,
  sortedGroups: string[],
  groupedLeaderboard: { [group: string]: any[] },
  eventId: string,
) {
  // Retrieve event name using your DB API
  const eventName = await window.electron.sqlite.eventDB.getEventName(eventId);
  const doc = new JsPDF();
  let startY = 20;

  // Header title for entire document
  doc.setFontSize(16);
  doc.text(
    `${finalSeriesStarted ? 'Final Leaderboard' : 'Leaderboard'}`,
    14,
    10,
  );

  if (finalSeriesStarted) {
    // For each group if finals have started
    sortedGroups.forEach((group) => {
      const groupEntries = groupedLeaderboard[group] || [];
      // Determine the maximum number of races within this group
      const maxRaceCount = Math.max(
        ...groupEntries.map((entry) =>
          entry.races && Array.isArray(entry.races) ? entry.races.length : 0,
        ),
        0,
      );

      // Build a dynamic header with each race per column
      const headerRow = [
        'Rank',
        'Name',
        'Country',
        'Sail Number',
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
        // Add each race as separate column; fill missing races with empty strings
        for (let i = 0; i < maxRaceCount; i += 1) {
          row.push(
            entry.races && entry.races[i] !== undefined
              ? entry.races[i].toString()
              : '',
          );
        }
        row.push(entry.total_points_final.toString());
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
  } else {
    // For non-final series, work with the full leaderboard
    const raceCount =
      leaderboard.length > 0 && leaderboard[0].races
        ? leaderboard[0].races.length
        : 0;
    const headerRow = [
      'Rank',
      'Name',
      'Country',
      'Sail Number',
      'Boat Type',
      ...Array.from({ length: raceCount }, (_, i) => `Race ${i + 1}`),
      'Total Points',
    ];

    const bodyData = leaderboard.map((entry, idx) => {
      const row = [];
      row.push((idx + 1).toString());
      row.push(`${entry.name} ${entry.surname}`);
      row.push(entry.country);
      row.push(entry.boat_number.toString());
      row.push(entry.boat_type);
      for (let i = 0; i < raceCount; i += 1) {
        row.push(
          entry.races && entry.races[i] !== undefined
            ? entry.races[i].toString()
            : '',
        );
      }
      row.push(entry.total_points_event.toString());
      return row;
    });

    autoTable(doc, {
      startY,
      head: [headerRow],
      body: bodyData,
      theme: 'grid',
    });
  }

  doc.save(
    `${eventName}_${finalSeriesStarted ? 'final' : 'race'}_leaderboard.pdf`,
  );
}
/**
 * Exports leaderboard data as an HTML view.
 */
export async function exportToHTML(
  leaderboard: any[],
  finalSeriesStarted: boolean,
  sortedGroups: string[],
  groupedLeaderboard: { [group: string]: any[] },
  eventId: string,
) {
  const eventName = await window.electron.sqlite.eventDB.getEventName(eventId);
  let html = `<html><head><title>${eventName} Leaderboard</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
  </head><body>`;

  html += `<h1>${finalSeriesStarted ? 'Final Leaderboard' : 'Leaderboard'}</h1>`;

  if (finalSeriesStarted) {
    sortedGroups.forEach((group) => {
      html += `<h2>${group} Group</h2>`;
      html += `<table><thead><tr>
      <th>Rank</th>
      <th>Name</th>
      <th>Country</th>
      <th>Sail Number</th>
      <th>Boat Type</th>
      <th>Races</th>
      <th>Total Points</th>
      </tr></thead><tbody>`;
      groupedLeaderboard[group]?.forEach((entry, index) => {
        html += `<tr>
        <td>${index + 1}</td>
        <td>${entry.name} ${entry.surname}</td>
        <td>${entry.country}</td>
        <td>${entry.boat_number}</td>
        <td>${entry.boat_type}</td>
        <td>${entry.races ? entry.races.join(', ') : ''}</td>
        <td>${entry.total_points_final}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    });
  } else {
    html += `<table><thead><tr>
      <th>Rank</th>
      <th>Name</th>
      <th>Country</th>
      <th>Sail Number</th>
      <th>Boat Type</th>
      <th>Races</th>
      <th>Total Points</th>
      </tr></thead><tbody>`;
    leaderboard.forEach((entry, index) => {
      html += `<tr>
      <td>${index + 1}</td>
      <td>${entry.name} ${entry.surname}</td>
      <td>${entry.country}</td>
      <td>${entry.boat_number}</td>
      <td>${entry.boat_type}</td>
      <td>${entry.races ? entry.races.join(', ') : ''}</td>
      <td>${entry.total_points_event}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  html += `</body></html>`;

  // Display in a new window
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  }
}
