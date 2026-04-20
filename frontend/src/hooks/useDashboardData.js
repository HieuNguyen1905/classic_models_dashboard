// src/hooks/useDashboardData.js
import { useQuery } from '@tanstack/react-query';
import { getStatsData, searchCustomers } from '../services/api';

export const useStats = () => {
    return useQuery({
        queryKey: ['statsData'],
        queryFn: getStatsData,
        staleTime: 5 * 60 * 1000, // Cache dữ liệu trong 5 phút để tránh spam API
    });
};

export const useSearch = (keyword) => {
    return useQuery({
        queryKey: ['searchData', keyword],
        queryFn: () => searchCustomers(keyword),
        enabled: keyword !== undefined, // Chỉ fetch khi có keyword
    });
};