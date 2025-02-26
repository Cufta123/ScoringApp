/* eslint-disable camelcase */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
    alert('No heats available to print.');
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
    'Boat Number',
    'Boat Type',
    ...(leaderboard[0]?.races?.map((_, index: number) => `Race ${index + 1}`) ||
      []),
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
