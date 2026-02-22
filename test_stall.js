require('dotenv').config();
const snowflake = require('snowflake-sdk');

const sql = `
  SELECT
    snapshot_at,
    CURRENT_TIMESTAMP() as curr,
    TIMESTAMPDIFF('minute', snapshot_at, CURRENT_TIMESTAMP()) as diff_minutes
  FROM patient_snapshots
  WHERE patient_id = ?
  ORDER BY snapshot_at DESC
  LIMIT 1
`;

const config = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
};

const conn = snowflake.createConnection(config);
conn.connect((err, conn) => {
  if (err) {
    console.error("Connection error:", err);
    process.exit(1);
  }
  conn.execute({
    sqlText: sql,
    binds: ["f9ed4a8e-44f9-4392-bf35-9857b65937c5"],
    complete: (err, stmt, rows) => {
      if (err) {
        console.error("SQL Error", err.message);
      } else {
        console.log("Raw Row:", rows[0]);
      }
      process.exit(0);
    }
  });
});
