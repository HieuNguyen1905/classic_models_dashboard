import { useState, useMemo } from 'react';
import { useStats, useSearch } from './hooks/useDashboardData';
import { chatWithAssistant } from './services/api';
import PivotTableUIImport from 'react-pivottable/PivotTableUI';
const PivotTableUI = PivotTableUIImport.default || PivotTableUIImport;
import 'react-pivottable/pivottable.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pivotState, setPivotState] = useState({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content:
        'Xin chào! Tôi là trợ lý Classicmodels. Bạn có thể hỏi về doanh thu, khách hàng, sản phẩm hoặc xu hướng kinh doanh.',
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const { data: searchResults, isLoading: isSearching } = useSearch(searchTerm);
  const { data: statsData, isLoading: isLoadingStats } = useStats();

  const chartData = useMemo(() => {
    if (!statsData?.length) return [];

    const yearMap = statsData.reduce((acc, curr) => {
      const year = curr.orderYear;
      const revenue = Number(curr.totalRevenue) || 0;
      acc.set(year, (acc.get(year) || 0) + revenue);
      return acc;
    }, new Map());

    return [...yearMap.entries()]
      .map(([year, revenue]) => ({ year, revenue }))
      .sort((a, b) => a.year - b.year);
  }, [statsData]);

  const dashboardMetrics = useMemo(() => {
    if (!statsData?.length) {
      return {
        totalRevenue: 0,
        totalYears: 0,
        totalProductLines: 0,
        totalSearchResults: searchResults?.length || 0,
      };
    }

    let totalRevenue = 0;
    const years = new Set();
    const productLines = new Set();

    for (const item of statsData) {
      totalRevenue += Number(item.totalRevenue) || 0;
      if (item.orderYear !== null && item.orderYear !== undefined) years.add(item.orderYear);
      if (item.productLine) productLines.add(item.productLine);
    }

    return {
      totalRevenue,
      totalYears: years.size,
      totalProductLines: productLines.size,
      totalSearchResults: searchResults?.length || 0,
    };
  }, [statsData, searchResults]);

  const topYear = useMemo(() => {
    if (!chartData.length) return null;
    return chartData.reduce((best, curr) => (curr.revenue > best.revenue ? curr : best));
  }, [chartData]);

  const pivotConfig = useMemo(
    () => ({
      rows: ['orderYear'],
      cols: ['productLine'],
      vals: ['totalRevenue'],
      aggregatorName: 'Sum',
      ...pivotState,
    }),
    [pivotState],
  );

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      Number(value) || 0,
    );

  const sendChatMessage = async () => {
    const message = chatInput.trim();
    if (!message || isChatLoading) return;

    const nextMessages = [...chatMessages, { role: 'user', content: message }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatError('');
    setIsChatLoading(true);

    try {
      const history = nextMessages.slice(-8).map((item) => ({
        role: item.role,
        content: item.content,
      }));
      const result = await chatWithAssistant({ message, history });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result.answer }]);
    } catch (error) {
      const serverMessage = error?.response?.data?.error;
      setChatError(serverMessage || 'Không thể kết nối chatbot. Vui lòng thử lại.');
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 font-sans sm:px-6 lg:px-10">
      <header className="mx-auto mb-8 max-w-7xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700">
              CLASSICMODELS ANALYTICS
            </p>
            <h1 className="text-3xl font-bold text-slate-800 md:text-4xl">Classicmodels Dashboard</h1>
            <p className="mt-2 text-slate-500">Hệ thống tìm kiếm và thống kê dữ liệu kinh doanh theo thời gian thực.</p>
          </div>
          <div className="rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg">
            <p className="text-xs uppercase tracking-wide text-slate-300">Năm doanh thu cao nhất</p>
            <p className="mt-1 text-xl font-semibold">{topYear ? topYear.year : '--'}</p>
            <p className="text-sm text-slate-200">{topYear ? formatCurrency(topYear.revenue) : 'Chưa có dữ liệu'}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Tổng doanh thu</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{formatCurrency(dashboardMetrics.totalRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Số năm có dữ liệu</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{dashboardMetrics.totalYears}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Dòng sản phẩm</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{dashboardMetrics.totalProductLines}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Kết quả tìm kiếm hiện tại</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{dashboardMetrics.totalSearchResults}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:col-span-1">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">Tìm kiếm khách hàng</h2>
            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-slate-600">Tên khách hàng</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">⌕</span>
                <input
                  type="text"
                  placeholder="Nhập tên khách hàng..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </label>

            <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
              {isSearching && <p className="text-sm text-slate-500">Đang tìm kiếm...</p>}
              {searchResults && searchResults.length === 0 && <p className="text-sm text-slate-500">Không tìm thấy kết quả.</p>}
              <ul className="space-y-3">
                {searchResults?.map((customer) => (
                  <li
                    key={customer.customerNumber}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <p className="font-medium text-slate-800">{customer.customerName}</p>
                    <p className="text-sm text-slate-500">Quốc gia: {customer.country}</p>
                    <p className="mt-1 text-sm font-medium text-blue-700">Số đơn hàng: {customer.orders?.length || 0}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-slate-800">Tổng doanh thu theo năm (USD)</h2>
                <p className="text-sm text-slate-500">Theo dõi xu hướng doanh thu để đánh giá tăng trưởng kinh doanh qua từng năm.</p>
              </div>
              {isLoadingStats ? (
                <p className="text-slate-500">Đang tải dữ liệu biểu đồ...</p>
              ) : chartData.length === 0 ? (
                <p className="text-slate-500">Chưa có dữ liệu để hiển thị biểu đồ.</p>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => `$${(Number(value) || 0).toLocaleString()}`} />
                      <Tooltip formatter={(value) => [formatCurrency(value), 'Doanh thu']} />
                      <Legend />
                      <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-xl font-semibold text-slate-800">Phân tích chuyên sâu (Pivot)</h2>
              <p className="mb-4 text-sm text-slate-500">
                Kéo thả các trường dữ liệu để tạo bảng tổng hợp linh hoạt (ví dụ: productLine vào Cột, orderYear vào Hàng).
              </p>
              {isLoadingStats ? (
                <p className="text-slate-500">Đang tải dữ liệu Pivot...</p>
              ) : (
                <div className="min-w-[800px] rounded-lg border border-slate-200 bg-white p-3">
                  <PivotTableUI data={statsData || []} onChange={(s) => setPivotState(s)} {...pivotConfig} />
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-6 right-6 z-40">
        {isChatOpen ? (
          <div className="flex h-[540px] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
              <div>
                <p className="text-sm font-semibold">Classicmodels Assistant</p>
                <p className="text-xs text-slate-300">Hỏi đáp dữ liệu kinh doanh</p>
              </div>
              <button
                className="rounded-md px-2 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                onClick={() => setIsChatOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
              {chatMessages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    item.role === 'user'
                      ? 'ml-auto bg-blue-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {item.content}
                </div>
              ))}
              {isChatLoading && (
                <div className="max-w-[85%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                  Đang suy nghĩ...
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white p-3">
              {chatError ? <p className="mb-2 text-xs text-red-600">{chatError}</p> : null}
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendChatMessage();
                  }}
                  placeholder="Nhập câu hỏi..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={isChatLoading}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  Gửi
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-blue-700"
            onClick={() => setIsChatOpen(true)}
          >
            💬 Chat với trợ lý
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
