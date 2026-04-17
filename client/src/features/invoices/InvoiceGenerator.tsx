// src/features/invoices/InvoiceGenerator.tsx
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Copy,
  FileDown,
  FileText,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import { invoicesApi } from '@/api/invoices';
import { projectsApi } from '@/api/projects';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/common/Select';

interface InvoiceEntry {
  date: string;
  hours: number;
  description?: string;
}

interface InvoiceData {
  projectName: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  entries: InvoiceEntry[];
}

interface InvoicePreset {
  id: string;
  name: string;
  brandName: string;
  senderDetails: string;
  clientDetails: string;
  paymentDetails: string;
  invoicePrefix: string;
  currency: string;
  accentColor: string;
  notesMarkdown: string;
  termsMarkdown: string;
}

type MarkdownLine = {
  text: string;
  style: 'heading' | 'bullet' | 'normal';
};

const PRESETS_STORAGE_KEY = 'time-tracker.invoice-presets';
const ACTIVE_PRESET_STORAGE_KEY = 'time-tracker.active-invoice-preset';

const createPresetId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `preset-${Date.now()}`;
};

const defaultPreset: InvoicePreset = {
  id: 'default-professional',
  name: 'Professional',
  brandName: 'Freelance Studio',
  senderDetails: 'Your Name\nStreet Address\nCity, Country\nhello@example.com',
  clientDetails: 'Client Name\nClient Company\nClient Address',
  paymentDetails: 'Bank: Example Bank\nIBAN: DE00 0000 0000 0000 0000 00\nPayment due: 14 days',
  invoicePrefix: 'INV',
  currency: '$',
  accentColor: '#2563eb',
  notesMarkdown: '## Notes\nThank you for the opportunity to support this project.\n\n- Work delivered according to the agreed scope\n- Time entries are grouped by day',
  termsMarkdown: '## Terms\nPayment is due within **14 days** of the invoice date.\n\nPlease include the invoice number with your payment.',
};

const starterPreset: InvoicePreset = {
  ...defaultPreset,
  id: 'default-consulting',
  name: 'Consulting',
  brandName: 'Independent Consultant',
  accentColor: '#0f766e',
  invoicePrefix: 'CONS',
  notesMarkdown: '## Project Summary\nProfessional services completed during the selected billing period.\n\n- Planning, execution, and communication included\n- Detailed time is summarized below',
};

const getInitialPresets = (): InvoicePreset[] => {
  if (typeof window === 'undefined') return [defaultPreset, starterPreset];

  try {
    const saved = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!saved) return [defaultPreset, starterPreset];

    const parsed = JSON.parse(saved) as InvoicePreset[];
    return parsed.length > 0 ? parsed : [defaultPreset, starterPreset];
  } catch {
    return [defaultPreset, starterPreset];
  }
};

const getInitialActivePresetId = (presets: InvoicePreset[]) => {
  if (typeof window === 'undefined') return presets[0].id;
  return window.localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY) || presets[0].id;
};

const currency = (value: number, symbol: string) => `${symbol}${value.toFixed(2)}`;

const hexToRgb = (hex: string): [number, number, number] => {
  const sanitized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(sanitized)) return [37, 99, 235];

  return [
    parseInt(sanitized.slice(0, 2), 16),
    parseInt(sanitized.slice(2, 4), 16),
    parseInt(sanitized.slice(4, 6), 16),
  ];
};

const stripMarkdown = (value: string) =>
  value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1');

