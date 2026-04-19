import axios from '@/lib/axios';

interface GenerateInvoiceRequest {
  projectId: number;
  startDate?: string;
  endDate?: string;
  timeEntryIds?: number[];
  language?: 'en' | 'de';
}

export interface InvoiceResponse {
  id: number;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  language: 'en' | 'de';
  projectName: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  entries: Array<{
    date: string;
    hours: number;
    description?: string;
  }>;
}

export const invoicesApi = {
  generate: async (data: GenerateInvoiceRequest): Promise<InvoiceResponse> => {
    const response = await axios.post('/invoices/generate', data);
    return response.data;
  },

  getAll: async (): Promise<Array<{
    ID: number;
    number: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    language: 'en' | 'de';
    project_id: number;
    start_date: string;
    end_date: string;
    total_hours: number;
    total_amount: number;
  }>> => {
    const response = await axios.get('/invoices');
    return response.data;
  },

  updateStatus: async (
    id: number,
    status: 'draft' | 'sent' | 'paid' | 'overdue'
  ) => {
    const response = await axios.patch(`/invoices/${id}/status`, { status });
    return response.data;
  },
};
