require('dotenv').config();
const snowflake = require('snowflake-sdk');

const sql = `
SELECT
      p.patient_id, p.name, p.age, p.sex, p.room, p.mrn, p.diagnosis, p.summary, p.risk_score,
      v.vitals_obj AS vitals,
      l.labs_arr AS labs,
      m.meds_arr AS meds,
      a.allergies_arr AS allergies,
      n.notes_arr AS notes
    FROM patients p
    LEFT JOIN (
      SELECT patient_id,
        OBJECT_CONSTRUCT(
          'hr', hr, 'bpSys', bp_sys, 'bpDia', bp_dia, 'rr', rr, 'temp', temp, 'spo2', spo2, 'timestamp', effective_dt
        ) AS vitals_obj
      FROM vitals
      QUALIFY ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY effective_dt DESC NULLS LAST) = 1
    ) v ON v.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(OBJECT_CONSTRUCT(
        'name', lab_name, 'value', value, 'unit', unit, 'flag', flag
      )) AS labs_arr
      FROM (
        SELECT patient_id, lab_name, value, unit, flag, effective_dt
        FROM lab_results
        QUALIFY ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY effective_dt DESC) <= 5
      )
      GROUP BY patient_id
    ) l ON l.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(medication) AS meds_arr
      FROM medications
      GROUP BY patient_id
    ) m ON m.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(allergen) AS allergies_arr
      FROM allergies
      GROUP BY patient_id
    ) a ON a.patient_id = p.patient_id
    LEFT JOIN (
      SELECT patient_id, ARRAY_AGG(note_text) AS notes_arr
      FROM nursing_notes
      GROUP BY patient_id
    ) n ON n.patient_id = p.patient_id
    ORDER BY p.risk_score DESC NULLS LAST
    LIMIT 1;
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
    complete: (err, stmt, rows) => {
      console.log("Keys:", Object.keys(rows[0]));
      console.log("Values:");
      console.dir(rows[0], {depth: null});
      process.exit(0);
    }
  });
});
