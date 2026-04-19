// src/features/time-entries/TimeEntriesPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi } from '@/api/time-entries';
import { projectsApi } from '@/api/projects';
import { tasksApi } from '@/api/tasks';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/common/Select';
import { Timer } from './Timer';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDuration } from '@/lib/utils';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { isAxiosError } from 'axios';

const toDateTimeInputValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const today = new Date();
const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0);
const defaultEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0);

export default function TimeEntriesPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState({
    projectId: '',
    taskId: 'none',
    startTime: toDateTimeInputValue(defaultStart),
    endTime: toDateTimeInputValue(defaultEnd),
    wholeDay: false,
    wholeDayDate: format(today, 'yyyy-MM-dd'),
    wholeDayHours: 8,
  });

  const { data: timeEntries, isLoading: isEntriesLoading } = useQuery({
    queryKey: ['time-entries', selectedProjectId],
    queryFn: () => timeEntriesApi.getAll(selectedProjectId ? Number(selectedProjectId) : undefined)
  });

  const { data: projects, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll
  });

  const { data: tasks, isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll()
  });

  const deleteMutation = useMutation({
    mutationFn: timeEntriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    }
  });

  const createMutation = useMutation({
    mutationFn: timeEntriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    }
  });

  const handleFilterChange = (value: string) => {
    setSelectedProjectId(value === "all" ? null : value);
  };

  const getProjectName = (projectId: number) => {
    return projects?.find(p => p.id === projectId)?.name || 'Unknown Project';
  };

  const getTaskName = (taskId: number) => {
    return tasks?.find(t => t.id === taskId)?.title || 'Unknown Task';
  };

  const availableTasks = tasks?.filter((task) => {
    const projectId = Number(manualEntry.projectId);
    return projectId ? task.projectId === projectId : true;
  }) || [];

  const handleCreateManualEntry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualEntry.projectId) return;

    const start = manualEntry.wholeDay
      ? new Date(`${manualEntry.wholeDayDate}T09:00:00`)
      : new Date(manualEntry.startTime);
    const end = manualEntry.wholeDay
      ? new Date(start.getTime() + manualEntry.wholeDayHours * 60 * 60 * 1000)
      : new Date(manualEntry.endTime);

    createMutation.mutate({
      projectId: Number(manualEntry.projectId),
      taskId: manualEntry.taskId === 'none' ? undefined : Number(manualEntry.taskId),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration: Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)),
    });
  };

  if (isEntriesLoading || isProjectsLoading || isTasksLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  // Calculate total duration for filtered entries
  const totalDuration = timeEntries?.reduce((acc, entry) => acc + entry.duration, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Time Entries</h1>
      </div>

      <Card className="p-6">
        <Timer />
      </Card>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={handleCreateManualEntry}>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Add Time Manually</h2>
            <p className="text-sm text-gray-500">
              Add an exact time range or book a whole work day in one step.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <Select
                value={manualEntry.projectId}
                onValueChange={(value) =>
                  setManualEntry({ ...manualEntry, projectId: value, taskId: 'none' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Task</label>
              <Select
                value={manualEntry.taskId}
                onValueChange={(value) => setManualEntry({ ...manualEntry, taskId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No task</SelectItem>
                  {availableTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium md:mt-7">
              <input
                type="checkbox"
                checked={manualEntry.wholeDay}
                onChange={(event) =>
                  setManualEntry({ ...manualEntry, wholeDay: event.target.checked })
                }
              />
              Whole day
            </label>
          </div>

          {manualEntry.wholeDay ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <Input
                  type="date"
                  value={manualEntry.wholeDayDate}
                  onChange={(event) =>
                    setManualEntry({ ...manualEntry, wholeDayDate: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hours</label>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={manualEntry.wholeDayHours}
                  onChange={(event) =>
                    setManualEntry({
                      ...manualEntry,
                      wholeDayHours: Number(event.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start</label>
                <Input
                  type="datetime-local"
                  value={manualEntry.startTime}
                  onChange={(event) =>
                    setManualEntry({ ...manualEntry, startTime: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End</label>
                <Input
                  type="datetime-local"
                  value={manualEntry.endTime}
                  onChange={(event) =>
                    setManualEntry({ ...manualEntry, endTime: event.target.value })
                  }
                  required
                />
              </div>
            </div>
          )}

          {createMutation.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {getTimeEntryErrorMessage(createMutation.error)}
            </div>
          )}

          <Button type="submit" disabled={!manualEntry.projectId || createMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            {createMutation.isPending ? 'Adding...' : 'Add Time Entry'}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <Select
              value={selectedProjectId || "all"}
              onValueChange={handleFilterChange}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-sm text-gray-500">
              Total Time: {formatDuration(totalDuration)}
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeEntries?.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{getProjectName(entry.projectId)}</TableCell>
                <TableCell>{entry.taskId ? getTaskName(entry.taskId) : '-'}</TableCell>
                <TableCell>{format(new Date(entry.startTime), 'PPp')}</TableCell>
                <TableCell>{format(new Date(entry.endTime), 'PPp')}</TableCell>
                <TableCell>{formatDuration(entry.duration)}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this time entry? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(entry.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {(!timeEntries || timeEntries.length === 0) && (
              <TableRow>
                <TableCell 
                  colSpan={6} 
                  className="text-center py-8 text-gray-500"
                >
                  No time entries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function getTimeEntryErrorMessage(error: unknown) {
  if (isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error || 'Time entry could not be saved.';
  }

  return 'Time entry could not be saved.';
}
