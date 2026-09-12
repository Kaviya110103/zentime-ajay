SET @add_expected_shift_start = (
    SELECT IF(
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'attendance_record'
              AND column_name = 'expected_shift_start'
        ),
        'ALTER TABLE attendance_record ADD COLUMN expected_shift_start VARCHAR(16) NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @add_expected_shift_start;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_expected_shift_end = (
    SELECT IF(
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'attendance_record'
              AND column_name = 'expected_shift_end'
        ),
        'ALTER TABLE attendance_record ADD COLUMN expected_shift_end VARCHAR(16) NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @add_expected_shift_end;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_expected_minutes = (
    SELECT IF(
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'attendance_record'
              AND column_name = 'expected_minutes'
        ),
        'ALTER TABLE attendance_record ADD COLUMN expected_minutes INT NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @add_expected_minutes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_shift_source = (
    SELECT IF(
        NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'attendance_record'
              AND column_name = 'shift_source'
        ),
        'ALTER TABLE attendance_record ADD COLUMN shift_source VARCHAR(64) NULL',
        'SELECT 1'
    )
);
PREPARE stmt FROM @add_shift_source;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
