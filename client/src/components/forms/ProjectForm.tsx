// src/components/forms/ProjectForm.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/common/Card';

interface ProjectFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultValues?: {
    name?: string;
    description?: string;
    hourlyRate?: number;
    clientName?: string;
    clientCompany?: string;
    clientAddress?: string;
    clientEmail?: string;
  };
  isEdit?: boolean;
  projectId?: number;
}

export const ProjectForm = ({
  onSuccess,
  onCancel,
  defaultValues = {},
  isEdit = false,
  projectId,
}: ProjectFormProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: defaultValues.name || '',
    description: defaultValues.description || '',
    hourlyRate: defaultValues.hourlyRate || 0,
    clientName: defaultValues.clientName || '',
    clientCompany: defaultValues.clientCompany || '',
    clientAddress: defaultValues.clientAddress || '',
    clientEmail: defaultValues.clientEmail || '',
  });

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (isEdit && projectId) {
        return projectsApi.update(projectId, data);
      }
      return projectsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit Project' : 'New Project'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              Project Name
            </label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="description">
              Description
            </label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="hourlyRate">
              Hourly Rate ($)
            </label>
            <Input
              id="hourlyRate"
              type="number"
              min="0"
              step="0.01"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="clientName">
                Client Name
              </label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="clientCompany">
                Client Company
              </label>
              <Input
                id="clientCompany"
                value={formData.clientCompany}
                onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="clientAddress">
              Client Address
            </label>
            <textarea
              id="clientAddress"
              value={formData.clientAddress}
              onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Street&#10;ZIP City&#10;Country"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="clientEmail">
              Client Email
            </label>
            <Input
              id="clientEmail"
              type="email"
              value={formData.clientEmail}
              onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
