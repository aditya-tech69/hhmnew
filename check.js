const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb+srv://adityacr21209_db_user:YuI4fbmjfEwePy4b@hhmweb.93qoofw.mongodb.net/?appName=hhmweb');
    const AdminUser = mongoose.connection.collection('adminusers');
    const users = await AdminUser.find({}).toArray();
    console.log('Admin Users in DB:', users);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
