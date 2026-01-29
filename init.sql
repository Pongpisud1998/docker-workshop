CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    image VARCHAR(255)
);

-- Optional: Seed a default user for testing
INSERT INTO users (username, password, image) VALUES ('admin', 'admin123', NULL) ON CONFLICT (username) DO NOTHING;
