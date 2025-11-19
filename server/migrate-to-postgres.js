const fs = require('fs').promises;
const path = require('path');
const dbPostgres = require('./database-postgres');
const dbJson = require('./database');

const BACKUP_FILE = path.join(__dirname, 'data.json');

async function migrateToPostgres() {
  console.log('🚀 Starting migration from JSON to PostgreSQL...');
  
  try {
    // Initialize PostgreSQL database
    console.log('📊 Initializing PostgreSQL database...');
    await dbPostgres.init();
    
    // Check if JSON file exists
    try {
      await fs.access(BACKUP_FILE);
    } catch (error) {
      console.log('❌ No data.json file found. Nothing to migrate.');
      return;
    }
    
    // Read existing JSON data
    console.log('📖 Reading existing JSON data...');
    const jsonData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    
    if (!jsonData.sheets || jsonData.sheets.length === 0) {
      console.log('✅ No sheets found in JSON file. Migration complete.');
      return;
    }
    
    console.log(`📋 Found ${jsonData.sheets.length} sheets to migrate`);
    
    // Migrate sheets
    console.log('📄 Migrating sheets...');
    for (const sheet of jsonData.sheets) {
      try {
        await dbPostgres.addSheet(sheet);
        console.log(`  ✅ Migrated sheet: ${sheet.sheetTitle}`);
      } catch (error) {
        if (error.code === '23505') { // Duplicate key error
          console.log(`  ⚠️  Sheet already exists: ${sheet.sheetTitle}`);
        } else {
          console.error(`  ❌ Error migrating sheet ${sheet.sheetTitle}:`, error.message);
        }
      }
    }
    
    // Migrate votes
    if (jsonData.votes && Object.keys(jsonData.votes).length > 0) {
      console.log('🗳️  Migrating votes...');
      let voteCount = 0;
      
      for (const [key, voters] of Object.entries(jsonData.votes)) {
        const [sheetId, applicantRow] = key.split('-');
        
        for (const voterName of voters) {
          try {
            await dbPostgres.addVote(sheetId, parseInt(applicantRow), voterName);
            voteCount++;
          } catch (error) {
            if (error.message.includes('already voted')) {
              console.log(`  ⚠️  Vote already exists: ${voterName} for ${key}`);
            } else {
              console.error(`  ❌ Error migrating vote ${key} - ${voterName}:`, error.message);
            }
          }
        }
      }
      
      console.log(`  ✅ Migrated ${voteCount} votes`);
    }
    
    // Migrate selections
    if (jsonData.selections && Object.keys(jsonData.selections).length > 0) {
      console.log('📝 Migrating selections...');
      let selectionCount = 0;
      
      for (const [key, selection] of Object.entries(jsonData.selections)) {
        const [sheetId, applicantRow] = key.split('-');
        
        try {
          await dbPostgres.updateSelections(sheetId, parseInt(applicantRow), {
            selectedForInterview: selection.selectedForInterview,
            selectedForHiring: selection.selectedForHiring
          });
          selectionCount++;
        } catch (error) {
          console.error(`  ❌ Error migrating selection ${key}:`, error.message);
        }
      }
      
      console.log(`  ✅ Migrated ${selectionCount} selections`);
    }
    
    // Create backup of original JSON file
    const backupFileName = `data-backup-${Date.now()}.json`;
    const backupPath = path.join(__dirname, backupFileName);
    await fs.copyFile(BACKUP_FILE, backupPath);
    console.log(`💾 Created backup of original data: ${backupFileName}`);
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update your server/index.js to use database-postgres.js instead of database.js');
    console.log('2. Add DATABASE_URL environment variable to your OnRender service');
    console.log('3. Install pg dependency: npm install pg');
    console.log('4. Test your application');
    console.log('5. Once confirmed working, you can remove the old data.json file');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close database connections
    await dbPostgres.close();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateToPostgres()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToPostgres };
