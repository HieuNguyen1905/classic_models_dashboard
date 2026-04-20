# Classicmodels Dashboard

Dashboard phân tích dữ liệu kinh doanh từ bộ dữ liệu **Classicmodels** với kiến trúc fullstack:

- **Backend:** Node.js + Express + Prisma + MySQL
- **Frontend:** React + Vite + Tailwind CSS + Recharts + React PivotTable

## Screenshot

![Classicmodels Dashboard](./Screenshot%20from%202026-04-20%2011-46-29.png)

## Tính năng chính

- Tìm kiếm khách hàng theo tên (`/api/search`)
- Thống kê doanh thu từ đơn hàng đã giao (`/api/stats`)
- Chatbot tư vấn dữ liệu kinh doanh (`/api/chat`)
- Chatbot dùng **dynamic context**: tự trích từ khóa câu hỏi và nạp dữ liệu liên quan từ DB trước khi gửi cho LLM
- Biểu đồ doanh thu theo năm (Bar Chart)
- Pivot table kéo-thả để phân tích dữ liệu đa chiều
- Cache dữ liệu phía frontend bằng React Query

## Cấu trúc thư mục

```bash
classicmodels-dashboard/
├── backend/
│   ├── prisma/
│   └── server.js
├── frontend/
│   └── src/
└── README.md
```

## Yêu cầu môi trường

- Node.js 20+ (khuyến nghị LTS)
- MySQL 8+
- npm

## Cài đặt và chạy dự án

### 1. Backend

```bash
cd backend
npm install
```

Tạo/sửa file `.env`:

```env
DATABASE_URL="mysql://<username>:<password>@localhost:3306/classicmodels"
PORT=3000
OPENAI_API_KEY="<your_openai_api_key>"
OPENAI_MODEL="gpt-4o-mini"
# Optional:
# OPENAI_API_URL="https://api.openai.com/v1"
```

Sinh Prisma Client:

```bash
npx prisma generate
```

Chạy server:

```bash
node server.js
```

Backend chạy tại: `http://localhost:3000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại: `http://localhost:5173`

## API

### `GET /api/search?q=<keyword>`

Tìm khách hàng theo tên, trả về danh sách khách hàng kèm orders.

### `GET /api/stats`

Trả về dữ liệu tổng hợp (customer, product, year, month, revenue) phục vụ chart và pivot table.

### `POST /api/chat`

Chatbot tư vấn dựa trên ngữ cảnh dữ liệu dashboard + context động theo câu hỏi.

Luồng xử lý:

1. Nhận `message` + `history` từ frontend.
2. Trích từ khóa trong câu hỏi (ưu tiên chuỗi trong dấu nháy `'...'` / `"..."`).
3. Truy vấn DB để lấy `relatedCustomers` (tên, quốc gia, thành phố, credit limit, số đơn).
4. Ghép với business summary (tổng doanh thu, top năm, top product line) thành JSON context.
5. Gửi context này vào prompt để LLM trả lời chính xác hơn cho câu hỏi cụ thể.

Body mẫu:

```json
{
  "message": "Năm nào doanh thu cao nhất?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response mẫu:

```json
{
  "answer": "Khách hàng Mini Gifts Distributors Ltd. nằm ở USA."
}
```

## Công nghệ sử dụng

- Express, Prisma ORM, MySQL
- React, Vite, Tailwind CSS
- TanStack Query, Axios
- Recharts, react-pivottable
