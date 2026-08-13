DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'todo') THEN
    CREATE ROLE todo LOGIN PASSWORD 'todo';
  END IF;
END
$$;

SELECT 'CREATE DATABASE todo OWNER todo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'todo')
\gexec
