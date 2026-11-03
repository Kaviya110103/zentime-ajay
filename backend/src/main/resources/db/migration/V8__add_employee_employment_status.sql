ALTER TABLE employee
    ADD COLUMN employment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

UPDATE employee
SET employment_status = 'ACTIVE'
WHERE employment_status IS NULL OR TRIM(employment_status) = '';
