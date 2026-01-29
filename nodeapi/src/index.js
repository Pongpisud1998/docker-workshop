const express = require('express');
const { Pool } = require('pg');
const Minio = require('minio');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. Database Connection (PostgreSQL)
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'myuser',
  password: process.env.DB_PASS || 'mypassword',
  database: process.env.DB_NAME || 'mydatabase',
  port: 5432,
});

// 2. MinIO Connection
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'user-profiles';

// Ensure bucket exists
const ensureBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`Bucket ${BUCKET_NAME} created.`);
      // Set bucket policy to public read (simplification for workshop)
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetBucketLocation', 's3:ListBucket', 's3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}`, `arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`Bucket policy set to public read.`);
    }
  } catch (err) {
    console.error('Error ensuring bucket:', err);
  }
};

// Retry bucket creation
setTimeout(ensureBucket, 5000);

// Multer setup for file uploads (in-memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// API Endpoints

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      if (user.password === password) { // Plaintext for workshop simplicity
        res.json({ success: true, user: { id: user.id, username: user.username, image: user.image } });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Upload User Profile Image
app.post('/upload/:userId', upload.single('file'), async (req, res) => {
  const userId = req.params.userId;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileName = `${userId}-${Date.now()}-${file.originalname}`;

  try {
    // 1. Upload to MinIO
    await minioClient.putObject(BUCKET_NAME, fileName, file.buffer);

    // 2. Generate Public URL (assuming MinIO is accessible publicly or via proxy)
    // In this docker-compose setup, browser accesses MinIO via localhost:9000
    // But inside the container, we talk to 'minio'.
    // We return a relative path or full URL. Let's return the full URL assuming client is identifying minio as localhost:9000
    const imageUrl = `http://localhost:9000/${BUCKET_NAME}/${fileName}`;

    // 3. Update Database
    await pool.query('UPDATE users SET image = $1 WHERE id = $2', [imageUrl, userId]);

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/', (req, res) => {
    res.send('NodeAPI is running');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
