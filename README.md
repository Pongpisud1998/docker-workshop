# 🐳 Docker Full Stack GIS Workshop

ยินดีต้อนรับสู่ Workshop การสร้างและ Deploy ระบบ GIS Web Application ด้วย Docker!
ใน Workshop นี้ คุณจะได้ลงมือทำจริงตั้งแต่เริ่มสร้าง Dockerfile ไปจนถึงการเขียน Docker Compose เพื่อเชื่อมต่อ 6 Services เข้าด้วยกัน

---

## 🏗️ สิ่งที่เราจะสร้าง (Architecture)
ระบบประกอบด้วย 6 Containers ที่ทำงานร่วมกันใน Network เดียว:
1.  **webapp**: Frontend (Angular) + Nginx (Gateway)
2.  **nodeapi**: Backend API (Node.js/Express)
3.  **db**: Database (PostgreSQL + PostGIS)
4.  **minio**: Object Storage (เก็บไฟล์ภาพ)
5.  **geoserver**: Map Server (Serving WMS)
6.  **phpapi**: Tile Server (Serving MBTiles)

---

## 🚀 เริ่มต้นกันเลย!

### 📝 Step 1: เตรียมโครงสร้างไฟล์
สร้าง Folder และไฟล์เปล่าตามโครงสร้างนี้:
```bash
docker-workshop/
├── .env                # ไฟล์เก็บตัวแปรระบบ (ห้ามเอาขึ้น Git)
├── docker-compose.yml  # ไฟล์พระเอกของเรา
├── init.sql            # Script สร้างตารางเริ่มต้น
├── nodeapi/            # Folder Backend
│   └── Dockerfile      # <-- เราจะมาเขียนไฟล์นี้
├── webapp/             # Folder Frontend
│   ├── nginx.conf      # <-- และไฟล์นี้
│   └── Dockerfile      # <-- และไฟล์นี้
├── phpapi/             # Folder PHP
│   └── Dockerfile      # <-- และไฟล์นี้
├── geoserver-data/     # เก็บข้อมูล GeoServer
└── geoserver-cache/    # เก็บ Cache
```

---

### 🗄️ Step 2: Database & Storage (Layer 1)

เราจะใช้ Official Images สำหรับ Database และ Storage ไม่ต้องเขียน Dockerfile เอง แต่ต้องเตรียม Config

**1. สร้างไฟล์ `init.sql`** (สำหรับสร้างตารางแรกเริ่ม)
*นำ Code SQL ใส่ในไฟล์ `init.sql` ที่ root*
*(ใช้ไฟล์ที่มีอยู่ในโปรเจค)*

**2. สร้างไฟล์ `.env`**
กำหนดรหัสผ่านและค่า Config ต่างๆ ที่นี่:
```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=workshop_db

# MinIO (Storage)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=workshop-bucket

# NodeAPI
PORT=3000
DATABASE_URL=postgres://postgres:postgres@db:5432/workshop_db
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# GeoServer
GEOSERVER_ADMIN_USER=admin
GEOSERVER_ADMIN_PASSWORD=admin

# WebApp
WEBAPP_PORT=80
```

---

### ⚙️ Step 3: Backend (Node.js)
เราจะสร้าง Custom Image สำหรับ Node API

**เขียนไฟล์ `nodeapi/Dockerfile`:**
```dockerfile
# ใช้ Base Image Node.js เวอร์ชั่น 18 (Alpine เล็กและเบา)
FROM node:18-alpine

# กำหนด Folder ทำงานใน Container
WORKDIR /app

# Copy ไฟล์ Package เพื่อ Install Dependencies ก่อน (เทคนิค Caching)
COPY package*.json ./
RUN npm install

# Copy Source Code ทั้งหมด
COPY . .

# รัน App
CMD ["node", "src/index.js"]
```

---

### ☕ Step 4: Map Services (GeoServer & PHP)

**4.1 GeoServer**
เราใช้วิธี Mount Volume เพื่อเก็บข้อมูล (ไม่ต้องเขียน Dockerfile) แต่ต้องเตรียม Folder:
- สร้าง Folder `geoserver-data` และ `geoserver-cache` ไว้ที่ Root

