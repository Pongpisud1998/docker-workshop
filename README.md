# Docker Workshop: Full Stack App

ยินดีต้อนรับสู่ Workshop! เพื่อให้การเรียนรู้มีประสิทธิภาพสูงสุด ในไฟล์นี้จะ**ไม่มี Code สำเร็จรูปให้ Copy-Paste ทั้งก้อน** 
เราจะค่อยๆ เขียนไปทีละส่วนพร้อมคำอธิบายครับ

---

# 📂 เตรียมความพร้อม
โครงสร้างโปรเจค:
```
.
├── docker-compose.yml      ⬅️ (Step 5)
├── .env                    ⬅️ (Step 1)
├── init.sql                
├── nodeapi/                
│   └── Dockerfile          ⬅️ (Step 2)
└── webapp/                 
    ├── Dockerfile          ⬅️ (Step 4)
    └── nginx.conf          ⬅️ (Step 3)
```

---

# 🚀 เริ่มเขียน Code!

## Step 1: สร้าง Environment Variables (.env)
เปิดไฟล์ `.env` แล้วเพิ่มค่า config ทีละส่วนครับ

**1.1 Database Config (สำหรับสร้าง Container DB)**
กำหนด Username/Password/DB Name ที่ต้องการ:
```properties
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=mydatabase
```

**1.2 NodeAPI Config (สำหรับ Backend ไปต่อ DB)**
ต้องตรงกับข้างบน แต่ `DB_HOST` ต้องใช้ชื่อ Service ใน Docker Compose (ซึ่งเราจะตั้งว่า `db`):
```properties
DB_HOST=db
DB_USER=myuser
DB_PASS=mypassword
DB_NAME=mydatabase
```

**1.3 MinIO Config (สำหรับ Object Storage)**
กำหนด User/Pass สำหรับ Login เข้า MinIO Console:
```properties
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=user-profiles
MINIO_ENDPOINT=minio
```

---

## Step 2: Backend Dockerfile (nodeapi/Dockerfile)
เปิดไฟล์ `nodeapi/Dockerfile` แล้วเขียนตามทีละบรรทัด:

1.  **Base Image**: เราจะใช้ Node v18 แบบ Alpine (เล็กสุด)
    `FROM node:18-alpine`

2.  **Workdir**: กำหนดโฟลเดอร์ทำงานใน Container
    `WORKDIR /app`

3.  **Dependencies**: Copy ไฟล์ package มาก่อน แล้ว install (เพื่อใช้ Docker Cache)
    `COPY package*.json ./`
    `RUN npm ci`

4.  **Source Code**: Copy โค้ดที่เหลือทั้งหมด
    `COPY src ./src`

5.  **Expose Port**: บอกให้รู้ว่า App รันที่ Port 3000
    `EXPOSE 3000`

6.  **Start Command**: สั่งรัน App
    `CMD ["node", "src/index.js"]`

---

## Step 3: Nginx Config (webapp/nginx.conf)
เปิดไฟล์ `webapp/nginx.conf` เขียนทีละบล็อก:

1.  **Server Block**: เริ่มต้นประกาศ Server
    ```nginx
    server {
        listen 80;
        server_name localhost;
    ```

2.  **Root Directory**: บอก Nginx ว่าไฟล์เว็บอยู่ที่ไหน
    ```nginx
        root /usr/share/nginx/html;
        index index.html;
    ```

3.  **Frontend Routing**: ตั้งค่าให้ Angular Routing ทำงานได้ (ไม่ 404 เมื่อ refresh)
    ```nginx
        location / {
            try_files $uri $uri/ /index.html;
        }
    ```

4.  **Reverse Proxy API**: ส่ง Request ที่ขึ้นต้นด้วย `/api/` ไปหา Backend (`nodeapi`)
    *อย่าลืม `client_max_body_size` เพื่อให้อัพไฟล์ใหญ่ได้*
    ```nginx
        location /api/ {
            proxy_pass http://nodeapi:3000/;
            client_max_body_size 100M;
        }
    }
    ```

---

## Step 4: Frontend Dockerfile (webapp/Dockerfile)
เปิดไฟล์ `webapp/Dockerfile` เราจะใช้ **Multi-stage Build**:

**Stage 1: Build Angular**
1.  ประกาศ Stage แรกชื่อ `build-stage`
    `FROM node:18-alpine AS build-stage`

2.  Install dependencies & Build
    ```dockerfile
    WORKDIR /app
    COPY package*.json ./
    RUN npm install
    COPY . .
    RUN npm run build
    ```

**Stage 2: Production Run**
1.  ใช้ Nginx เพื่อรันเว็บ
    `FROM nginx:stable-alpine AS production-stage`

2.  Copy Config Nginx จาก Step 3 เข้าไป
    `COPY nginx.conf /etc/nginx/conf.d/default.conf`

3.  Copy ไฟล์ที่ Build ได้จาก Stage 1 มาลง (สังเกต path `dist/webapp/browser`)
    `COPY --from=build-stage /app/dist/webapp/browser /usr/share/nginx/html`

4.  รัน Nginx
    ```dockerfile
    EXPOSE 80
    CMD ["nginx", "-g", "daemon off;"]
    ```

---

## Step 5: Docker Compose (docker-compose.yml)
เปิดไฟล์ `docker-compose.yml` แล้วประกอบร่างครับ:

**5.1 Version & Services**
```yaml
version: '3.8'
services:
```

**5.2 Database Service**
ชื่อ service `db` ใช้ image `postgres` และดึงตัวแปรจาก .env มาใช้
```yaml
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-network
```

**5.3 MinIO Service**
ชื่อ `minio` map port 9000 (API) และ 9001 (Console)
```yaml
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    networks:
      - app-network
```

**5.4 Backend Service**
ชื่อ `nodeapi` ต้อง build จาก folder `./nodeapi` และใส่ Environment ให้ครบ
```yaml
  nodeapi:
    build: ./nodeapi
    environment:
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
      - db
      - minio
    networks:
      - app-network
```

**5.5 Frontend Service**
ชื่อ `webapp` build จาก `./webapp` map port `8080` เข้าหา `80`
```yaml
  webapp:
    build: ./webapp
    ports:
      - "8080:80"
    depends_on:
      - nodeapi
    networks:
      - app-network
```

**5.6 Networks & Volumes**
สุดท้าย อย่าลืมประกาศ Network และ Volume ที่เรียกใช้ไปข้างบน
```yaml
networks:
  app-network:
    driver: bridge

volumes:
  pgdata:
  minio_data:
```

---

## 🏁 Step 6: ทดสอบระบบ
รันคำสั่งเดียว จบทุกอย่าง:
```bash
docker-compose up -d --build
```
ถ้าทำถูกต้องทุกขั้นตอน:
1.  เปิด `localhost:8080` จะเจอหน้าเว็บ
2.  Login ได้, Upload รูปได้