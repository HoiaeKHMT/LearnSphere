# Đánh giá kiến trúc AWS cho LearnSphere

## Tổng quan dự án

**LearnSphere** là một nền tảng học tập trực tuyến (LMS) với:
- **Backend**: Node.js + Express.js (REST API)
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Database**: MongoDB (qua Mongoose)
- **Storage**: AWS S3 (upload/download file, presigned URLs)
- **AI**: OpenAI API (tích hợp cho quiz/AI features)
- **Chức năng chính**: Quản lý khóa học, bài học (video + tài liệu), quiz, tiến độ học tập, ghi danh

---

## ✅ Nhận xét: Các dịch vụ AWS trong diagram có phù hợp không?

### 1. Amazon S3 — ✅ Rất phù hợp

**Lý do**: Code đã triển khai đầy đủ:
- Upload ảnh thumbnail khóa học (max 5MB)
- Upload video bài học (max 500MB) — `.mp4`, `.webm`
- Upload tài liệu bài học (max 20MB) — `.pdf`, `.docx`
- Presigned URL cho cả upload (PUT) và download (GET)
- Tổ chức key theo cấu trúc `courses/{courseId}/{folder}/{uuid}-{filename}`

**Đây là lựa chọn đúng đắn** vì S3 phù hợp hoàn toàn với việc lưu trữ media/tài liệu giáo dục.

---

### 2. Amazon ECR — ✅ Phù hợp (cần chuẩn bị)

**Lý do**: App được container hóa bằng Docker để deploy lên EC2.
- Server có graceful shutdown (`SIGTERM`, `SIGINT`) — chuẩn Docker
- Code comment ngay trong `server.js`: *"Cực kỳ quan trọng khi deploy Docker Container lên AWS EC2 ở Week 3"*

**Lưu ý**: Chưa thấy `Dockerfile` trong repo → cần tạo.

---

### 3. CloudWatch — ✅ Phù hợp

Mọi ứng dụng production trên AWS đều cần CloudWatch để:
- Thu thập logs từ EC2/container
- Thiết lập Alarm khi CPU, memory vượt ngưỡng
- Giám sát API latency

---

### 4. GitHub Actions (CI/CD) — ✅ Phù hợp

Workflow deploy tự động: push code → build Docker → push ECR → deploy EC2.

---

### 5. OpenAI API — ✅ Phù hợp

Tích hợp AI (quiz generation, AI messages) là tính năng cốt lõi của platform.

---

## ⚠️ VẤN ĐỀ NGHIÊM TRỌNG: Database không khớp!

> [!CAUTION]
> **Diagram dùng RDS PostgreSQL, nhưng code dùng MongoDB (Mongoose)!**

Đây là **mâu thuẫn lớn nhất** giữa diagram và implementation:

| | Diagram | Code thực tế |
|---|---|---|
| Database | RDS PostgreSQL | MongoDB (Mongoose) |
| ORM | SQL | Mongoose ODM |
| Schema | Relational | Document-based |

**Cần sửa diagram** → thay `RDS PostgreSQL` thành `MongoDB Atlas` (nếu dùng cloud) hoặc thêm EC2 instance chạy MongoDB tự quản lý.

**Khuyến nghị**: Dùng **MongoDB Atlas** (managed service) thay vì tự chạy trên EC2 → không cần quản lý replica set, backup tự động.

---

## ⚠️ Thiếu: VPC chỉ có 1 Availability Zone

> [!WARNING]
> Diagram chỉ có **1 AZ** (`ap-southeast-1a`). Nếu AZ đó gặp sự cố, toàn bộ hệ thống sẽ ngừng hoạt động.

**Khuyến nghị cho production**: Multi-AZ deployment (ít nhất 2 AZ).

---

## 💡 Gợi ý cải thiện kiến trúc

### Gợi ý 1: Thêm CloudFront CDN (Quan trọng)

```
User → CloudFront → S3 (video, images, docs)
```

**Lợi ích**:
- Video học (500MB) phân phối nhanh hơn toàn cầu
- Giảm chi phí S3 egress bandwidth đáng kể
- Tích hợp HTTPS tự động
- Cache tĩnh gần người dùng (edge locations ở Singapore)

---

### Gợi ý 2: Thay WebApp (EC2 đơn) → Application Load Balancer + Auto Scaling

**Hiện tại**: 1 EC2 instance duy nhất → Single Point of Failure

**Nên thành**:
```
Internet Gateway → ALB → EC2 Auto Scaling Group (min 2 instances)
```

**Lợi ích**: High availability, scale theo tải, zero-downtime deployment.

---

### Gợi ý 3: Frontend nên deploy lên S3 + CloudFront

**Frontend (React/Vite)** là static files sau khi build → không cần server.

```
S3 Bucket (FE) → CloudFront → User
```

**Lợi ích**: Rẻ hơn, không cần EC2 cho FE, scale tự động.

---

### Gợi ý 4: Thêm AWS Secrets Manager hoặc Parameter Store

Hiện tại dùng `.env` file trên server → không an toàn cho production.

**Nên dùng**: AWS Secrets Manager để quản lý:
- `MONGODB_URI`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- AWS credentials

---

### Gợi ý 5: Thêm SES (Simple Email Service)

Code đang dùng **Nodemailer** cho email → nếu deploy lên AWS, nên dùng **Amazon SES** thay SMTP bên ngoài để:
- Tránh bị block do spam filters
- Scale tốt hơn
- Chi phí rẻ hơn

---

## 📊 Tóm tắt đánh giá

| Dịch vụ | Đánh giá | Ghi chú |
|---|---|---|
| S3 | ✅ Rất phù hợp | Đã implement đầy đủ |
| ECR | ✅ Phù hợp | Cần tạo Dockerfile |
| CloudWatch | ✅ Phù hợp | Nên thêm log groups |
| GitHub Actions | ✅ Phù hợp | Cần viết workflow file |
| RDS PostgreSQL | ❌ Sai | Code dùng MongoDB → sửa diagram |
| OpenAI API | ✅ Phù hợp | External service |
| **CloudFront** | 💡 Thiếu | Cần thêm cho video CDN |
| **ALB + ASG** | 💡 Thiếu | Tránh SPOF cho WebApp |
| **SES** | 💡 Thiếu | Thay Nodemailer |
| **Secrets Manager** | 💡 Thiếu | Quản lý secrets an toàn |

---

## 🔧 Ưu tiên sửa ngay

1. **[Quan trọng nhất]** Sửa diagram: `RDS PostgreSQL` → `MongoDB Atlas`
2. Tạo `Dockerfile` cho BE (và FE nếu cần)
3. Thêm `CloudFront` distribution trước S3 cho video CDN
4. Viết GitHub Actions workflow (`.github/workflows/deploy.yml`)
