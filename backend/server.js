require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = (process.env.OPENAI_API_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

const extractMessageTerms = (text) => {
    const input = String(text || '').trim();
    if (!input) return [];

    const quotedTerms = [];
    const quoteRegex = /'([^']+)'|"([^"]+)"/g;
    let match = quoteRegex.exec(input);
    while (match) {
        const value = (match[1] || match[2] || '').trim();
        if (value.length >= 3) quotedTerms.push(value);
        match = quoteRegex.exec(input);
    }

    const tokenTerms = input
        .replace(/['"]/g, ' ')
        .split(/[^a-zA-Z0-9.&-]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3);

    return [...new Set([...quotedTerms, ...tokenTerms])].slice(0, 10);
};

const buildDashboardContext = async (userMessage) => {
    const messageTerms = extractMessageTerms(userMessage);
    const relatedCustomersPromise = messageTerms.length
        ? prisma.customers.findMany({
            where: {
                OR: messageTerms.map((term) => ({
                    customerName: { contains: term },
                })),
            },
            select: {
                customerName: true,
                country: true,
                city: true,
                creditLimit: true,
                _count: {
                    select: {
                        orders: true,
                    },
                },
            },
            take: 10,
        })
        : Promise.resolve([]);

    const [summaryRows, yearlyRows, productLineRows, relatedCustomers] = await Promise.all([
        prisma.$queryRaw`
            SELECT 
                COUNT(DISTINCT o.orderNumber) AS totalOrders,
                COUNT(DISTINCT c.customerNumber) AS totalCustomers,
                SUM(od.quantityOrdered * od.priceEach) AS totalRevenue
            FROM customers c
            JOIN orders o ON c.customerNumber = o.customerNumber
            JOIN orderdetails od ON o.orderNumber = od.orderNumber
            WHERE o.status = 'Shipped'
        `,
        prisma.$queryRaw`
            SELECT
                YEAR(o.orderDate) AS orderYear,
                SUM(od.quantityOrdered * od.priceEach) AS revenue
            FROM orders o
            JOIN orderdetails od ON o.orderNumber = od.orderNumber
            WHERE o.status = 'Shipped'
            GROUP BY YEAR(o.orderDate)
            ORDER BY revenue DESC
            LIMIT 3
        `,
        prisma.$queryRaw`
            SELECT
                p.productLine AS productLine,
                SUM(od.quantityOrdered * od.priceEach) AS revenue
            FROM products p
            JOIN orderdetails od ON p.productCode = od.productCode
            JOIN orders o ON od.orderNumber = o.orderNumber
            WHERE o.status = 'Shipped'
            GROUP BY p.productLine
            ORDER BY revenue DESC
            LIMIT 5
        `,
        relatedCustomersPromise,
    ]);

    const summary = summaryRows?.[0] || {};
    return {
        contextVersion: 2,
        extractedTerms: messageTerms,
        totalOrders: Number(summary.totalOrders || 0),
        totalCustomers: Number(summary.totalCustomers || 0),
        totalRevenue: Number(summary.totalRevenue || 0),
        topYearsByRevenue: yearlyRows.map((row) => ({
            orderYear: Number(row.orderYear),
            revenue: Number(row.revenue),
        })),
        topProductLinesByRevenue: productLineRows.map((row) => ({
            productLine: row.productLine,
            revenue: Number(row.revenue),
        })),
        relatedCustomers: relatedCustomers.map((row) => ({
            customerName: row.customerName,
            country: row.country,
            city: row.city,
            creditLimit: Number(row.creditLimit || 0),
            orderCount: Number(row._count?.orders || 0),
        })),
    };
};

// 3. API: Chatbot tư vấn dữ liệu kinh doanh
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body || {};
    const userMessage = typeof message === 'string' ? message.trim() : '';

    if (!userMessage) {
        return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
    }

    if (userMessage.length > 1000) {
        return res.status(400).json({ error: 'Câu hỏi quá dài. Giới hạn 1000 ký tự.' });
    }

    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'Chưa cấu hình OPENAI_API_KEY cho chatbot.' });
    }

    try {
        const dashboardContext = await buildDashboardContext(userMessage);
        const rawHistory = Array.isArray(history)
            ? history
                .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
                .map((item) => ({
                    role: item.role,
                    content: String(item.content || '').slice(0, 1000),
                }))
                .filter((item) => item.content.trim().length > 0)
                .slice(-8)
            : [];
        const safeHistory =
            rawHistory.length &&
                rawHistory[rawHistory.length - 1].role === 'user' &&
                rawHistory[rawHistory.length - 1].content.trim() === userMessage
                ? rawHistory.slice(0, -1)
                : rawHistory;

        const messages = [
            {
                role: 'system',
                content:
                    'Bạn là Classicmodels Assistant. Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng và bám sát dữ liệu JSON được cung cấp. Với câu hỏi về khách hàng cụ thể, hãy ưu tiên trường relatedCustomers trong context. Nếu tìm thấy customerName khớp, trả lời trực tiếp country/city. Nếu không có dữ liệu phù hợp, hãy nói rõ giới hạn dữ liệu hiện có.',
            },
            ...safeHistory,
            {
                role: 'user',
                content: `Context dashboard (JSON): ${JSON.stringify(dashboardContext)}\n\nCâu hỏi: ${userMessage}`,
            },
        ];

        const llmResponse = await fetch(`${OPENAI_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature: 0.2,
                messages,
            }),
        });

        if (!llmResponse.ok) {
            const errorText = await llmResponse.text();
            console.error('Lỗi Chat API upstream:', errorText);
            return res.status(502).json({ error: 'Không thể kết nối dịch vụ AI.', detail: errorText });
        }

        const data = await llmResponse.json();
        const answer = data?.choices?.[0]?.message?.content?.trim();

        if (!answer) {
            return res.status(502).json({ error: 'Dịch vụ AI không trả về nội dung hợp lệ.' });
        }

        return res.json({ answer });
    } catch (error) {
        console.error('Lỗi Chat API:', error);
        return res.status(500).json({ error: 'Lỗi khi xử lý chatbot.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend Server đang chạy tại http://localhost:${PORT}`);
});
