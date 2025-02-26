import { promises as fs } from 'fs';

export default async function extractSailorsFromCSV(filePath: string) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    console.log('Extracted CSV data:', data);
    return data;
  } catch (error) {
    console.error('Error reading CSV file:', error);
    throw error;
  }
}
