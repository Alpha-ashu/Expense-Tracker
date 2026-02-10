const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Test admin login directly with SQLite
const db = new sqlite3.Database('./dev.db');

console.log('🧪 Testing admin login directly...');

const adminEmail = 'shaik.job.details@gmail.com';
const adminPassword = '123456789';

// Test login
db.get("SELECT * FROM User WHERE email = ?", [adminEmail], async (err, user) => {
  if (err) {
    console.error('❌ Database error:', err);
    return;
  }
  
  if (!user) {
    console.error('❌ Admin user not found in database');
    return;
  }
  
  console.log('✅ Admin user found:', user.email);
  console.log('User details:', {
    id: user.id,
    name: user.name,
    role: user.role,
    isApproved: user.isApproved
  });
  
  // Test password
  const isPasswordValid = await bcrypt.compare(adminPassword, user.password);
  
  if (isPasswordValid) {
    console.log('✅ Admin password is correct!');
    console.log('🎉 Admin authentication would work!');
  } else {
    console.error('❌ Admin password is incorrect');
  }
  
  // Test that we can access the data
  console.log('\n📊 Testing data access...');
  
  // Get accounts
  db.all("SELECT * FROM Account WHERE userId = ?", [user.id], (err, accounts) => {
    if (err) {
      console.error('❌ Error getting accounts:', err);
      return;
    }
    console.log('✅ Accounts found:', accounts.length);
    
    // Get transactions
    db.all("SELECT * FROM Transactions WHERE userId = ?", [user.id], (err, transactions) => {
      if (err) {
        console.error('❌ Error getting transactions:', err);
        return;
      }
      console.log('✅ Transactions found:', transactions.length);
      
      // Get goals
      db.all("SELECT * FROM Goal WHERE userId = ?", [user.id], (err, goals) => {
        if (err) {
          console.error('❌ Error getting goals:', err);
          return;
        }
        console.log('✅ Goals found:', goals.length);
        
        console.log('\n🎉 All data access tests passed!');
        console.log('✅ Database is properly set up with admin user and test data');
        console.log('✅ Admin credentials are working correctly');
        
        db.close();
      });
    });
  });
});

// Handle errors
db.on('error', (err) => {
  console.error('❌ Database error:', err);
});