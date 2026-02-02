# Docker Workshop: Mapedia Full Stack App

ยินดีต้อนรับสู่ Workshop การทำ Containerization สำหรับ Web Application

ใน Workshop นี้ คุณจะได้ฝึกปฏิบัติการเขียน Dockerfile, จัดการ Environment Variables และใช้งาน Docker Compose เพื่อจำลองระบบ Full Stack ที่ประกอบด้วย:
- **Frontend**: Angular (เสิร์ฟผ่าน Nginx)
- **Backend**: Node.js (Express)
- **Database**: PostgreSQL
- **Object Storage**: MinIO

---

## 🎯 เป้าหมาย
เมื่อจบ Workshop นี้ คุณจะต้องสามารถ run คำสั่ง `docker-compose up -d --build` แล้วได้ระบบที่ทำงานสมบูรณ์

## 📂 โครงสร้างโปรเจค
```
.
├── docker-compose.yml      <-- (ต้องเขียนเอง)
├── .env                    <-- (ต้องเขียนเอง)
├── init.sql                (มีให้แล้ว: สำหรับสร้างตารางใน Database)
├── nodeapi/                (Backend Source Code)
│   └── Dockerfile          <-- (ต้องเขียนเอง)
└── webapp/                 (Frontend Source Code)
    ├── Dockerfile          <-- (ต้องเขียนเอง)
    └── nginx.conf          <-- (ต้องเขียนเอง)
```

---

## 📝 ขั้นตอนการทำ

### Step 1: กำหนด Environment Variables
สร้างไฟล์ `.env` ที่ root ของโปรเจค เพื่อเก็บค่า config ต่างๆ

**สิ่งที่ต้องกำหนด:**
- **Database Config**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- **NodeAPI Config**: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
- **MinIO Config**: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`, `MINIO_ENDPOINT`
- **GeoServer Config**: `GEOSERVER_ADMIN_USER`, `GEOSERVER_ADMIN_PASSWORD`
- **WebApp Config**: `WEBAPP_PORT` (แนะนำ `80`)

### Step 2: Containerize Backend (NodeAPI)
สร้างไฟล์ `nodeapi/Dockerfile` เพื่อ build image สำหรับ Node.js
- Base Image: `node:18-alpine`
- Copy `package.json` และ install dependencies (`npm ci`)
- Copy source code (`src`)
- Command: `node src/index.js`
- **Challenge**: ลองใช้ Multi-stage build (Builder stage & Production stage) เพื่อลดขนาด image

### Step 3: Containerize Frontend (WebApp) & Nginx
เราจะใช้ Multi-stage build สำหรับ Angular:
1.  **Build Stage**: ใช้ `node:18-alpine` เพื่อ build angular project (`npm run build`)
2.  **Production Stage**: ใช้ `nginx:stable-alpine` เพื่อเสิร์ฟไฟล์ที่ build ได้

**3.1 เขียน `webapp/nginx.conf`**
สร้าง config สำหรับ Nginx เพื่อ:
- เสิร์ฟ static files ของ Angular
- ทำ Reverse Proxy `/api/` ไปยัง Backend (`nodeapi:3000`)
- ทำ Reverse Proxy `/geoserver` ไปยัง GeoServer (`geoserver:8080`)
- ทำ Reverse Proxy `/php-api/` ไปยัง PHP API (`phpapi:80`)
- ตั้งค่า `client_max_body_size` ให้รองรับการอัพโหลดไฟล์ใหญ่ (เช่น 500M)

**3.2 เขียน `webapp/Dockerfile`**
- Stage 1: Build Angular app
- Stage 2: Copy `dist` folder ไปที่ `/usr/share/nginx/html`
- Copy `nginx.conf` ไปที่ `/etc/nginx/conf.d/default.conf`

### Step 4: Orchestrate with Docker Compose
สร้างไฟล์ `docker-compose.yml` เพื่อเชื่อมต่อทุก service เข้าด้วยกัน

**Services ที่ต้องมี:**
1.  **db**: PostgreSQL + PostGIS (Image: `postgis/postgis:15-3.4`)
    - Map port: `5432:5432`
    - Volumes: `db-data`, `./init.sql`
2.  **minio**: Object Storage
    - Command: `server /data --console-address ":9001"`
    - Ports: `9000` (API), `9001` (Console)
    - Volumes: `minio-data`
3.  **nodeapi**: Backend
    - Build: `./nodeapi`
    - Environment: ค่าจาก `.env`
    - Depends on: `db`, `minio`
    - (Internal Only - No Ports Exposed)
4.  **webapp**: Frontend (Main Entry Point)
    - Build: `./webapp`
    - Ports: `${WEBAPP_PORT}:80` (เข้าผ่าน port 80 ได้เลย)
    - Depends on: `nodeapi`
5.  **geoserver**: GeoServer (Image: `kartoza/geoserver:2.24.0`)
    - Environment: Admin Creds, CORS Settings
    - Volumes: `./geoserver-data` (Data), `./geoserver-cache` (Cache)
    - (Internal Only - No Ports Exposed)
6.  **phpapi**: PHP API (MBTiles Server)
    - Build: `./phpapi`
    - Environment: DB Connection
    - (Internal Only - No Ports Exposed)

**Networks/Volumes**:
- สร้าง Network แบบ Bridge ให้ containers คุยกัน
- สร้าง Volumes สำหรับ `db` และ `minio`

### Step 5: Run & Test
รันคำสั่ง:
```bash
docker-compose up -d --build
```
- **WebApp**: ไปที่ `http://localhost/` (ถ้าตั้ง port 80)
- **MinIO Console**: `http://localhost:9001`
- **GeoServer**: เข้าผ่าน Proxy ได้ที่ `http://localhost/geoserver`
- **PHP MBTiles**: ทดสอบเปิด Layer ในหน้า WebApp

---
**ขอให้สนุกกับการเขียน Docker! 🐳**