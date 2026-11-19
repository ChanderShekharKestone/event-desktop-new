import { apiPath, apiLeadExport } from '../../apiPath';

/**
 * Downloads a lead capture CSV — `type` booth|room, optional `pointId` for one booth/room,
 * `view` attendance|entries for rooms. The server names the file; `fallbackName` is used
 * if the header can't be read.
 */
const downloadCsv = async ({ type, pointId, view, fallbackName }) => {
  const params = new URLSearchParams({ type, ...(pointId && { pointId }), ...(view && { view }) });
  const res = await fetch(`${apiPath}${apiLeadExport}?${params}`, { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || 'Export failed');
  }
  const name =
    res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export default downloadCsv;
