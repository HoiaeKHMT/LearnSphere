# LearnSphere — Hướng dẫn Thiết lập AWS Infrastructure

Tài liệu này hướng dẫn từng bước thiết lập hạ tầng AWS cho dự án LearnSphere.
Thực hiện đúng thứ tự từ Bước 1 đến Bước 7.

---

## Bước 0 — Xử lý bảo mật khẩn cấp

> ⚠️ **QUAN TRỌNG**: Nếu bạn đã lỡ commit file `.env` chứa credentials thật lên GitHub, làm ngay các bước sau trước khi tiếp tục:

1. Vào [AWS IAM Console](https://console.aws.amazon.com/iam/home#/users)
2. Chọn user → tab **Security credentials**
3. Tìm Access Key bị lộ → nhấn **Deactivate** rồi **Delete**
4. Tạo key mới ở bước sau (chỉ dùng cho GitHub Secrets, không lưu local)

---

## Bước 1 — Tạo IAM User cho CI/CD (GitHub Actions)

> Mục tiêu: Tạo 1 user chuyên dụng cho GitHub Actions, với quyền tối thiểu.

1. Vào **IAM → Users → Create user**
   - Username: `learnsphere-github-actions`
   - Access type: **Programmatic access**

2. Gắn các policy sau (Attach policies directly):
   - `AmazonEC2ContainerRegistryFullAccess` — để push/pull ECR
   - `AmazonS3FullAccess` — để sync FE lên S3
   - `CloudFrontFullAccess` — để invalidate cache

3. Sau khi tạo xong → **Download Access Key** (lưu dùng cho GitHub Secrets)

---

## Bước 2 — Tạo IAM Role cho EC2 Instance

> Mục tiêu: EC2 tự dùng IAM Role để truy cập S3 và ECR — không cần Access Key trong `.env`.

1. Vào **IAM → Roles → Create role**
   - Trusted entity: **AWS service → EC2**
   - Tên role: `learnsphere-ec2-role`

2. Gắn các policy:
   - `AmazonS3FullAccess` (hoặc chỉ bucket cụ thể)
   - `AmazonEC2ContainerRegistryReadOnly` — để pull image từ ECR
   - `CloudWatchAgentServerPolicy` — để đẩy logs lên CloudWatch

3. Nhớ tên role này để gắn vào EC2 ở Bước 4.

---

## Bước 3 — Cấu hình S3 Buckets

### 3a. Bucket Media (đã có: `ai-learning-platform-vhd`)

Vào **S3 → Bucket → Permissions → CORS** và dán cấu hình:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://CLOUDFRONT_DOMAIN.cloudfront.net"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> Thay `CLOUDFRONT_DOMAIN` bằng domain CloudFront thật sau khi tạo ở Bước 6.

### 3b. Bucket Frontend Static Hosting (tạo mới)

1. Vào **S3 → Create bucket**
   - Bucket name: `learnsphere-fe-static` (phải là tên duy nhất toàn cầu)
   - Region: `ap-southeast-1`
   - **Bỏ tick** "Block all public access" → xác nhận

2. Sau khi tạo → **Properties → Static website hosting → Enable**
   - Index document: `index.html`
   - Error document: `index.html` ← quan trọng cho React Router

3. **Permissions → Bucket policy** → dán:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::learnsphere-fe-static/*"
    }
  ]
}
```

---

## Bước 4 — Tạo ECR Repository

1. Vào **ECR → Create repository**
   - Visibility: **Private**
   - Repository name: `learnsphere-be`
   - Image scanning: **Scan on push** ✅
   - Region: `ap-southeast-1`

2. Ghi lại **Repository URI** (dạng: `123456789.dkr.ecr.ap-southeast-1.amazonaws.com/learnsphere-be`)

---

## Bước 5 — Launch EC2 Instance

1. Vào **EC2 → Launch Instance**

   | Setting | Giá trị |
   |---|---|
   | AMI | Amazon Linux 2023 (64-bit) |
   | Instance type | `t3.micro` (Free Tier) hoặc `t3.small` |
   | Key pair | Tạo mới → tải file `.pem` về |
   | VPC | Default VPC |
   | Subnet | Public subnet |
   | Auto-assign public IP | Enable |
   | IAM Instance Profile | `learnsphere-ec2-role` (Bước 2) |

2. **Security Group** — Inbound rules:

   | Type | Port | Source | Mục đích |
   |---|---|---|---|
   | SSH | 22 | My IP | SSH quản trị |
   | HTTP | 80 | 0.0.0.0/0 | Web traffic |
   | HTTPS | 443 | 0.0.0.0/0 | Web traffic |
   | Custom TCP | 5000 | 0.0.0.0/0 | Backend API |

3. **Sau khi launch** → ghi lại **Public IPv4 address**

### Cài đặt môi trường trên EC2

SSH vào EC2 rồi chạy:

```bash
# 1. Cài Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Đăng xuất và login lại để áp dụng group docker
exit

# 2. Cài AWS CLI (thường đã có trên Amazon Linux 2023)
aws --version

# 3. Tạo file .env trên server (KHÔNG commit lên Git)
nano /home/ec2-user/.env
# Điền nội dung từ .env.example

# 4. Tạo CloudWatch log group
aws logs create-log-group \
  --log-group-name /learnsphere/backend \
  --region ap-southeast-1

# 5. Test pull image từ ECR (sau khi push lần đầu qua CI/CD)
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin <ECR_REGISTRY>
```

---

## Bước 6 — Tạo CloudFront Distributions

### Distribution 1: Frontend (S3 Static)

1. Vào **CloudFront → Create distribution**

   | Setting | Giá trị |
   |---|---|
   | Origin domain | Chọn bucket `learnsphere-fe-static` |
   | Origin access | Public (bucket đã public) |
   | Default root object | `index.html` |
   | Viewer protocol policy | Redirect HTTP to HTTPS |
   | Price class | Use only North America, Europe, Asia (rẻ hơn) |

2. **Custom error responses** → Add:
   - HTTP error code: `403` → Response page: `/index.html` → HTTP 200
   - HTTP error code: `404` → Response page: `/index.html` → HTTP 200
   
   *(Cần thiết để React Router hoạt động đúng khi refresh trang)*

3. Sau khi tạo → ghi lại **Distribution ID** và **Domain name** (`dxxxx.cloudfront.net`)

### Distribution 2: Media/Assets (S3 Media)

1. Tạo distribution mới:
   - Origin: bucket `ai-learning-platform-vhd`
   - Origin access: **Origin access control (OAC)** ← bảo mật hơn
   - Cache policy: `CachingOptimized`

2. Cập nhật bucket policy của `ai-learning-platform-vhd` để chỉ cho CloudFront truy cập (AWS tự gợi ý khi bạn chọn OAC).

---

## Bước 7 — Cài GitHub Secrets

Vào **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name | Cách lấy giá trị |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM User `learnsphere-github-actions` → Access Key |
| `AWS_SECRET_ACCESS_KEY` | IAM User `learnsphere-github-actions` → Secret Key |
| `ECR_REGISTRY` | `{account-id}.dkr.ecr.ap-southeast-1.amazonaws.com` |
| `EC2_HOST` | Public IPv4 của EC2 instance |
| `EC2_SSH_KEY` | Toàn bộ nội dung file `.pem` (bao gồm cả `-----BEGIN RSA PRIVATE KEY-----`) |
| `VITE_API_BASE_URL` | `http://{EC2_PUBLIC_IP}:5000/api` |
| `S3_FE_BUCKET` | `learnsphere-fe-static` |
| `CLOUDFRONT_FE_DISTRIBUTION_ID` | ID của CloudFront FE distribution |

---

## Bước 8 — Cài CloudWatch Alarms

Vào **CloudWatch → Alarms → Create alarm**:

### Alarm 1: CPU cao
- Metric: `EC2 → Per-Instance Metrics → CPUUtilization`
- Condition: > 80% trong 2 periods (10 phút)
- Action: Gửi email qua SNS

### Alarm 2: Instance ngừng hoạt động
- Metric: `EC2 → Per-Instance Metrics → StatusCheckFailed`
- Condition: >= 1
- Action: Gửi email qua SNS

### Log Group: Backend logs
- Container sẽ tự đẩy logs lên `/learnsphere/backend` (đã cấu hình trong `deploy.yml`)
- Có thể xem logs tại: **CloudWatch → Log groups → /learnsphere/backend**

---

## Bước 9 — Trigger CI/CD lần đầu

```bash
# Commit tất cả file mới
git add .
git commit -m "feat: add Docker, CI/CD, and AWS deployment config"
git push origin main
```

GitHub Actions sẽ tự động:
1. Build Docker image → Push lên ECR
2. SSH vào EC2 → Pull image → Restart container
3. Build React → Upload S3 → Invalidate CloudFront

Theo dõi tại: **GitHub → Actions tab** → xem log từng step.

---

## Kiểm tra sau khi deploy

```bash
# 1. Kiểm tra container đang chạy trên EC2
ssh -i your-key.pem ec2-user@EC2_IP
docker ps

# 2. Kiểm tra logs
docker logs learnsphere-be --tail 50

# 3. Test API
curl http://EC2_IP:5000/
# → {"message": "LearnSphere Platform API is running"}

# 4. Kiểm tra Frontend
# Truy cập: https://CLOUDFRONT_DOMAIN.cloudfront.net
```
