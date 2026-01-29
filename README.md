# 🐳 Workshop: Docker Compose for Full Stack App (Angular + Node.js + Postgres + MinIO)

ยินดีต้อนรับสู่ Workshop การสร้าง Environment สำหรับพัฒนา Web Application ครบวงจรด้วย Docker Compose โดยในโปรเจกต์นี้เราจะสร้างระบบที่มี:

1.  **WebApp**: หน้าบ้าน (Frontend) เขียนด้วย **Angular** มีระบบ Login (User: admin/admin123) และ Upload รูปโปรไฟล์
2.  **NodeAPI**: หลังบ้าน (Backend) เขียนด้วย **Node.js (Express)** เชื่อมต่อ Database และ Object Storage
3.  **DB**: ฐานข้อมูล **PostgreSQL** สำหรับเก็บข้อมูล User
4.  **MinIO**: ระบบเก็บไฟล์ (S3 Compatible) สำหรับเก็บรูปโปรไฟล์

---

## 📋 Pre-requisites

*   Docker & Docker Compose ติดตั้งในเครื่องเรียบร้อย
*   พื้นฐาน Node.js และ Angular เล็กน้อย

---

## 📂 1. Project Structure

โครงสร้างโปรเจกต์เป็นดังนี้:

```text
my-docker-workshop/
├── nodeapi/                # Backend Service (Node.js)
│   ├── src/
│   │   └── index.js        # API Logic (Login, Upload)
│   ├── .dockerignore
│   ├── Dockerfile
│   └── package.json
├── webapp/                 # Frontend Service (Angular)
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/      # Login Page
│   │   │   └── profile/    # Profile & Upload Page
│   │   └── ...
│   ├── .dockerignore
│   ├── Dockerfile          # Multi-stage using Nginx
│   └── ...
├── docker-compose.yml      # Orchestration
└── init.sql                # User table initialization
```

---

## 🛠️ 2. Setup Overview

### 2.1 Backend (NodeAPI)
เราใช้ **Node.js 18** สร้าง API ง่ายๆ สำหรับ:
- **Login**: ตรวจสอบ username/password จาก Postgres
- **Upload**: รับไฟล์ภาพและอัปโหลดไปที่ MinIO แล้วบันทึก URL ลง Postgres

### 2.2 Frontend (WebApp)
เราใช้ **Angular** (Latest) สร้าง UI:
- **Login Page**: ใส่ username/password เพื่อเข้าสู่ระบบ
- **Profile Page**: แสดงข้อมูล User, รูปโปรไฟล์ปัจจุบัน และปุ่มอัปโหลดรูปใหม่

### 2.3 Database (PostgreSQL)
เรามีไฟล์ `init.sql` เพื่อสร้างตาราง `users` และเพิ่ม User `admin` (pass: `admin123`) ตั้งแต่เริ่มต้น

---

## 🚀 3. How to Run (Step-by-Step)

### Step 1: Start Container

รันคำสั่งนี้เพื่อ Build และ Start ทุก Service:

```bash
docker-compose up -d --build
```

### Step 2: Check Status

ตรวจสอบว่าทุก Container รันอยู่หรือไม่:

```bash
docker-compose ps
```

### Step 3: Access Services

1.  **Web App**: เปิด Browser ไปที่ `http://localhost:8080`
    *   **Login**: Username: `admin`, Password: `admin123`
    *   ลองกด Upload รูปภาพ และดูผลลัพธ์
2.  **MinIO Console**: เข้าไปดูไฟล์ที่ `http://localhost:9001`
    *   User: `minioadmin`
    *   Pass: `minioadmin`
    *   ดู Bucket `user-profiles`
3.  **API**: `http://localhost:3000` (Backend)

### Step 4: Cleanup

เมื่อจบ Workshop ให้ลบ Container และ Network ทิ้ง:

```bash
docker-compose down
```

*ใช้ `docker-compose down -v` หากต้องการลบข้อมูลใน Database และ Storage ด้วย*

---

## 💡 Key Takeaways

1.  **Angular in Docker**: การใช้ Multi-stage build build Angular app (`npm run build`) แล้วนำไฟล์ที่ได้ไปวางใน **Nginx** container เพื่อ serve static files ทำให้ image มีขนาดเล็กและประสิทธิภาพสูง
2.  **Full Stack Orchestration**: การเชื่อมต่อ 4 services (Frontend, Backend, DB, Storage) เข้าด้วยกันผ่าน Docker Network
3.  **Environment Variables**: การส่งค่า config ต่างๆ (DB Host, MinIO Key) ผ่าน `environment` ใน `docker-compose.yml`