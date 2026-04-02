require('dotenv').config();
const { AdminUser } = require('./database');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function doIt() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
     const passwordHash = bcrypt.hashSync('samsung1', 10);
     const res = await AdminUser.create({ username: 'adityasir', password_hash: passwordHash, display_name: 'Aditya Sir', role: 'Principal Curator' });
     console.log('Created!', res);
  } catch(e) {
     console.error("ERROR DURING CREATION:", e);
  }
  process.exit();
}
doIt();
