const mysql = require("mysql2/promise");
require("dotenv").config();

async function cleanupIndexes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "passpot",
  });

  console.log("Connected to database. Fetching indexes on Users table...");

  const [indexes] = await connection.execute(`SHOW INDEX FROM Users`);

  // Group by Key_name
  const indexNames = [...new Set(indexes.map((i) => i.Key_name))];
  console.log(`Found ${indexNames.length} indexes on Users table.`);

  // Keep only essential indexes (PRIMARY and a few unique constraints)
  const essentialIndexes = ["PRIMARY", "email", "userCode"];

  for (const indexName of indexNames) {
    if (!essentialIndexes.includes(indexName)) {
      try {
        console.log(`Dropping index: ${indexName}`);
        await connection.execute(
          `ALTER TABLE Users DROP INDEX \`${indexName}\``,
        );
      } catch (err) {
        console.log(`  Could not drop ${indexName}: ${err.message}`);
      }
    }
  }

  const [remainingIndexes] = await connection.execute(`SHOW INDEX FROM Users`);
  const remainingNames = [...new Set(remainingIndexes.map((i) => i.Key_name))];
  console.log(
    `\nCleanup complete. Remaining indexes: ${remainingNames.length}`,
  );
  console.log(remainingNames);

  await connection.end();
}

cleanupIndexes().catch(console.error);
