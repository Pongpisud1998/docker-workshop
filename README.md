นี่คือโครงร่างและเนื้อหาของ `README.md` สำหรับ Workshop ที่คุณสามารถนำไปใช้ได้เลยครับ ผมออกแบบมาให้เป็น Step-by-step ที่เน้นความเข้าใจเรื่อง Docker Structure, `.dockerignore` และ Multi-stage Build ตามที่คุณต้องการ โดยจำลอง Stack เป็น: **PostgreSQL + Node.js (API) + React (Vite) + MinIO** ครับ

---

# 🐳 Workshop: Docker Compose for Full Stack App (Multi-stage Build)

ยินดีต้อนรับสู่ Workshop การสร้าง Environment สำหรับพัฒนา Web Application ครบวงจรด้วย Docker Compose โดยในโปรเจกต์นี้เราจะจำลองระบบที่มี:

1. **WebApp**: หน้าบ้าน (Frontend) มีระบบ Login และ Upload รูป
2. **NodeAPI**: หลังบ้าน (Backend) เชื่อมต่อ Database และ Object Storage
3. **DB**: ฐานข้อมูล PostgreSQL
4. **MinIO**: ระบบเก็บไฟล์ (S3 Compatible)

## 📋 Pre-requisites

* Docker & Docker Compose ติดตั้งในเครื่องเรียบร้อย
* พื้นฐาน Node.js เล็กน้อย

---

## 📂 1. Project Structure

เริ่มจากสร้าง Folder โครงสร้างโปรเจกต์ดังนี้:

```text
my-docker-workshop/
├── nodeapi/                # Backend Service
│   ├── src/
│   │   └── index.js
│   ├── .dockerignore       # <-- สำคัญ
│   ├── Dockerfile          # <-- Multi-stage
│   └── package.json
├── webapp/                 # Frontend Service
│   ├── src/
│   ├── .dockerignore       # <-- สำคัญ
│   └── Dockerfile          # <-- Multi-stage
└── docker-compose.yml      # พระเอกของเรา

```

---

## 🛠️ 2. Setup "NodeAPI" (Backend)

เราจะสร้าง API ง่ายๆ ที่มี Endpoint สำหรับ Login และ Upload โดยใช้ Multi-stage Build เพื่อลดขนาด Image

### 2.1 สร้างไฟล์ `nodeapi/Dockerfile`

เราแบ่งเป็น 2 stages: `builder` (สำหรับลง module) และ `production` (สำหรับรันจริง)

```dockerfile
# --- Stage 1: Builder ---
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./

# ติดตั้ง dependencies ทั้งหมด (รวม devDependencies ถ้ามี)
RUN npm ci 

# --- Stage 2: Production ---
FROM node:18-alpine

WORKDIR /app

# Copy node_modules จาก stage แรกมา (ลดเวลา install ใหม่)
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# กำหนด User เป็น node (Non-root) เพื่อความปลอดภัย
USER node

EXPOSE 3000
CMD ["node", "src/index.js"]

```

### 2.2 สร้างไฟล์ `nodeapi/.dockerignore`

ป้องกันไฟล์ขยะหลุดเข้าไปใน Image

```text
node_modules
npm-debug.log
.git
.env

```

---

## 🎨 3. Setup "WebApp" (Frontend)

สมมติว่าเราใช้ React หรือ Framework ที่ต้องมีการ Build (เช่น Vite) เราจะใช้ Nginx ในการ Serve ไฟล์ Static

### 3.1 สร้างไฟล์ `webapp/Dockerfile`

เราแบ่งเป็น: `build-stage` (Build code) และ `production-stage` (Nginx)

```dockerfile
# --- Stage 1: Build Stage ---
FROM node:18-alpine as build-stage

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
# คำสั่ง Build (จะได้ folder 'dist' หรือ 'build')
RUN npm run build

# --- Stage 2: Production Stage ---
FROM nginx:stable-alpine as production-stage

# Copy ไฟล์ที่ Build เสร็จแล้ว ไปวางใน folder ของ Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

```

### 3.2 สร้างไฟล์ `webapp/.dockerignore`

