# Docker Workshop: Full Stack App

ยินดีต้อนรับสู่ Workshop การทำ Containerization สำหรับ Web Application

ใน Workshop นี้ คุณจะได้ลงมือเขียน config สำหรับ Docker ตั้งแต่เริ่มต้น พร้อมคำอธิบายทีละขั้นตอน

---

# 📂 เตรียมความพร้อม
โครงสร้างโปรเจคควรเป็นดังนี้ (ไฟล์ที่มีลูกศร ⬅️ คือไฟล์ที่เราจะไปเขียนกัน)
```
.
├── docker-compose.yml      ⬅️ (Step 5)
├── .env                    ⬅️ (Step 1)
├── init.sql                (SQL สำหรับสร้างตาราง)
├── nodeapi/                (Backend)
│   ├── src/
│   └── Dockerfile          ⬅️ (Step 2)
└── webapp/                 (Frontend)
    ├── src/
    ├── Dockerfile          ⬅️ (Step 4)
    └── nginx.conf          ⬅️ (Step 3)
```

---

# � เริ่มกันเลย!

## Step 1: สร้าง Environment Variables (.env)
เริ่มจากการกำหนดค่าคงที่ต่างๆ ที่ระบบต้องใช้ เพื่อให้แก้ไขได้ง่ายและไม่ต้อง hardcode ลงใน source code

สร้างไฟล์ `.env` ที่ root ของโปรเจค และใส่โค้ดนี้:

```properties
# Database Configuration (PostgreSQL)
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydatabase

# Backend Database Config (NodeAPI จะใช้ค่านี้ต่อ database)
DB_HOST=db
DB_USER=myuser
DB_PASS=mypassword
DB_NAME=mydatabase

# Object Storage (MinIO)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=user-profiles
MINIO_ENDPOINT=minio
```
**คำอธิบาย:**
- `POSTGRES_...`: ค่า config สำหรับ Container Database (PostgreSQL)
- `DB_...`: ค่าที่ Backend (NodeAPI) จะใช้เชื่อมต่อหา Database (`DB_HOST=db` คือชื่อ service ใน docker-compose)
- `MINIO_...`: ค่า config สำหรับ MinIO Storage

---

## Step 2: Containerize Backend (nodeapi/Dockerfile)
เราจะสร้าง Image สำหรับ Backend ที่เขียนด้วย Node.js

สร้างไฟล์ `nodeapi/Dockerfile` และใส่โค้ดนี้:

```dockerfile
# เริ่มต้นจาก Image node เวอร์ชัน 18 แบบ alpine (ขนาดเล็ก)
FROM node:18-alpine

# กำหนด working directory ใน container เป็น /app
WORKDIR /app

# Copy ไฟล์ package.json มาเพื่อเตรียม install dependencies
COPY package*.json ./

# Install packages (ใช้ npm ci เพื่อความเร็วและความแน่นอนกว่า npm install)
RUN npm ci

# Copy source code ทั้งหมดเข้าไปใน container
COPY src ./src

# เปิด Port 3000 (Backend รันที่ port นี้)
EXPOSE 3000

# คำสั่งรันเมื่อ container เริ่มทำงาน
CMD ["node", "src/index.js"]
```

---

## Step 3: Config Nginx (webapp/nginx.conf)
เนื่องจาก Frontend เป็น Angular เมื่อ build เสร็จจะได้ไฟล์ static (html, css, js) เราจึงต้องใช้ Nginx เป็น Web Server และจะใช้ Nginx ทำ **Reverse Proxy** เพื่อส่ง request `/api/` ไปหา Backend ด้วย

สร้างไฟล์ `webapp/nginx.conf` และใส่โค้ดนี้:

```nginx
server {
    listen 80;
    server_name localhost;
    
    # กำหนด root directory ของไฟล์ frontend
    root /usr/share/nginx/html;
    index index.html;

    # ถ้าหาไฟล์ไม่เจอ ให้โยนกลับไป index.html (สำหรับ Angular Routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy: ถ้าเข้ามาที่ /api/ ให้ส่งต่อไปหา backend (service ชื่อ "nodeapi")
    location /api/ {
        proxy_pass http://nodeapi:3000/;
        
        # รองรับการอัพโหลดไฟล์ขนาดใหญ่ (เช่น GeoTiff)
        client_max_body_size 100M;
    }
}
```

