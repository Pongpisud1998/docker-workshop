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

### Step 2: Containerize Backend (NodeAPI)
สร้างไฟล์ `nodeapi/Dockerfile` เพื่อ build image สำหรับ Node.js
- Base Image: `node:18-alpine`
- Copy `package.json` และ install dependencies (`npm ci`)
- Copy source code (`src`)
- Expose port `3000`
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
- ตั้งค่า `client_max_body_size` ให้รองรับการอัพโหลดไฟล์ใหญ่ (เช่น 100M)

**3.2 เขียน `webapp/Dockerfile`**
- Stage 1: Build Angular app
- Stage 2: Copy `dist` folder ไปที่ `/usr/share/nginx/html`
- Copy `nginx.conf` ไปที่ `/etc/nginx/conf.d/default.conf`

### Step 4: Orchestrate with Docker Compose
สร้างไฟล์ `docker-compose.yml` เพื่อเชื่อมต่อทุก service เข้าด้วยกัน

**Services ที่ต้องมี:**
1.  **db**: PostgreSQL 
    - Map port: `5432`? (ไม่จำเป็นต้อง map ออกมาก็ได้ถ้า app คุยกันผ่าน network)
    - Volumes: `pgdata`, `init.sql`
2.  **minio**: Object Storage
    - Command: `server /data --console-address ":9001"`
    - Ports: `9000` (API), `9001` (Console)
    - Volumes: `minio_data`
3.  **nodeapi**: Backend
    - Build: `./nodeapi`
    - Environment: ส่งค่าจาก `.env` เข้าไป (DB Connection, MinIO Creds)
    - Depends on: `db`, `minio`
4.  **webapp**: Frontend
    - Build: `./webapp`
    - Ports: `8080:80`
    - Depends on: `nodeapi`

**Networks/Volumes**:
- สร้าง Network แบบ Bridge ให้ containers คุยกัน
- สร้าง Volumes สำหรับ `db` และ `minio` เพื่อให้ข้อมูลไม่หาย

### Step 5: Run & Test
รันคำสั่ง:
```bash
docker-compose up -d --build
```
- เปิด Browser ไปที่ `http://localhost:8080`
- ลอง Login, Upload รูป Profile, Upload Layer, Delete Layer
- เช็ค MinIO Console ที่ `http://localhost:9001`

---
**ขอให้สนุกกับการเขียน Docker! 🐳**