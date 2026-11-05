const { db, initializeDB, all, exec, run } = require('../config/db');

const updateSettingsA4 = async () => {
  try {
    await initializeDB();
    const cols = (await all(`PRAGMA table_info(settings)`)).map(c => c.name);

    if (!cols.includes('fssai')) {
      await exec(`ALTER TABLE settings ADD COLUMN fssai TEXT DEFAULT '12415022000193'`);
      console.log('Added fssai column');
    }
    if (!cols.includes('msme')) {
      await exec(`ALTER TABLE settings ADD COLUMN msme TEXT DEFAULT 'TN-23-0015818'`);
      console.log('Added msme column');
    }
    if (!cols.includes('salesEmail')) {
      await exec(`ALTER TABLE settings ADD COLUMN salesEmail TEXT DEFAULT 'sales@viswafoods.in'`);
      console.log('Added salesEmail column');
    }
    if (!cols.includes('terms')) {
      await exec(`ALTER TABLE settings ADD COLUMN terms TEXT DEFAULT 'Immediate Payment. Goods once sold cannot be returned.'`);
      console.log('Added terms column');
    }

    await run(`
      UPDATE settings SET
        storeName = 'VISWA FOODS',
        storeAddress = 'W1/289/129, NGO Colony, Annanji, Vadavceranaickenpatty, Theni, Tamil Nadu 625531',
        storePhone = '+91 9360192031',
        storeGstin = '33AAMFV0886H1ZU',
        fssai = '12415022000193',
        msme = 'TN-23-0015818',
        salesEmail = 'sales@viswafoods.in',
        paperSize = 'A4'
      WHERE id = 1
    `);

    const updated = await all(`SELECT * FROM settings WHERE id = 1`);
    console.log('Updated Settings Row:', updated[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error updating settings:', err);
    process.exit(1);
  }
};

updateSettingsA4();
