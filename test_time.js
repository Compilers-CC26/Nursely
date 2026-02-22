require('dotenv').config();
const snowflake = require('snowflake-sdk');

const sql = `SELECT CURRENT_TIMESTAMP() AS db_time;`
const config = {
  account: process.env.SNOWFLAKE_ACCOUNT, username: process.env.SNOWFLAKE_USER, password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE, database: process.env.SNOWFLAKE_DATABASE, schema: process.env.SNOWFLAKE_SCHEMA
};
const conn = snowflake.createConnection(config);
conn.connect((err, conn) => {
  conn.execute({
    sqlText: sql,
    complete: (err, stmt, rows) => {
      console.log("DB Time (CURRENT_TIMESTAMP):", rows[0].DB_TIME);
      console.log("Node Time (Date.now):", new Date(Date.now()).toISOString());
      
      const pSql = `SELECT SNAPSHOT_AT FROM PATIENT_SNAPSHOTS ORDER BY SNAPSHOT_AT DESC LIMIT 1;`;
      conn.execute({
          sqlText: pSql,
          complete: (e, s, r) => {
              if(r.length > 0) {
                 console.log("Latest snapshot_at:", r[0].SNAPSHOT_AT);
                 console.log("Parsed Date:", new Date(r[0].SNAPSHOT_AT).toISOString());
                 console.log("Diff min:", (Date.now() - new Date(r[0].SNAPSHOT_AT).getTime()) / 60000);
              }
              process.exit(0);
          }
      });
    }
  });
});