---

## Step 4: Containerize Frontend (webapp/Dockerfile)
เราจะใช้เทคนิค **Multi-stage Build** เพื่อให้ Image สุดท้ายมีขนาดเล็กที่สุด (ไม่ต้องมี Node.js runtime ติดไปด้วย)

สร้างไฟล์ `webapp/Dockerfile` และใส่โค้ดนี้:

```dockerfile
# --- Stage 1: Build Stage ---
# ใช้ Node เพื่อ Build Angular App
FROM node:18-alpine AS build-stage

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# คำสั่ง Build ของ Angular ผลลัพธ์จะอยู่ที่ /app/dist/webapp/browser
RUN npm run build

# --- Stage 2: Production Stage ---
# ใช้ Nginx เพื่อเสิร์ฟไฟล์ (Image นี้เล็กมาก)
FROM nginx:stable-alpine AS production-stage

# Copy ไฟล์ config Nginx ที่เราเขียนใน Step 3 เข้าไป
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy ไฟล์ที่ Build เสร็จแล้วจาก Stage 1 มาไว้ที่ folder ของ Nginx
COPY --from=build-stage /app/dist/webapp/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Step 5: รวมร่างด้วย Docker Compose (docker-compose.yml)
ขั้นตอนสุดท้าย คือการกำหนดว่าระบบเรามี Service อะไรบ้าง และจะรันยังไง

สร้างไฟล์ `docker-compose.yml` ที่ root ของโปรเจค และใส่โค้ดนี้:

```yaml
version: '3.8'

services:
  # 1. Database Service
  db:
    image: postgres:15-alpine
    environment:
      # ใช้ตัวแปรจากไฟล์ .env
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      # เก็บข้อมูลลง Volume ชื่อ pgdata (ข้อมูลไม่หายเมื่อลบ container)
      - pgdata:/var/lib/postgresql/data
      # รันไฟล์ sql เริ่มต้นเมื่อสร้าง database ครั้งแรก
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-network

  # 2. Object Storage (MinIO)
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000" # API Port
      - "9001:9001" # Console Port
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    networks:
      - app-network

  # 3. Backend (NodeAPI)
  nodeapi:
    build: ./nodeapi  # Build จาก Dockerfile ใน folder nodeapi
    Environment:
      - DB_HOST=${DB_HOST}
      - DB_USER=${DB_USER}
      - DB_PASS=${DB_PASS}
      - DB_NAME=${DB_NAME}
      - MINIO_ENDPOINT=${MINIO_ENDPOINT}
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
      - MINIO_BUCKET=${MINIO_BUCKET}
      - MINIO_GEORASTER_BUCKET=layers
    depends_on:
      - db      # รอให้ db รันก่อน
      - minio   # รอให้ minio รันก่อน
    networks:
      - app-network

  # 4. Frontend (WebApp)
  webapp:
    build: ./webapp # Build จาก Dockerfile ใน folder webapp
    ports:
      - "8080:80"   # เข้าเว็บผ่าน http://localhost:8080
    depends_on:
      - nodeapi     # รอให้ backend รันก่อน
    networks:
      - app-network

# สร้าง Network ให้ทุก container คุยกันได้
networks:
  app-network:
    driver: bridge

# สร้าง Volumes ถาวร
volumes:
  pgdata:
  minio_data:
```

---

## ✅ Step 6: Run ทดสอบ
เมื่อเขียนทุกไฟล์ครบแล้ว ให้รันคำสั่ง:

```bash
docker-compose up -d --build
```

### การตรวจสอบ
1.  **Frontend**: เปิด [http://localhost:8080](http://localhost:8080)
    - ต้องเห็นหน้า Login
    - ลอง Login (user: `testuser`, pass: `password`)
2.  **MinIO Console**: เปิด [http://localhost:9001](http://localhost:9001)
    - Login ด้วยค่าใน .env (default: `minioadmin` / `minioadmin`)

ถ้าต้องการหยุดการทำงาน:
```bash
docker-compose down
```