SET @employment_status_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'employee'
      AND column_name = 'employment_status'
);

SET @employment_status_sql := IF(
    @employment_status_column_exists = 0,
    'ALTER TABLE employee ADD COLUMN employment_status VARCHAR(20) NOT NULL DEFAULT ''ACTIVE''',
    'SELECT 1'
);

PREPARE employment_status_statement FROM @employment_status_sql;
EXECUTE employment_status_statement;
DEALLOCATE PREPARE employment_status_statement;

UPDATE employee
SET employment_status = 'ACTIVE'
WHERE employment_status IS NULL OR TRIM(employment_status) = '';
