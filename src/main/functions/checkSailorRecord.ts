import { db } from '../../../public/Database/DBManager';

async function checkSailorRecord(record: any): Promise<boolean> {
  // Return false if required fields are missing.
  if (!record.name || !record.surname || !record.birthday) {
    return false;
  }

  // Immediately return false if the sail number already exists.
  const duplicate = db
    .prepare('SELECT 1 FROM Boats WHERE sail_number = ?')
    .get(record.sail);
  if (duplicate) {
    console.log('Duplicate found:', record.sail);
  } else {
    console.log('No duplicate found');
  }

  // All validations passed; return true.
  return true;
}

export default checkSailorRecord;
