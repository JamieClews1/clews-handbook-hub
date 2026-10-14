// Streams a structured JSON answer from the Lovable AI Gateway Responses API.
export async function aiJson(apiKey: string, opts: {
  instructions: string; input: string; name: string; schema: Record<string, unknown>; effort?: 'low' | 'medium';
}): Promise<any> {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: { 'Lovable-API-Key': apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      stream: true,
      store: false,
      reasoning: { effort: opts.effort ?? 'low' },
      instructions: opts.instructions,
      input: opts.input,
      text: { format: { type: 'json_schema', name: opts.name, strict: true, schema: opts.schema } },
    }),
  });
  if (!res.ok || !res.body) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', out = '', done = '';
  while (true) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const d = line.slice(5).trim();
      if (!d || d === '[DONE]') continue;
      let ev: any;
      try { ev = JSON.parse(d); } catch { continue; }
      if (ev.type === 'response.output_text.delta') out += ev.delta ?? '';
      else if (ev.type === 'response.output_text.done') done = ev.text ?? '';
      else if (ev.type === 'response.failed' || ev.type === 'error') throw new Error(`AI failed: ${JSON.stringify(ev).slice(0, 500)}`);
    }
  }
  const text = done || out;
  return text ? JSON.parse(text) : null;
}
