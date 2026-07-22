# LearnSphere — Kiến trúc AWS

## Tổng quan

LearnSphere là nền tảng học tập trực tuyến được triển khai trên AWS khu vực `ap-southeast-1` (Singapore).

---

## Sơ đồ kiến trúc (đã cập nhật)

```
                    ┌───────────────────────────────────────────────────────────────┐
                    │                        AWS Cloud                               │
                    │                   Region: ap-southeast-1                       │
                    │                                                               │
 GitHub Actions ───►│──► [ECR] learnsphere-be ──────────────────────────────────►  │
 (CI/CD push)       │         (Docker Registry)          ▼                          │
                    │                              [EC2 t3.micro]                   │
                    │                           Amazon Linux 2023                   │
 User (Browser) ───►│──► CloudFront (FE) ──► [S3] learnsphere-fe-static            │
                    │                                                               │
 User (API call) ──►│──► Internet Gateway ──► [EC2] :5000 ──► [S3] Media Bucket    │
                    │                              │                                │
                    │                              │◄── IAM Role (S3 + ECR access)  │
                    │                              │                                │
                    │                         [CloudWatch]                          │
                    │                       Logs & Alarms                           │
                    │                                                               │
                    └───────────────────────────────────────────────────────────────┘
                                  │                      │
                           [MongoDB Atlas]          [OpenAI API]
                          (External Cloud DB)      (External API)
```

---

## Chi tiết từng thành phần

### 1. Amazon ECR (Elastic Container Registry)
- **Repository**: `learnsphere-be`
- **Region**: `ap-southeast-1`
- **Mục đích**: Lưu trữ Docker image của Backend Node.js
- **Tích hợp**: GitHub Actions build và push image mỗi khi có commit vào `main`
- **Scan on push**: Bật — tự động quét lỗ hổng bảo mật

### 2. Amazon EC2
- **Instance type**: `t3.micro` (1 vCPU, 1 GB RAM)
- **OS**: Amazon Linux 2023
- **Subnet**: Public subnet
- **IAM Role**: `learnsphere-ec2-role` — quyền truy cập S3 và ECR
- **Chạy**: Docker container từ ECR image
- **Port**: `5000` (Express.js API)
- **Graceful shutdown**: Xử lý `SIGTERM` để đóng MongoDB connection trước khi tắt

### 3. Amazon S3
#### Bucket 1: Media & Assets (`ai-learning-platform-vhd`)
- Video bài học (`.mp4`, `.webm`) — max 500 MB/file
- Tài liệu bài học (`.pdf`, `.docx`) — max 20 MB/file
- Thumbnail khóa học (`.jpg`, `.png`, `.webp`) — max 5 MB/file
- Truy cập qua **Presigned URL** (thời hạn: upload 5 phút, download 15 phút)

#### Bucket 2: Frontend Static (`learnsphere-fe-static`)
- Static files sau khi build React/Vite
- Bật **Static Website Hosting**
- Phân phối qua **CloudFront**

### 4. Amazon CloudFront
#### Distribution 1 — Frontend
- **Origin**: S3 `learnsphere-fe-static`
- **Use case**: Phân phối React SPA đến người dùng
- **Cache**: Assets lâu dài, `index.html` không cache
- **Custom error**: 403/404 → `index.html` (hỗ trợ React Router)

#### Distribution 2 — Media (tùy chọn)
- **Origin**: S3 `ai-learning-platform-vhd`
- **Use case**: CDN cho video/tài liệu, giảm latency và chi phí bandwidth

### 5. MongoDB Atlas (External)
- **Tier**: M0 Free / M2 Shared
- **Region**: Gần `ap-southeast-1` (Singapore cluster)
- **Kết nối**: Từ EC2 qua connection string MongoDB SRV
- **Lý do không dùng RDS**: Project dùng Mongoose ODM — document-oriented database

### 6. GitHub Actions (CI/CD)
- **Trigger**: Push lên branch `main`
- **Job 1 — Backend**: Build Docker → Push ECR → SSH EC2 → Restart container
- **Job 2 — Frontend**: npm build → S3 sync → CloudFront invalidation
- **Secrets**: Lưu trong GitHub Repository Secrets (không hardcode)

### 7. Amazon CloudWatch
- **Log group**: `/learnsphere/backend` — nhận logs từ Docker container (driver `awslogs`)
- **Alarms**:
  - CPU > 80% → Email notification
  - EC2 StatusCheckFailed → Email notification

### 8. OpenAI API (External)
- Dùng cho tính năng AI Assistant và hỗ trợ quiz
- Key lưu trong `.env` trên EC2 (không commit lên Git)

---

## Bảo mật

| Lớp | Biện pháp |
|---|---|
| IAM | EC2 dùng IAM Role (không hardcode credentials) |
| GitHub | Credentials lưu trong GitHub Secrets |
| Docker | Chạy với non-root user (`nodejs:1001`) |
| S3 | File truy cập qua Presigned URL có thời hạn |
| EC2 | SSH chỉ mở cho IP cụ thể |
| Network | Backend nằm trong VPC, chỉ expose port 5000 |

---

## Ước tính chi phí

| Dịch vụ | Cấu hình | Chi phí/tháng |
|---|---|---|
| EC2 t3.micro | 1 instance, 24/7 | ~$8.50 (Free Tier: $0) |
| S3 | ~10 GB storage + transfer | ~$1.50 |
| CloudFront | ~50 GB transfer | ~$4.25 |
| ECR | <500 MB images | $0 (500 MB free) |
| CloudWatch | Logs + basic metrics | ~$2.00 |
| MongoDB Atlas | M0 Free Tier | $0 |
| **Tổng** | | **~$16–20/tháng** |

> Nếu tài khoản AWS còn Free Tier (12 tháng đầu): EC2 miễn phí → còn ~$8/tháng

---

## Flow xử lý Upload Video

```
Tutor → FE (chọn file)
  → BE: POST /api/files/upload-url (tạo Presigned PUT URL)
  → FE: PUT trực tiếp lên S3 (không qua BE)
  → FE: POST /api/lessons (lưu file_key vào MongoDB)

Student → FE (xem bài học)
  → BE: GET /api/files/download-url (kiểm tra quyền + tạo Presigned GET URL)
  → FE: Load video từ URL có thời hạn
```
