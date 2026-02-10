const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.db');

db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, rows) => {
  if (err) {
    console.error('Error checking tables:', err);
    return;
  }
  console.log('Tables in database:', rows);
  
  // Check if User table has data
  db.all('SELECT * FROM User', (err, users) => {
    if (err) {
      console.error('Error checking users:', err);
      return;
    }
    console.log('Users in database:', users);
    db.close();
  });
});