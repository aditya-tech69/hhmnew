require('dotenv').config();
const { initializeDatabase } = require('./database');
const mongoose = require('mongoose');

async function forceSeed() {
  try {
    console.log("Seeding Database to Atlas...");
    await initializeDatabase(process.env.MONGODB_URI);
    console.log("Seed complete... waiting 2s to flush");
    await new Promise(resolve => setTimeout(resolve, 2000));
    await mongoose.disconnect();
    console.log("Success! You can now log in.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
forceSeed();
