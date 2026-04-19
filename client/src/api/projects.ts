import axios from '@/lib/axios';
import { Project } from '@/types';

// Type for the backend response
interface ProjectResponse {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: null;
  name: string;
  description: string;
  hourly_rate: number;
  client_name: string;
  client_company: string;
  client_address: string;
  client_email: string;
  user_id: number;
  time_entries: any[] | null;
  tasks: any[] | null;
}

// Transform backend response to match our Project interface
const transformResponse = (data: ProjectResponse): Project => ({
  id: data.ID,
  name: data.name,
  description: data.description,
  hourlyRate: data.hourly_rate,
  clientName: data.client_name || '',
  clientCompany: data.client_company || '',
  clientAddress: data.client_address || '',
  clientEmail: data.client_email || '',
  userId: data.user_id
});

export const projectsApi = {
  getAll: async (): Promise<Project[]> => {
    const response = await axios.get<ProjectResponse[]>('/projects');
    return response.data.map(transformResponse);
  },

  getById: async (id: number): Promise<Project> => {
    const response = await axios.get<ProjectResponse>(`/projects/${id}`);
    return transformResponse(response.data);
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    const response = await axios.post<ProjectResponse>('/projects', {
      name: data.name,
      description: data.description,
      hourly_rate: data.hourlyRate,
      client_name: data.clientName,
      client_company: data.clientCompany,
      client_address: data.clientAddress,
      client_email: data.clientEmail
    });
    return transformResponse(response.data);
  },

  update: async (id: number, data: Partial<Project>): Promise<Project> => {
    const response = await axios.put<ProjectResponse>(`/projects/${id}`, {
      name: data.name,
      description: data.description,
      hourly_rate: data.hourlyRate,
      client_name: data.clientName,
      client_company: data.clientCompany,
      client_address: data.clientAddress,
      client_email: data.clientEmail
    });
    return transformResponse(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`/projects/${id}`);
  }
};