**4.2 PHP API (สำหรับ MBTiles)**
สร้างไฟล์ `phpapi/Dockerfile` เพื่อลง Driver SQLite:
```dockerfile
FROM php:8.2-apache

# Install System Dependencies & PHP Extensions
RUN apt-get update && apt-get install -y libpq-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_pgsql pdo_sqlite

# เปิด Module Rewrite ของ Apache
RUN a2enmod rewrite

# Copy Code เข้าไปที่ Web Root
COPY src/ /var/www/html/
```

---

### 🌐 Step 5: Frontend & Gateway (Angular + Nginx)
ส่วนนี้ซับซ้อนสุด เพราะเราต้อง Compile Angular แล้วเอาไปวางบน Nginx และ Config Nginx ให้เป็น Gateway

**5.1 เขียน `webapp/nginx.conf`**
Config นี้จะทำหน้าที่ Route Traffic ไปหา Services ต่างๆ (Reverse Proxy):
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 500M;  # รองรับ Upload ไฟล์ใหญ่

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy -> Node API
    location /api/ {
        proxy_pass http://workshop-nodeapi:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # Proxy -> GeoServer
    location /geoserver {
        proxy_pass http://workshop-geoserver:8080/geoserver;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_redirect http://workshop-geoserver:8080/geoserver /geoserver;
    }

    # Proxy -> PHP API
    location /php-api/ {
        proxy_pass http://workshop-phpapi:80/;
        proxy_set_header Host $host;
    }
}
```

**5.2 เขียน `webapp/Dockerfile` (Multi-stage Build)**
```dockerfile
# Stage 1: Build Angular
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration development

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy ไฟล์ที่ Build เสร็จแล้วมาวาง
COPY --from=build /app/dist/webapp/browser /usr/share/nginx/html
# Copy Config Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

---

### 🎼 Step 6: Orchestration (Docker Compose)
รวมทุกอย่างเข้าด้วยกันใน `docker-compose.yml`

```yaml
version: '3.8'

services:
  # --- Data Layer ---
  db:
    image: postgis/postgis:15-3.4
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - workshop-network

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    networks:
      - workshop-network

  # --- Application Layer ---
  nodeapi:
    build: ./nodeapi
    environment:
      PORT: ${PORT}
      DATABASE_URL: ${DATABASE_URL}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      MINIO_BUCKET: ${MINIO_BUCKET}
    depends_on:
      - db
      - minio
    networks:
      - workshop-network

  geoserver:
    image: kartoza/geoserver:2.24.0
    environment:
      GEOSERVER_ADMIN_USER: ${GEOSERVER_ADMIN_USER}
      GEOSERVER_ADMIN_PASSWORD: ${GEOSERVER_ADMIN_PASSWORD}
      CORS_ENABLED: "true"
      CORS_ALLOWED_ORIGINS: "*"
    volumes:
      - ./geoserver-data:/opt/geoserver/data_dir
      - ./geoserver-cache:/opt/geoserver/data_dir/gwc
    networks:
      - workshop-network

  phpapi:
    build: ./phpapi
    networks:
      - workshop-network

  # --- Presentation Layer (Frontend & Gateway) ---
  webapp:
    build: ./webapp
    ports:
      - "${WEBAPP_PORT}:80"  # เข้าผ่าน Port 80
    depends_on:
      - nodeapi
      - geoserver
      - phpapi
    networks:
      - workshop-network

volumes:
  db-data:
  minio-data:

networks:
  workshop-network:
    driver: bridge
```

---

### ▶️ Step 7: Run & Verify

1. **Start System:**
   ```bash
   sudo docker compose up -d --build
   ```
   *(รอสักพักเพื่อให้ Build เสร็จและ Services เริ่มทำงาน)*

2. **ทดสอบใช้งาน:**
   - 🌍 **Web App**: เข้า `http://localhost/`
   - 🗺️ **GeoServer (Proxy)**: เข้า `http://localhost/geoserver` (Login: `admin` / `admin`)
   - 🗄️ **MinIO Console**: เข้า `http://localhost:9001` (Login: `minioadmin` / `minioadmin`)

3. **Workshop Challenge:**
   - ลอง Login ใน Web App แล้ว Upload ไฟล์ Raster
   - กด Toggle Layer "GeoServer" และ "PHP" เพื่อดูแผนที่

---
**🎉 ยินดีด้วย! คุณได้สร้างระบบ Full Stack GIS บน Docker สำเร็จแล้ว**