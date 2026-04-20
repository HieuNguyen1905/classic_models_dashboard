# Classicmodels Dashboard

Dashboard phân tích dữ liệu kinh doanh từ bộ dữ liệu **Classicmodels** với kiến trúc fullstack:

- **Backend:** Node.js + Express + Prisma + MySQL
- **Frontend:** React + Vite + Tailwind CSS + Recharts + React PivotTable

## Screenshot

![Classicmodels Dashboard](./Screenshot%20from%202026-04-20%2011-46-29.png)

## Tính năng chính

- Tìm kiếm khách hàng theo tên (`/api/search`)
- Thống kê doanh thu từ đơn hàng đã giao (`/api/stats`)
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

## Công nghệ sử dụng

- Express, Prisma ORM, MySQL
- React, Vite, Tailwind CSS
- TanStack Query, Axios
- Recharts, react-pivottable

