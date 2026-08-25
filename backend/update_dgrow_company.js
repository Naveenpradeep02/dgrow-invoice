require('dotenv').config();
const db = require('./src/config/database');

async function updateCompanySettings() {
  try {
    await db.initDatabase();
    await db.query(
      `UPDATE company_settings SET
         company_name = ?,
         website = ?,
         email = ?,
         phone = ?,
         address = ?,
         city = ?,
         state = ?,
         pincode = ?
       WHERE id = 1`,
      [
        'D-GROW MARKETING AGENCY',
        'https://dgrowmarketing.com/',
        'dgrowmarkting@gmail.com',
        '+91 9600401582 | +91 7373509585',
        'SF No: 14/3, Plot No. 141, Radha Ave Main Rd, Ganga Nagar, Valasaravakkam',
        'Chennai',
        'Tamil Nadu',
        '600087'
      ]
    );

    const rows = await db.query('SELECT company_name, phone, email, website, address, city, pincode FROM company_settings WHERE id = 1');
    console.log('Updated Company Settings:', rows[0]);
  } catch (err) {
    console.error('Error updating company settings:', err);
  } finally {
    process.exit(0);
  }
}

updateCompanySettings();
