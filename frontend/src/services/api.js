// src/services/api.js
import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'http://localhost:3000/api',
});

export const searchCustomers = async (keyword) => {
    const response = await apiClient.get(`/search?q=${keyword}`);
    return response.data;
};

export const getStatsData = async () => {
    const response = await apiClient.get('/stats');
    return response.data;
};