const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// 1. API: Tìm kiếm khách hàng theo từ khóa
app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    const keyword = q || '';

    try {
        const customers = await prisma.customers.findMany({
            where: {
                customerName: {
                    contains: keyword,
                }
            },
            include: {
                orders: true // Kéo theo thông tin đơn hàng
            },
            take: 50 // Giới hạn kết quả để tối ưu response
        });
        res.json(customers);
    } catch (error) {
        console.error("Lỗi Search API:", error);
        res.status(500).json({ error: "Lỗi khi tìm kiếm dữ liệu" });
    }
});

// 2. API: Lấy dữ liệu phẳng (Flat Data) cho Pivot & Chart
app.get('/api/stats', async (req, res) => {
    try {
        // Sử dụng queryRaw để JOIN các bảng và tính tổng doanh thu chuẩn USD
        const rawData = await prisma.$queryRaw`
            SELECT 
                c.customerName,
                c.country,
                p.productName,
                p.productLine,
                YEAR(o.orderDate) as orderYear,
                MONTH(o.orderDate) as orderMonth,
                SUM(od.quantityOrdered * od.priceEach) as totalRevenue
            FROM customers c
            JOIN orders o ON c.customerNumber = o.customerNumber
            JOIN orderdetails od ON o.orderNumber = od.orderNumber
            JOIN products p ON od.productCode = p.productCode
            WHERE o.status = 'Shipped'
            GROUP BY 
                c.customerName, 
                c.country,
                p.productName, 
                p.productLine, 
                orderYear, 
                orderMonth
        `;

        // Chuyển đổi kiểu BigInt của MySQL sang Number để serialize thành JSON hợp lệ
        const formattedData = rawData.map(item => ({
            customerName: item.customerName,
            country: item.country,
            productName: item.productName,
            productLine: item.productLine,
            orderYear: Number(item.orderYear),
            orderMonth: Number(item.orderMonth),
            totalRevenue: Number(item.totalRevenue)
        }));

        res.json(formattedData);
    } catch (error) {
        console.error("Lỗi Stats API:", error);
        res.status(500).json({ error: "Lỗi khi tổng hợp dữ liệu thống kê" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend Server đang chạy tại http://localhost:${PORT}`);
});