import { appendAuditLog, createId, getStore, json, saveStore } from '../_store.js';

export default async function handler(req, res) {
  const store = await getStore();

  if (req.method === 'GET') {
    const counts = {};
    for (const event of store.events) {
      counts[event.event] = (counts[event.event] ?? 0) + 1;
    }

    const eventCounts = Object.entries(counts)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);

    return json(res, 200, { eventCounts });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.event || typeof body.event !== 'string') {
      return json(res, 400, { error: 'event is required' });
    }

    const entry = {
      id: createId('event'),
      event: body.event,
      at: new Date().toISOString(),
      data: typeof body.data === 'object' && body.data ? body.data : {},
    };

    store.events.unshift(entry);
    store.events = store.events.slice(0, 5000);
    await saveStore(store);
    return json(res, 201, { event: entry });
  }

  if (req.method === 'DELETE') {
    store.events = [];
    appendAuditLog(store, 'training_events_cleared');
    await saveStore(store);
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