const parseMarkdown = (markdown: string): MarkdownLine[] =>
  markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('## ')) {
        return { text: stripMarkdown(line.replace(/^##\s+/, '')), style: 'heading' };
      }

      if (line.startsWith('# ')) {
        return { text: stripMarkdown(line.replace(/^#\s+/, '')), style: 'heading' };
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        return { text: stripMarkdown(line.replace(/^[-*]\s+/, '')), style: 'bullet' };
      }

      return { text: stripMarkdown(line), style: 'normal' };
    });

const addMarkdownBlock = (
  doc: jsPDF,
  title: string,
  markdown: string,
  x: number,
  y: number,
  maxWidth: number
) => {
  const lines = parseMarkdown(markdown);
  if (lines.length === 0) return y;

  doc.setFontSize(11);
  doc.setFont('', 'bold');
  doc.text(title, x, y);
  let cursorY = y + 7;

  lines.forEach((line) => {
    if (line.style === 'heading') {
      doc.setFontSize(10);
      doc.setFont('', 'bold');
      doc.text(line.text, x, cursorY);
      cursorY += 6;
      return;
    }

    doc.setFontSize(9);
    doc.setFont('', 'normal');
    const prefix = line.style === 'bullet' ? '- ' : '';
    const wrapped = doc.splitTextToSize(`${prefix}${line.text}`, maxWidth);
    doc.text(wrapped, x, cursorY);
    cursorY += wrapped.length * 5 + 2;
  });

  return cursorY + 4;
};

const generateInvoiceNumber = (preset: InvoicePreset, data: InvoiceData) => {
  const datePart = format(new Date(data.endDate), 'yyyyMMdd');
  const projectPart = data.projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();
  return `${preset.invoicePrefix}-${datePart}-${projectPart || 'WORK'}`;
};

const generatePDF = (data: InvoiceData, preset: InvoicePreset) => {
  const doc = new jsPDF();
  const accent = hexToRgb(preset.accentColor);
  const invoiceNumber = generateInvoiceNumber(preset, data);

  doc.setFillColor(...accent);
  doc.rect(0, 0, 210, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('', 'bold');
  doc.text('INVOICE', 14, 12);

  doc.setFontSize(10);
  doc.setFont('', 'normal');
  doc.text(invoiceNumber, 196, 12, { align: 'right' });

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont('', 'bold');
  doc.text(preset.brandName, 14, 32);

  doc.setFontSize(9);
  doc.setFont('', 'normal');
  doc.text(preset.senderDetails.split('\n'), 14, 40);

  doc.setFont('', 'bold');
  doc.text('Bill To', 126, 32);
  doc.setFont('', 'normal');
  doc.text(preset.clientDetails.split('\n'), 126, 40);

  doc.setFont('', 'bold');
  doc.text('Project', 14, 68);
  doc.text('Invoice Date', 82, 68);
  doc.text('Billing Period', 126, 68);

  doc.setFont('', 'normal');
  doc.text(data.projectName, 14, 75);
  doc.text(format(new Date(), 'PP'), 82, 75);
  doc.text(
    `${format(new Date(data.startDate), 'PP')} - ${format(new Date(data.endDate), 'PP')}`,
    126,
    75
  );

  const tableData = data.entries.map((entry) => [
    format(new Date(entry.date), 'PP'),
    entry.description || 'Time tracking',
    entry.hours.toFixed(2),
    currency(entry.hours * data.hourlyRate, preset.currency),
  ]);

  autoTable(doc, {
    head: [['Date', 'Description', 'Hours', 'Amount']],
    body: tableData,
    startY: 88,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: accent,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 82 },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 34, halign: 'right' },
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140;
  const totalY = finalY + 13;

  doc.setFontSize(10);
  doc.setFont('', 'normal');
  doc.text('Hourly Rate', 126, totalY);
  doc.text(currency(data.hourlyRate, preset.currency), 196, totalY, { align: 'right' });
  doc.text('Total Hours', 126, totalY + 7);
  doc.text(data.totalHours.toFixed(2), 196, totalY + 7, { align: 'right' });

  doc.setFillColor(245, 247, 250);
  doc.rect(122, totalY + 12, 76, 12, 'F');
  doc.setFont('', 'bold');
  doc.text('Total Amount', 126, totalY + 20);
  doc.text(currency(data.totalAmount, preset.currency), 196, totalY + 20, { align: 'right' });

  const detailsY = Math.max(totalY + 36, 178);
  const nextY = addMarkdownBlock(doc, 'Notes', preset.notesMarkdown, 14, detailsY, 86);
  addMarkdownBlock(doc, 'Terms', preset.termsMarkdown, 110, detailsY, 86);

  doc.setFontSize(9);
  doc.setFont('', 'bold');
  doc.text('Payment Details', 14, Math.min(nextY, 258));
  doc.setFont('', 'normal');
  doc.text(preset.paymentDetails.split('\n'), 14, Math.min(nextY + 7, 265));

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${format(new Date(), 'PPpp')}`, 105, 286, { align: 'center' });

  doc.save(`${invoiceNumber}-${data.projectName}.pdf`);
};

const PresetField = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="block text-sm font-medium mb-1">{label}</label>
    {children}
  </div>
);

export default function InvoiceGenerator() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [presets, setPresets] = useState<InvoicePreset[]>(getInitialPresets);
  const [activePresetId, setActivePresetId] = useState(() => getInitialActivePresetId(presets));
  const [draftPreset, setDraftPreset] = useState<InvoicePreset>(() => presets[0]);
  const [isEditingPreset, setIsEditingPreset] = useState(false);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) || presets[0],
    [activePresetId, presets]
  );

  const { data: projects, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  const generateMutation = useMutation({
    mutationFn: invoicesApi.generate,
  });

  useEffect(() => {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    if (!isEditingPreset) {
      setDraftPreset(activePreset);
    }
  }, [activePreset, isEditingPreset]);

  const updateDraft = (updates: Partial<InvoicePreset>) => {
    setDraftPreset((current) => ({ ...current, ...updates }));
  };

  const handleCreatePreset = () => {
    const nextPreset: InvoicePreset = {
      ...activePreset,
      id: createPresetId(),
      name: `${activePreset.name} Copy`,
    };

    setPresets((current) => [...current, nextPreset]);
    setActivePresetId(nextPreset.id);
    setDraftPreset(nextPreset);
    setIsEditingPreset(true);
  };

  const handleSavePreset = () => {
    setPresets((current) =>
      current.map((preset) => (preset.id === draftPreset.id ? draftPreset : preset))
    );
    setActivePresetId(draftPreset.id);
    setIsEditingPreset(false);
  };

  const handleDeletePreset = () => {
    if (presets.length === 1) return;

    const remaining = presets.filter((preset) => preset.id !== activePreset.id);
    setPresets(remaining);
    setActivePresetId(remaining[0].id);
    setDraftPreset(remaining[0]);
    setIsEditingPreset(false);
  };

  const handleDownloadPDF = () => {
    if (generateMutation.data) {
      generatePDF(generateMutation.data, activePreset);
    }
  };

  const handleGenerate = () => {
    if (!selectedProjectId || !dateRange.startDate || !dateRange.endDate) return;

    generateMutation.mutate({
      projectId: selectedProjectId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
  };

  if (isProjectsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const editablePreset = isEditingPreset ? draftPreset : activePreset;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generate Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Build professional invoice PDFs from tracked time and reusable presets.
          </p>
        </div>
        <Button variant="outline" onClick={handleCreatePreset}>
          <Plus className="w-4 h-4 mr-2" />
          New Preset
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PresetField label="Project">
              <Select
                value={selectedProjectId?.toString() || ''}
                onValueChange={(value) => setSelectedProjectId(Number(value))}
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
            </PresetField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PresetField label="Start Date">
                <Input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(event) =>
                    setDateRange({ ...dateRange, startDate: event.target.value })
                  }
                />
              </PresetField>
              <PresetField label="End Date">
                <Input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(event) =>
                    setDateRange({ ...dateRange, endDate: event.target.value })
                  }
                />
              </PresetField>
            </div>

            <PresetField label="Invoice Preset">
              <Select
                value={activePresetId}
                onValueChange={(value) => {
                  setActivePresetId(value);
                  setIsEditingPreset(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PresetField>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={
                !selectedProjectId ||
                !dateRange.startDate ||
                !dateRange.endDate ||
                generateMutation.isPending
              }
            >
              <FileText className="w-4 h-4 mr-2" />
              {generateMutation.isPending ? 'Generating...' : 'Generate Invoice'}
            </Button>

            {generateMutation.error && (
              <div className="text-sm text-red-500">
                Error generating invoice. Please try again.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Preset Editor</CardTitle>
            <div className="flex flex-wrap gap-2">
              {isEditingPreset ? (
                <Button size="sm" onClick={handleSavePreset}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditingPreset(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleCreatePreset}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeletePreset}
                disabled={presets.length === 1}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PresetField label="Preset Name">
                <Input
                  value={editablePreset.name}
                  disabled={!isEditingPreset}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                />
              </PresetField>
              <PresetField label="Brand / Sender Name">
                <Input
                  value={editablePreset.brandName}
                  disabled={!isEditingPreset}
                  onChange={(event) => updateDraft({ brandName: event.target.value })}
                />
              </PresetField>
              <PresetField label="Invoice Prefix">
                <Input
                  value={editablePreset.invoicePrefix}
                  disabled={!isEditingPreset}
                  onChange={(event) => updateDraft({ invoicePrefix: event.target.value })}
                />
              </PresetField>
              <div className="grid grid-cols-[1fr_4rem] gap-3">
                <PresetField label="Currency">
                  <Input
                    value={editablePreset.currency}
                    disabled={!isEditingPreset}
                    onChange={(event) => updateDraft({ currency: event.target.value })}
                  />
                </PresetField>
                <PresetField label="Color">
                  <Input
                    type="color"
                    value={editablePreset.accentColor}
                    disabled={!isEditingPreset}
                    onChange={(event) => updateDraft({ accentColor: event.target.value })}
                    className="p-1"
                  />
                </PresetField>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PresetField label="Sender Details">
                <textarea
                  value={editablePreset.senderDetails}
                  disabled={!isEditingPreset}
                  onChange={(event) => updateDraft({ senderDetails: event.target.value })}
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </PresetField>
              <PresetField label="Client Details">
                <textarea
                  value={editablePreset.clientDetails}
                  disabled={!isEditingPreset}
                  onChange={(event) => updateDraft({ clientDetails: event.target.value })}
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </PresetField>
            </div>

            <PresetField label="Payment Details">
              <textarea
                value={editablePreset.paymentDetails}
                disabled={!isEditingPreset}
                onChange={(event) => updateDraft({ paymentDetails: event.target.value })}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </PresetField>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PresetField label="Notes Markdown">
                <textarea
                  value={editablePreset.notesMarkdown}
                  disabled={!isEditingPreset}
                  onChange={(event) => updateDraft({ notesMarkdown: event.target.value })}
                  className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </PresetField>
              <PresetField label="Terms Markdown">
                <textarea
                  value={editablePreset.termsMarkdown}
                  disabled={!isEditingPreset}
                  onChange={(event) => updateDraft({ termsMarkdown: event.target.value })}
                  className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </PresetField>
            </div>
          </CardContent>
        </Card>
      </div>

      {generateMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <span className="block text-sm text-muted-foreground">Project</span>
                <span className="font-medium">{generateMutation.data.projectName}</span>
              </div>
              <div>
                <span className="block text-sm text-muted-foreground">Period</span>
                <span className="font-medium">
                  {new Date(generateMutation.data.startDate).toLocaleDateString()} -{' '}
                  {new Date(generateMutation.data.endDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="block text-sm text-muted-foreground">Hours</span>
                <span className="font-medium">
                  {generateMutation.data.totalHours.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="block text-sm text-muted-foreground">Total</span>
                <span className="font-medium">
                  {currency(generateMutation.data.totalAmount, activePreset.currency)}
                </span>
              </div>
              <Button variant="outline" className="w-full self-end" onClick={handleDownloadPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