```text
node_modules
dist
.git
.env

```

---

## 🚀 4. Compose Everything (The Heart)

สร้างไฟล์ `docker-compose.yml` ที่ root folder เพื่อเชื่อมทุกอย่างเข้าด้วยกัน

```yaml
version: '3.8'

services:
  # -----------------------------
  # 1. Database (PostgreSQL)
  # -----------------------------
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydatabase
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - app-network

  # -----------------------------
  # 2. Object Storage (MinIO)
  # -----------------------------
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000" # API Port
      - "9001:9001" # Console UI Port
    volumes:
      - minio_data:/data
    networks:
      - app-network

  # -----------------------------
  # 3. Backend (NodeAPI)
  # -----------------------------
  nodeapi:
    build: ./nodeapi
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
      - DB_USER=myuser
      - DB_PASS=mypassword
      - DB_NAME=mydatabase
      - MINIO_ENDPOINT=minio
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
    depends_on:
      - db
      - minio
    networks:
      - app-network

  # -----------------------------
  # 4. Frontend (WebApp)
  # -----------------------------
  webapp:
    build: ./webapp
    restart: unless-stopped
    ports:
      - "8080:80" # เข้าเว็บผ่าน localhost:8080
    depends_on:
      - nodeapi
    networks:
      - app-network

# กำหนด Network ให้มองเห็นกันได้
networks:
  app-network:
    driver: bridge

# กำหนด Volume ถาวร
volumes:
  pgdata:
  minio_data:

```

---

## 🎮 5. How to Run & Test (Step-by-Step)

### Step 1: Start Container

รันคำสั่งนี้เพื่อ Build และ Start ทุก Service:

```bash
docker-compose up -d --build

```

> *Tip: `--build` จะบังคับให้ Docker build image ใหม่จาก Dockerfile เสมอ (เหมาะตอนแก้ Code)*

### Step 2: Check Status

ตรวจสอบว่าทุก Container รันอยู่หรือไม่:

```bash
docker-compose ps

```

### Step 3: Access Services

* **Web App**: เปิด Browser ไปที่ `http://localhost:8080` (จะเห็นหน้าเว็บ React ของคุณ)
* **MinIO Console**: เข้าไปจัดการไฟล์ที่ `http://localhost:9001` (User/Pass: `minioadmin`)
* **API**: ลองยิง Postman ไปที่ `http://localhost:3000`

### Step 4: Cleanup

เมื่อจบ Workshop ให้ลบ Container และ Network ทิ้ง:

```bash
docker-compose down

```

*(ถ้าอยากลบ Database ด้วยให้ใช้ `docker-compose down -v`)*

---

## 💡 Key Takeaways

1. **Isolation**: แต่ละ Service ทำงานแยกกันชัดเจน (DB, Storage, API, Web)
2. **Networking**: Service คุยกันผ่านชื่อ Service (เช่น `db`, `minio`) ไม่ต้องใช้ IP
3. **Multi-stage Build**: ช่วยให้ Image ของเราเล็กและปลอดภัยขึ้น เพราะไม่มี Source code หรือ Dev dependencies ใน Final Image
4. **.dockerignore**: ช่วยให้การ Build เร็วขึ้นและไม่เอาไฟล์ขยะเข้าไป

---

### **[Optional] Code Snippet สำหรับ `nodeapi/src/index.js**`

เผื่อผู้เรียนถามว่าใน Code เชื่อมต่อกันยังไง (เป็น Concept):

```javascript
const express = require('express');
const { Pool } = require('pg');
const Minio = require('minio');
// ... setup multer ...

const app = express();

// เชื่อม DB โดยใช้ชื่อ Service ใน Docker Compose ('db')
const pool = new Pool({
  host: process.env.DB_HOST || 'db', // <--- สำคัญ
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// เชื่อม MinIO โดยใช้ชื่อ Service ('minio')
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'minio', // <--- สำคัญ
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

app.post('/login', async (req, res) => {
    // Logic Login...
});

app.post('/upload', upload.single('file'), async (req, res) => {
    // Logic Upload to MinIO...
});

app.listen(3000, () => console.log('Server running on port 3000'));

```