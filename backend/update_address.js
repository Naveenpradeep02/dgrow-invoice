const { initDatabase, query } = require('./src/config/database');

async function updateCompanyAddress() {
  try {
    await initDatabase();
    const address = 'SF No: 14/3, Plot No. 141, Radha Ave Main Rd, Ganga Nagar, Valasaravakkam';
    const city = 'Chennai';
    const state = 'Tamil Nadu';
    const pincode = '600087';

    await query(
      `UPDATE company_settings SET address = ?, city = ?, state = ?, pincode = ? WHERE id = 1`,
      [address, city, state, pincode]
    );
    console.log('Successfully updated company_settings table with new address and pincode!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to update company_settings:', err);
    process.exit(1);
  }
}

updateCompanyAddress();
