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
  accessKey: process.env.MINIO_ROOT_USER || 'minioadmin',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'user-profiles';
const GEORASTER_BUCKET_NAME = process.env.MINIO_GEORASTER_BUCKET || 'layers';

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

const ensureGeorasterBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(GEORASTER_BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(GEORASTER_BUCKET_NAME, 'us-east-1');
      console.log(`Bucket ${GEORASTER_BUCKET_NAME} created.`);
      // Set bucket policy to public read (simplification for workshop)
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetBucketLocation', 's3:ListBucket', 's3:GetObject'],
            Resource: [`arn:aws:s3:::${GEORASTER_BUCKET_NAME}`, `arn:aws:s3:::${GEORASTER_BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(GEORASTER_BUCKET_NAME, JSON.stringify(policy));
      console.log(`Georaster Bucket policy set to public read.`);
    }
  } catch (err) {
    console.error('Error ensuring georaster bucket:', err);
  }
};

// Retry bucket creation
setTimeout(() => {
  ensureBucket();
  ensureGeorasterBucket();
}, 5000);

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

// Upload Georaster
app.post('/upload-raster', upload.single('file'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileName = `raster-${Date.now()}-${file.originalname}`;

  try {
    // 1. Upload to MinIO
    await minioClient.putObject(GEORASTER_BUCKET_NAME, fileName, file.buffer);

    // 2. Generate Proxy URL (NodeAPI serves the file)
    // Return relative path for Nginx to handle (/api/layer-file/...)
    // But since Nginx proxies /api/ -> /, we need to be careful.
    // If Nginx is: location /api/ { proxy_pass http://nodeapi:3000/; }
    // Then requesting /api/layer-file/foo hits nodeapi:3000/layer-file/foo
    // So we just need to return relative path from frontend perspective.
    const rasterUrl = `/api/layer-file/${fileName}`;

    // 3. Update Database
    await pool.query('INSERT INTO layer (name, path) VALUES ($1, $2)', [file.originalname, rasterUrl]);

    res.json({ success: true, url: rasterUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Proxy Layer File
app.get('/layer-file/:filename', async (req, res) => {
  const filename = req.params.filename;
  try {
    const dataStream = await minioClient.getObject(GEORASTER_BUCKET_NAME, filename);
    dataStream.pipe(res);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(404).send('File not found');
  }
});

// Get all layers
app.get('/layers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM layer');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch layers' });
  }
});

// Delete Layer
app.delete('/layers/:id', async (req, res) => {
  const layerId = req.params.id;

  try {
    // 1. Get layer info to find the file name
    const result = await pool.query('SELECT * FROM layer WHERE id = $1', [layerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Layer not found' });
    }

    const layer = result.rows[0];
    // layer.path is like "/api/layer-file/raster-1738123456-test.tif"
    // We need the filename "raster-1738123456-test.tif"
    const filename = layer.path.split('/').pop();

    // 2. Delete from MinIO
    if (filename) {
      try {
        await minioClient.removeObject(GEORASTER_BUCKET_NAME, filename);
      } catch (minioErr) {
        console.error('Error deleting from MinIO:', minioErr);
        // Continue to delete from DB even if MinIO deletion fails (orphaned file is better than broken UI)
      }
    }

    // 3. Delete from Database
    await pool.query('DELETE FROM layer WHERE id = $1', [layerId]);

    res.json({ success: true, message: 'Layer deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete layer' });
  }
});

app.get('/', (req, res) => {
  res.send('NodeAPI is running');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
