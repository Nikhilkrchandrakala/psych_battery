require('dotenv').config();
const mongoose = require('mongoose');

async function list() {
  await mongoose.connect(process.env.MONGODB_URI);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('--- COLLECTIONS ---');
  collections.forEach(c => console.log(c.name));
  process.exit(0);
}
list();
